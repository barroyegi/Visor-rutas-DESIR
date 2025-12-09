import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine.js";
import { config } from "./config.js";
import { fetchRouteGeometry } from "./data.js";
import { initChart, updateChartData, highlightChartPoint, clearChart } from "./chart.js";

let view;
let map;
let startPointsLayer;
let routeLayer;
let cursorLayer; // Layer for the map cursor

let currentRouteGeometry = null;
let currentRouteSamples = null;

export async function initializeMap(containerId) {
    map = new Map({
        basemap: "topo-vector",
        ground: "world-elevation" // Enable world elevation service
    });

    view = new MapView({
        container: containerId,
        map: map,
        center: [-1.6, 42.8], // Navarra aproximada
        zoom: 9
    });

    // Add Navarra borders Feature Layer
    const navarraLayer = new FeatureLayer({
        url: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/fcNavarra_limites/FeatureServer/0",
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: [0, 0, 0, 0], // Transparent fill
                outline: {
                    color: [128, 128, 128], // Gray outline
                    width: 2
                }
            }
        },
        opacity: 1.0,
        popupEnabled: false
    });
    map.add(navarraLayer);

    // Initialize Chart
    initChart("elevation-chart", (index) => {
        // Chart -> Map Sync
        if (currentRouteSamples && currentRouteSamples[index]) {
            const sample = currentRouteSamples[index];
            updateMapCursor(sample.x, sample.y);
        } else {
            console.warn("No sample found for index:", index);
        }
    });

    // Cursor pointer al pasar por startPointsLayer
    view.on("pointer-move", async evt => {
        const hit = await view.hitTest(evt);
        const graphic = hit.results.filter(r => r.graphic.layer === startPointsLayer)[0]?.graphic;

        if (graphic) {
            view.container.style.cursor = "pointer";
            highlightPoint(graphic.attributes.OBJECTID);
        } else {
            view.container.style.cursor = "default";
            removeHighlight();
        }

        // Map -> Chart Sync
        if (currentRouteGeometry) {
            const point = view.toMap(evt);
            if (point) {
                const nearestPoint = geometryEngine.nearestCoordinate(currentRouteGeometry, point);
                const distanceToLine = geometryEngine.distance(point, nearestPoint.coordinate, "meters");

                if (distanceToLine < 100) {
                    console.log("Mouse near route! Distance:", distanceToLine.toFixed(1), "m");
                    updateMapCursor(nearestPoint.coordinate.x, nearestPoint.coordinate.y);

                    const nearestSample = findNearestSample(nearestPoint.coordinate);
                    if (nearestSample) {
                        console.log("Highlighting chart at distance:", nearestSample.distance.toFixed(2), "km");
                        highlightChartPoint(nearestSample.distance);
                    }
                }
            }
        }
    });

    // Layer for Start Points
    startPointsLayer = new GraphicsLayer();
    map.add(startPointsLayer);

    // Layer for Selected Route
    routeLayer = new GraphicsLayer();
    map.add(routeLayer);

    // Layer for Cursor
    cursorLayer = new GraphicsLayer();
    map.add(cursorLayer);

    view.on("click", async (event) => {
        const response = await view.hitTest(event);
        if (response.results.length > 0) {
            const graphic = response.results.filter(r => r.graphic.layer === startPointsLayer)[0]?.graphic;
            if (graphic) {
                const objectId = graphic.attributes.OBJECTID;
                console.log("Clicked start point:", objectId);
                selectRoute(objectId);
            }
        }
    });

    // Listen for clearSelection event from UI
    document.addEventListener("clearSelection", () => {
        routeLayer.removeAll();
        cursorLayer.removeAll();
        document.getElementById("chart-container").classList.remove("active");
        clearChart();
        currentRouteGeometry = null;
        currentRouteSamples = null;
    });

    return view;
}

let highlightedGraphic = null;

export function highlightPoint(objectId) {
    if (highlightedGraphic && highlightedGraphic.attributes.OBJECTID === objectId) return;

    removeHighlight();

    const graphic = startPointsLayer.graphics.find(g => g.attributes.OBJECTID === objectId);
    if (graphic) {
        highlightedGraphic = graphic;
        const symbol = graphic.symbol.clone();
        symbol.width = "40px";
        symbol.height = "40px";
        graphic.symbol = symbol;
    }
}

export function removeHighlight() {
    if (highlightedGraphic) {
        const symbol = highlightedGraphic.symbol.clone();
        symbol.width = "30px";
        symbol.height = "30px";
        highlightedGraphic.symbol = symbol;
        highlightedGraphic = null;
    }
}

export function renderStartPoints(features) {
    startPointsLayer.removeAll();

    const graphics = features.map(f => {
        let pointGeometry = f.geometry;

        if (f.geometry.type === "polyline") {
            pointGeometry = f.geometry.getPoint(0, 0);
        }

        return new Graphic({
            geometry: pointGeometry,
            symbol: {
                type: "picture-marker",
                url: "/icons/hiking.svg",
                width: "30px",
                height: "30px"
            },
            attributes: f.attributes
        });
    });

    startPointsLayer.addMany(graphics);
}

function updateMapCursor(x, y) {

    cursorLayer.removeAll();
    const point = {
        type: "point",
        x: x,
        y: y,
        spatialReference: currentRouteGeometry?.spatialReference || view.spatialReference
    };


    const graphic = new Graphic({
        geometry: point,
        symbol: {
            type: "simple-marker",
            color: [255, 0, 0, 0.8], // Red with transparency
            size: "16px", // Larger size
            outline: {
                color: [255, 255, 255, 1], // White outline
                width: 3
            }
        }
    });

    cursorLayer.add(graphic);
}

function findNearestSample(point) {
    if (!currentRouteSamples) return null;

    let minDist = Infinity;
    let nearest = null;

    for (const sample of currentRouteSamples) {
        const dx = sample.x - point.x;
        const dy = sample.y - point.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
            minDist = dist;
            nearest = sample;
        }
    }
    return nearest;
}


export async function selectRoute(objectId) {

    const feature = await fetchRouteGeometry(objectId);

    if (feature) {
        routeLayer.removeAll();
        cursorLayer.removeAll();

        const graphic = new Graphic({
            geometry: feature.geometry,
            symbol: {
                type: "simple-line",
                color: [0, 0, 255],
                width: 3
            },
            attributes: feature.attributes
        });

        routeLayer.add(graphic);
        currentRouteGeometry = feature.geometry;

        view.goTo(feature.geometry.extent.expand(1.2));
        document.dispatchEvent(new CustomEvent("routeSelected", { detail: feature.attributes }));

        const container = document.getElementById("chart-container");
        container.classList.add("active");

        try {
            const elevationResult = await map.ground.queryElevation(feature.geometry);

            const paths = elevationResult.geometry.paths[0];

            // Calculate geodesic distances properly
            const samples = [];
            let cumulativeDistance = 0; // in meters

            for (let i = 0; i < paths.length; i++) {
                const point = paths[i];

                if (i > 0) {
                    // Create a segment from previous point to current point
                    const segment = {
                        type: "polyline",
                        paths: [[paths[i - 1], point]],
                        spatialReference: elevationResult.geometry.spatialReference
                    };
                    // Calculate geodesic length in meters
                    const segmentLength = geometryEngine.geodesicLength(segment, "meters");
                    cumulativeDistance += segmentLength;
                }

                samples.push({
                    x: point[0],
                    y: point[1],
                    elevation: point[2],
                    distance: cumulativeDistance / 1000 // Convert to km
                });
            }

            currentRouteSamples = samples;

            const distances = samples.map(s => s.distance);
            const elevations = samples.map(s => s.elevation);


            updateChartData(distances, elevations);

        } catch (error) {
            console.error("!!! Error querying elevation !!!", error);
        }
    }
}

export function zoomToGraphics(graphics) {
    if (graphics && graphics.length > 0) {
        view.goTo(graphics);
    }
}
