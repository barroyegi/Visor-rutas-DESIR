import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import Graphic from "@arcgis/core/Graphic.js";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine.js";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery.js";
import Expand from "@arcgis/core/widgets/Expand.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import Search from "@arcgis/core/widgets/Search.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import Basemap from "@arcgis/core/Basemap.js";
import { config } from "./config.js";
import { fetchRouteGeometry } from "./data.js";
import { initChart, updateChartData, highlightChartPoint, clearChart } from "./chart.js";
import { prefetchImage } from "./ui.js";

let view;
let map;
let startPointsLayer;
let startPointsLayerView;
let startPointsLayerViewReady; // Promise that resolves when layerView is ready
let routeLayer;
let cursorLayer; // Layer for the map cursor

let currentRouteGeometry = null;
let currentRouteSamples = null;

export async function initializeMap(containerId) {
    const openTopoLayer = new WebTileLayer({
        urlTemplate: "https://{subDomain}.tile.opentopomap.org/{level}/{col}/{row}.png",
        subDomains: ["a", "b", "c"],
        copyright: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    });

    const openTopoBasemap = new Basemap({
        baseLayers: [openTopoLayer],
        title: "OpenTopoMap",
        id: "opentopomap",
        thumbnailUrl: "https://a.tile.opentopomap.org/13/4193/3091.png"
    });

    map = new Map({
        basemap: "hybrid",
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
                    color: [255, 255, 255], // Gray outline
                    width: 2
                }
            }
        },
        opacity: 1.0,
        popupEnabled: false
    });
    map.add(navarraLayer);

    // Basemap Gallery with custom source
    const basemapGallery = new BasemapGallery({
        view: view,
        source: [
            Basemap.fromId("topo-vector"),
            Basemap.fromId("hybrid"),
            Basemap.fromId("osm"),
            openTopoBasemap
        ]
    });

    const bgExpand = new Expand({
        view: view,
        content: basemapGallery
    });

    view.ui.add(bgExpand, "top-right");


    // Search Widget
    const searchWidget = new Search({
        view: view,
        allPlaceholder: "Buscar lugar...",
        popupEnabled: false,
        includeDefaultSources: true
    });

    view.ui.add(searchWidget, {
        position: "top-right",
        index: 0
    });

    // Inicializar el gráfico
    initChart("elevation-chart", (index) => {
        // Sincronización del gráfico con el mapa
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
            highlightPoint(graphic.attributes.routeId);

            // Pre-fetch image when hovering map point
            const imagesField = graphic.attributes[config.fields.images];
            if (imagesField) {
                const firstUrl = imagesField.split('|')[0]?.trim();
                if (firstUrl) prefetchImage(firstUrl);
            }
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
                    updateMapCursor(nearestPoint.coordinate.x, nearestPoint.coordinate.y);

                    const nearestSample = findNearestSample(nearestPoint.coordinate);
                    if (nearestSample) {
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
        spatialReference: { wkid: 4326 },
        objectIdField: "_internalId",
        fields: [
            { name: "_internalId", type: "oid" },
            { name: "routeId", type: "integer" },
            { name: "name_1", type: "string" },
            { name: "cod_ruta", type: "string" },
            { name: "images", type: "string" },
            { name: "Matricula", type: "string" },
            { name: "longitud_km", type: "double" },
            { name: "Variante", type: "string" }
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
        // featureReduction: {
        //     type: "cluster",
        //     clusterRadius: "100px",
        //     clusterMinSize: "24px",
        //     clusterMaxSize: "60px",
        //     maxScale: 100000,
        //     labelingInfo: [{
        //         deconflictionStrategy: "none",
        //         labelExpressionInfo: {
        //             expression: "$feature.cluster_count"
        //         },
        //         symbol: {
        //             type: "text",
        //             color: "black",
        //             haloColor: 'white',
        //             haloSize: '1.5px',
        //             font: {
        //                 weight: "bold",
        //                 size: "12px",
        //             }
        //         },
        //         labelPlacement: "center-center"
        //     }]
        // }
    });

    // Track LayerView for startPointsLayer automatically using reactiveUtils
    reactiveUtils.on(() => view, "layerview-create", (event) => {
        if (event.layer === startPointsLayer) {
            startPointsLayerView = event.layerView;
            console.log("[Map] startPointsLayerView updated");
        }
    });

    // Layer for Selected Route
    routeLayer = new GraphicsLayer();
    // Layer for Cursor
    cursorLayer = new GraphicsLayer();

    // Function to ensure our custom layers are above labels by moving them to basemap.referenceLayers
    const ensureCustomLayersOnTop = async () => {
        try {
            // Wait for basemap to be resolved and loaded
            if (typeof map.basemap === "string") {
                console.log(`[TopLayers] Waiting for basemap string "${map.basemap}" to resolve...`);
                await reactiveUtils.whenOnce(() => map.basemap && typeof map.basemap !== "string");
            }
            if (!map.basemap.loaded) {
                await map.basemap.load();
            }

            if (map.basemap.referenceLayers) {
                console.log(`[TopLayers] Moving to referenceLayers of ${map.basemap.title}`);
                // Move them: Collection.add automatically removes them from any previous parent/collection
                map.basemap.referenceLayers.addMany([routeLayer, cursorLayer, startPointsLayer]);
            } else {
                console.warn("[TopLayers] referenceLayers not found, adding to map top");
                map.removeMany([routeLayer, cursorLayer, startPointsLayer]);
                map.addMany([routeLayer, cursorLayer, startPointsLayer]);
            }
        } catch (e) {
            console.error("[TopLayers] Error:", e);
        }
    };

    // Watch for basemap changes (from gallery) to maintain topmost position
    reactiveUtils.watch(() => map.basemap, (basemap) => {
        if (basemap) {
            ensureCustomLayersOnTop();
        }
    });

    // Initial call
    ensureCustomLayersOnTop();

    view.on("click", async (event) => {
        const response = await view.hitTest(event);
        if (response.results.length > 0) {
            const graphic = response.results.filter(r => r.graphic.layer === startPointsLayer)[0]?.graphic;
            if (graphic && !graphic.isAggregate) {
                const objectId = graphic.attributes.routeId;
                document.dispatchEvent(new CustomEvent("mapStartPointClicked", { detail: objectId }));
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
    if (highlightedGraphic && highlightedGraphic.attributes.routeId === objectId) return;

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
    if (features && features.length > 0) {
        console.log("[Render] First feature attributes sample:", features[0].attributes);
    }
    // For FeatureLayer, we use applyEdits to update features
    const allGraphics = await startPointsLayer.queryFeatures();

    const graphics = features.map(f => {
        let pointGeometry = f.geometry;

        if (f.geometry.type === "polyline") {
            pointGeometry = f.geometry.getPoint(0, 0);
        }

        const attributes = { ...f.attributes };

        // Robust ID lookup: try different standard field names
        const rawId = f.attributes.OBJECTID ?? f.attributes.objectid ?? f.attributes.FID ?? f.attributes.id;
        attributes.routeId = (rawId !== undefined && rawId !== null) ? Number(rawId) : NaN;

        if (isNaN(attributes.routeId)) {
            console.error("[Render] Feature has no identifiable ID field:", f.attributes);
        }

        return new Graphic({
            geometry: pointGeometry,
            attributes: attributes
        });
    });

    // Atomic operation: delete existing and add new in a single applyEdits call
    // This avoids the intermediate empty state that triggers onExtentChange with 0 features
    await startPointsLayer.applyEdits({
        deleteFeatures: allGraphics.features.length > 0 ? allGraphics.features : [],
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
            const polyline = feature.geometry;

            if (polyline && polyline.hasZ) {
                console.log(`[Elevation Profile] Source: Geometry Z/M values for route OID: ${objectId}`);
                let cumulativeDistance = 0;
                let lastVertex = null;

                for (let p = 0; p < polyline.paths.length; p++) {
                    const path = polyline.paths[p];
                    for (let i = 0; i < path.length; i++) {
                        const vertex = path[i];
                        const x = vertex[0];
                        const y = vertex[1];
                        const z = vertex[2];
                        const m = (polyline.hasM && vertex.length > 3) ? vertex[3] : null;

                        if (i > 0) {
                            if (m !== null && m !== undefined && m !== -1) {
                                // Use M value if available and valid
                                cumulativeDistance = m;
                            } else {
                                // Calculate geodesic distance if M is missing or invalid
                                const segment = {
                                    type: "polyline",
                                    paths: [[path[i - 1], vertex]],
                                    spatialReference: polyline.spatialReference
                                };
                                cumulativeDistance += geometryEngine.geodesicLength(segment, "meters");
                            }
                        } else if (p > 0 && lastVertex) {
                            // Link paths for multipart geometries
                            const gapSegment = {
                                type: "polyline",
                                paths: [[lastVertex, vertex]],
                                spatialReference: polyline.spatialReference
                            };
                            cumulativeDistance += geometryEngine.geodesicLength(gapSegment, "meters");
                        }

                        samples.push({
                            x: x,
                            y: y,
                            elevation: z,
                            distance: cumulativeDistance / 1000 // KM
                        });
                        lastVertex = vertex;
                    }
                }
            }

            // Fallback to elevation_profile attribute ONLY if geometry didn't provide points
            if (samples.length === 0) {
                const profileJson = feature.attributes[config.fields.elevationProfile];
                if (profileJson) {
                    console.log(`[Elevation Profile] Source: 'elevation_profile' attribute field (JSON) for route OID: ${objectId}`);
                    const profileData = JSON.parse(profileJson);
                    const path = polyline.paths[0];

                    let vertexDistances = [0];
                    let currentTotal = 0;
                    for (let i = 1; i < path.length; i++) {
                        const segment = {
                            type: "polyline",
                            paths: [[path[i - 1], path[i]]],
                            spatialReference: polyline.spatialReference
                        };
                        currentTotal += geometryEngine.geodesicLength(segment, "meters");
                        vertexDistances.push(currentTotal / 1000);
                    }

                    for (let i = 0; i < profileData.length; i++) {
                        const profileDist = profileData[i][0];
                        const elevation = profileData[i][1];
                        let x = path[0][0];
                        let y = path[0][1];
                        let found = false;

                        for (let j = 0; j < vertexDistances.length - 1; j++) {
                            if (profileDist >= vertexDistances[j] && profileDist <= vertexDistances[j + 1]) {
                                const ratio = (profileDist - vertexDistances[j]) / (vertexDistances[j + 1] - vertexDistances[j]);
                                x = path[j][0] + (path[j + 1][0] - path[j][0]) * ratio;
                                y = path[j][1] + (path[j + 1][1] - path[j][1]) * ratio;
                                found = true;
                                break;
                            }
                        }

                        if (!found && profileDist > vertexDistances[vertexDistances.length - 1]) {
                            x = path[path.length - 1][0];
                            y = path[path.length - 1][1];
                        }

                        samples.push({ x, y, distance: profileDist, elevation });
                    }
                }
            }

            if (samples.length === 0) {
                console.log(`[Elevation Profile] Source: Ground Elevation Query (API) for route OID: ${objectId}`);
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

export async function filterStartPoints(objectIds) {
    // Wait for layerView to be ready before applying filter
    if (!startPointsLayerView) {
        await reactiveUtils.whenOnce(() => !!startPointsLayerView);
    }

    if (objectIds === null) {
        // Remove filter: show all features
        startPointsLayerView.filter = null;
    } else {
        startPointsLayerView.filter = new FeatureFilter({
            objectIds: objectIds
        });
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
                const visibleIds = results.features.map(f => f.attributes.routeId);
                callback(visibleIds);
            } catch (error) {
                console.error("Error querying visible features:", error);
            }
        }
    });
}

// --- Route Group / Variants ---

/**
 * Builds elevation samples from a feature using Z/M geometry values.
 * Falls back to elevation_profile attribute, then to ground query.
 */
async function buildSamplesFromFeature(feature) {
    const samples = [];
    const polyline = feature.geometry;
    const objectId = feature.attributes.OBJECTID;

    if (polyline && polyline.hasZ) {
        console.log(`[Elevation Profile] Source: Geometry Z/M values for route OID: ${objectId}`);
        let cumulativeDistance = 0;
        let lastVertex = null;
        for (let p = 0; p < polyline.paths.length; p++) {
            const path = polyline.paths[p];
            for (let i = 0; i < path.length; i++) {
                const vertex = path[i];
                const x = vertex[0], y = vertex[1], z = vertex[2];
                const m = (polyline.hasM && vertex.length > 3) ? vertex[3] : null;
                if (i > 0) {
                    if (m !== null && m !== undefined && m !== -1) {
                        cumulativeDistance = m;
                    } else {
                        const seg = { type: "polyline", paths: [[path[i - 1], vertex]], spatialReference: polyline.spatialReference };
                        cumulativeDistance += geometryEngine.geodesicLength(seg, "meters");
                    }
                } else if (p > 0 && lastVertex) {
                    const gapSeg = { type: "polyline", paths: [[lastVertex, vertex]], spatialReference: polyline.spatialReference };
                    cumulativeDistance += geometryEngine.geodesicLength(gapSeg, "meters");
                }
                samples.push({ x, y, elevation: z, distance: cumulativeDistance / 1000 });
                lastVertex = vertex;
            }
        }
    }

    if (samples.length === 0) {
        const profileJson = feature.attributes[config.fields.elevationProfile];
        if (profileJson) {
            console.log(`[Elevation Profile] Source: 'elevation_profile' attribute for route OID: ${objectId}`);
            const profileData = JSON.parse(profileJson);
            const path = polyline.paths[0];
            let vertexDistances = [0], currentTotal = 0;
            for (let i = 1; i < path.length; i++) {
                const seg = { type: "polyline", paths: [[path[i - 1], path[i]]], spatialReference: polyline.spatialReference };
                currentTotal += geometryEngine.geodesicLength(seg, "meters");
                vertexDistances.push(currentTotal / 1000);
            }
            for (let i = 0; i < profileData.length; i++) {
                const profileDist = profileData[i][0], elevation = profileData[i][1];
                let x = path[0][0], y = path[0][1], found = false;
                for (let j = 0; j < vertexDistances.length - 1; j++) {
                    if (profileDist >= vertexDistances[j] && profileDist <= vertexDistances[j + 1]) {
                        const ratio = (profileDist - vertexDistances[j]) / (vertexDistances[j + 1] - vertexDistances[j]);
                        x = path[j][0] + (path[j + 1][0] - path[j][0]) * ratio;
                        y = path[j][1] + (path[j + 1][1] - path[j][1]) * ratio;
                        found = true; break;
                    }
                }
                if (!found && profileDist > vertexDistances[vertexDistances.length - 1]) {
                    x = path[path.length - 1][0]; y = path[path.length - 1][1];
                }
                samples.push({ x, y, distance: profileDist, elevation });
            }
        }
    }

    if (samples.length === 0) {
        console.log(`[Elevation Profile] Source: Ground Elevation Query (API) for route OID: ${objectId}`);
        const elevationResult = await map.ground.queryElevation(feature.geometry);
        const paths = elevationResult.geometry.paths[0];
        let cumulativeDistance = 0;
        for (let i = 0; i < paths.length; i++) {
            const point = paths[i];
            if (i > 0) {
                const seg = { type: "polyline", paths: [[paths[i - 1], point]], spatialReference: elevationResult.geometry.spatialReference };
                cumulativeDistance += geometryEngine.geodesicLength(seg, "meters");
            }
            samples.push({ x: point[0], y: point[1], elevation: point[2], distance: cumulativeDistance / 1000 });
        }
    }

    return samples;
}

// Stores all fetched features for the current group, keyed by OBJECTID
let currentGroupFeatures = {};

const ACTIVE_SYMBOL = { type: "simple-line", color: [0, 0, 255], width: 3, style: "solid" };
const DIM_SYMBOL = { type: "simple-line", color: [150, 150, 200], width: 2, style: "solid" };

/**
 * Loads and displays all route variants in a group.
 * @param {number} selectedObjectId - The variant to highlight. If null and there are multiple variants, none is selected.
 * @param {Array} allVariantAttributes - Array of route attribute objects for all variants.
 */
export async function selectRouteGroup(selectedObjectId, allVariantAttributes) {
    routeLayer.removeAll();
    cursorLayer.removeAll();
    currentGroupFeatures = {};

    const hasMultipleVariants = allVariantAttributes.length > 1;
    // If multiple variants and no explicit selection, open without selecting any
    const effectiveSelectedId = hasMultipleVariants ? null : selectedObjectId;

    const fetched = await Promise.all(allVariantAttributes.map(attr => fetchRouteGeometry(attr.OBJECTID)));

    for (const feature of fetched) {
        if (!feature) continue;
        currentGroupFeatures[feature.attributes.OBJECTID] = feature;
    }

    // Add unselected features first
    for (const feature of fetched) {
        if (!feature) continue;
        const isSelected = effectiveSelectedId !== null && feature.attributes.OBJECTID === effectiveSelectedId;
        if (!isSelected) {
            routeLayer.add(new Graphic({
                geometry: feature.geometry,
                symbol: DIM_SYMBOL,
                attributes: { OBJECTID: feature.attributes.OBJECTID }
            }));
        }
    }

    // Add selected feature last so it renders on top
    if (effectiveSelectedId !== null && currentGroupFeatures[effectiveSelectedId]) {
        routeLayer.add(new Graphic({
            geometry: currentGroupFeatures[effectiveSelectedId].geometry,
            symbol: ACTIVE_SYMBOL,
            attributes: { OBJECTID: effectiveSelectedId }
        }));
    }

    // Zoom to the combined extent of all variants in the group
    const allGeometries = Object.values(currentGroupFeatures).map(f => f.geometry);
    const groupExtent = allGeometries.reduce((acc, geom) => acc ? acc.union(geom.extent) : geom.extent, null);

    if (effectiveSelectedId !== null) {
        const selectedFeature = currentGroupFeatures[effectiveSelectedId];
        if (!selectedFeature) return;
        currentRouteGeometry = selectedFeature.geometry;
        view.goTo(groupExtent, { padding: { top: 40, left: 40, right: 40, bottom: 220 } });
        document.getElementById("chart-container").classList.add("active");

        document.dispatchEvent(new CustomEvent("routeGroupSelected", {
            detail: { selectedAttributes: selectedFeature.attributes, allVariants: allVariantAttributes }
        }));

        try {
            const samples = await buildSamplesFromFeature(selectedFeature);
            currentRouteSamples = samples;
            updateChartData(samples.map(s => s.distance), samples.map(s => s.elevation));
        } catch (error) {
            console.error("!!! Error processing elevation data !!!", error);
        }
    } else {
        // Multiple variants, none selected: zoom to group, open panel without variant selected
        currentRouteGeometry = null;
        view.goTo(groupExtent, { padding: { top: 40, left: 40, right: 40, bottom: 40 } });
        document.dispatchEvent(new CustomEvent("routeGroupSelected", {
            detail: { selectedAttributes: null, allVariants: allVariantAttributes }
        }));
    }
}

/**
 * Switches the active variant within the currently loaded group without re-fetching.
 * @param {number} newObjectId
 */
export async function switchVariant(newObjectId) {
    let focusGraphic = null;
    routeLayer.graphics.forEach(graphic => {
        const isSelected = graphic.attributes.OBJECTID === newObjectId;
        graphic.symbol = isSelected ? ACTIVE_SYMBOL : DIM_SYMBOL;
        if (isSelected) focusGraphic = graphic;
    });

    // Bring to front
    if (focusGraphic) {
        routeLayer.remove(focusGraphic);
        routeLayer.add(focusGraphic);
    }

    const selectedFeature = currentGroupFeatures[newObjectId];
    if (!selectedFeature) return;

    currentRouteGeometry = selectedFeature.geometry;
    cursorLayer.removeAll();

    // Ensure chart is visible when switching from general view
    document.getElementById("chart-container").classList.add("active");

    try {
        const samples = await buildSamplesFromFeature(selectedFeature);
        currentRouteSamples = samples;
        updateChartData(samples.map(s => s.distance), samples.map(s => s.elevation));
    } catch (error) {
        console.error("!!! Error switching variant !!!", error);
    }
}

/**
 * Clears the active variant selection, leaving all routes in the group dimmed.
 * Used to return to the general group view.
 */
export function clearVariantSelection() {
    routeLayer.graphics.forEach(graphic => {
        graphic.symbol = DIM_SYMBOL;
    });
    currentRouteGeometry = null;
    currentRouteSamples = null;
    cursorLayer.removeAll();
    document.getElementById("chart-container").classList.remove("active");
}

