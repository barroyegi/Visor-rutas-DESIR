import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine.js";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery.js";
import Expand from "@arcgis/core/widgets/Expand.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
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
        ground: "world-elevation"
    });

    view = new MapView({
        container: containerId,
        map: map,
        center: [-1.6, 42.65], // Navarra aproximada
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

    // Basemap Gallery
    const basemapGallery = new BasemapGallery({
        view: view
    });

    const bgExpand = new Expand({
        view: view,
        content: basemapGallery
    });

    view.ui.add(bgExpand, "top-right");

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

    // Layer for Start Points (FeatureLayer for clustering support)
    startPointsLayer = new FeatureLayer({
        source: [], // Initially empty
        geometryType: "point",
        spatialReference: { wkid: 4326 }, // Web Mercator
        objectIdField: "OBJECTID",
        fields: [
            { name: "OBJECTID", type: "oid" },
            { name: "name_1", type: "string" }
        ],
        renderer: {
            type: "simple",
            symbol: {
                type: "picture-marker",
                url: "/icons/hiking.svg",
                width: "30px",
                height: "30px"
            }
        },
        featureReduction: {
            type: "cluster",
            clusterRadius: "100px",
            clusterMinSize: "24px",
            clusterMaxSize: "60px",
            maxScale: 100000,
            labelingInfo: [{
                deconflictionStrategy: "none",
                labelExpressionInfo: {
                    expression: "$feature.cluster_count"
                },
                symbol: {
                    type: "text",
                    color: "black",
                    haloColor: 'white',
                    haloSize: '1.5px',
                    font: {
                        weight: "bold",
                        size: "12px",
                    }
                },
                labelPlacement: "center-center"
            }]
        }
    });
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
            if (graphic && !graphic.isAggregate) {
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

export async function renderStartPoints(features) {
    // For FeatureLayer, we use applyEdits to update features
    const allGraphics = await startPointsLayer.queryFeatures();
    if (allGraphics.features.length > 0) {
        await startPointsLayer.applyEdits({
            deleteFeatures: allGraphics.features
        });
    }

    const graphics = features.map(f => {
        let pointGeometry = f.geometry;

        if (f.geometry.type === "polyline") {
            pointGeometry = f.geometry.getPoint(0, 0);
        }

        return new Graphic({
            geometry: pointGeometry,
            attributes: f.attributes
        });
    });

    await startPointsLayer.applyEdits({
        addFeatures: graphics
    });
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

        view.goTo(feature.geometry.extent.expand(1.5), { padding: { bottom: 300 } });
        document.dispatchEvent(new CustomEvent("routeSelected", { detail: feature.attributes }));

        const container = document.getElementById("chart-container");
        container.classList.add("active");

        try {
            let samples = [];
            const profileJson = feature.attributes[config.fields.elevationProfile];

            if (profileJson) {
                console.log("Using pre-calculated elevation profile");
                const profileData = JSON.parse(profileJson);
                const paths = feature.geometry.paths[0];

                // Map pre-calculated [dist, elev] to geometry points
                // We assume the profile data matches the geometry vertices 1:1
                for (let i = 0; i < paths.length && i < profileData.length; i++) {
                    samples.push({
                        x: paths[i][0],
                        y: paths[i][1],
                        distance: profileData[i][0],
                        elevation: profileData[i][1]
                    });
                }
            }

            if (samples.length === 0) {
                console.log("Generating elevation profile on the fly...");
                const elevationResult = await map.ground.queryElevation(feature.geometry);
                const paths = elevationResult.geometry.paths[0];

                let cumulativeDistance = 0; // in meters
                for (let i = 0; i < paths.length; i++) {
                    const point = paths[i];
                    if (i > 0) {
                        const segment = {
                            type: "polyline",
                            paths: [[paths[i - 1], point]],
                            spatialReference: elevationResult.geometry.spatialReference
                        };
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
            }

            currentRouteSamples = samples;
            const distances = samples.map(s => s.distance);
            const elevations = samples.map(s => s.elevation);

            updateChartData(distances, elevations);

        } catch (error) {
            console.error("!!! Error processing elevation data !!!", error);
        }
    }
}

export function zoomToGraphics(graphics) {
    if (graphics && graphics.length > 0) {
        view.goTo(graphics);
    }
}

export function onExtentChange(callback) {
    reactiveUtils.watch(() => view.stationary, async (stationary) => {
        if (stationary && view.extent) {
            const query = startPointsLayer.createQuery();
            query.geometry = view.extent;
            query.returnGeometry = false;
            query.outFields = ["*"];
            query.where = "1=1";

            try {
                const results = await startPointsLayer.queryFeatures(query);
                const visibleIds = results.features.map(f => f.attributes.OBJECTID);
                callback(visibleIds);
            } catch (error) {
                console.error("Error querying visible features:", error);
            }
        }
    });
}

