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
let allRoutesLayer;
let allRoutesLayerView;
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

    // Cursor pointer al pasar por startPointsLayer.
    // Throttled to one update per animation frame (mousemove/hitTest fire far
    // more often than the screen redraws), and guarded with a token so a
    // slower, stale hitTest can't overwrite the result of a more recent move.
    let pointerMoveToken = 0;
    let pointerMoveRafScheduled = false;
    let latestPointerMoveEvent = null;

    const handlePointerMove = async (evt) => {
        const token = ++pointerMoveToken;
        const hit = await view.hitTest(evt, { include: [startPointsLayer] });
        if (token !== pointerMoveToken) return; // superseded by a newer move

        const graphic = hit.results.filter(r => r.graphic.layer === startPointsLayer)[0]?.graphic;

        if (graphic) {
            view.container.style.cursor = "pointer";
            highlightPoint(graphic.attributes.OBJECTID || graphic.attributes.routeId);

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
    };

    view.on("pointer-move", evt => {
        latestPointerMoveEvent = evt;
        if (pointerMoveRafScheduled) return;
        pointerMoveRafScheduled = true;
        requestAnimationFrame(() => {
            pointerMoveRafScheduled = false;
            handlePointerMove(latestPointerMoveEvent);
        });
    });

    // Layer for Start Points (FeatureLayer for clustering support)
    startPointsLayer = new FeatureLayer({
        source: [], // Initially empty
        outFields: ["*"], // Forces layer view to keep all attributes for hitTest
        geometryType: "point",
        spatialReference: { wkid: 4326 },
        objectIdField: "_internalId",
        fields: [
            { name: "_internalId", type: "oid" },
            { name: "routeId", type: "integer" },
            { name: "OBJECTID", type: "integer" },
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
        }
        if (event.layer === allRoutesLayer) {
            allRoutesLayerView = event.layerView;
        }
    });

    // Layer for all routes (polylines) - initialized similarly to startPointsLayer
    allRoutesLayer = new FeatureLayer({
        source: [],
        outFields: ["*"],
        geometryType: "polyline",
        spatialReference: { wkid: 4326 },
        objectIdField: "_internalId",
        fields: [
            { name: "_internalId", type: "oid" },
            { name: "OBJECTID", type: "integer" }
        ],
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-line",
                color: [80, 80, 80, 0.8], // More visible background routes
                width: 2.5
            }
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
                await reactiveUtils.whenOnce(() => map.basemap && typeof map.basemap !== "string");
            }
            if (!map.basemap.loaded) {
                await map.basemap.load();
            }

            if (map.basemap.referenceLayers) {
                // Move them: Collection.add automatically removes them from any previous parent/collection
                map.basemap.referenceLayers.addMany([allRoutesLayer, routeLayer, cursorLayer, startPointsLayer]);
            } else {
                console.warn("[TopLayers] referenceLayers not found, adding to map top");
                map.removeMany([allRoutesLayer, routeLayer, cursorLayer, startPointsLayer]);
                map.addMany([allRoutesLayer, routeLayer, cursorLayer, startPointsLayer]);
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
        const response = await view.hitTest(event, { include: [startPointsLayer] });
        if (response.results.length > 0) {
            const graphic = response.results.filter(r => r.graphic.layer === startPointsLayer)[0]?.graphic;
            if (graphic && !graphic.isAggregate) {
                const objectId = graphic.attributes.OBJECTID || graphic.attributes.routeId;
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
        filterStartPointsByCodRuta(null);
    });

    return view;
}


let highlightedGraphic = null;

export function highlightPoint(objectId) {
    if (highlightedGraphic && highlightedGraphic.attributes.routeId === objectId) return;

    removeHighlight();


    const query = {
        where: `routeId = ${objectId}`,
        returnGeometry: true,
        outFields: ["*"]
    };

    startPointsLayer.queryFeatures(query).then(result => {
        if (result.features.length > 0) {
            highlightedGraphic = result.features[0];
            const symbol = highlightedGraphic.symbol.clone();
            symbol.width = "40px";
            symbol.height = "40px";
            highlightedGraphic.symbol = symbol;
        }
    });
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
    const allPointGraphics = await startPointsLayer.queryFeatures();
    const allRouteGraphics = await allRoutesLayer.queryFeatures();

    const pointGraphics = [];
    const routeGraphics = [];

    features.forEach(f => {
        let pointGeometry = f.geometry;
        let polylineGeometry = null;

        if (f.geometry.type === "polyline") {
            pointGeometry = f.geometry.getPoint(0, 0);
            polylineGeometry = f.geometry;
        }

        const attributes = { ...f.attributes };
        const rawId = f.attributes.OBJECTID ?? f.attributes.objectid ?? f.attributes.FID ?? f.attributes.id;
        attributes.routeId = (rawId !== undefined && rawId !== null) ? Number(rawId) : NaN;
        attributes.OBJECTID = attributes.routeId;

        pointGraphics.push(new Graphic({
            geometry: pointGeometry,
            attributes: attributes
        }));

        if (polylineGeometry) {
            routeGraphics.push(new Graphic({
                geometry: polylineGeometry,
                attributes: { _internalId: attributes._internalId, OBJECTID: attributes.OBJECTID }
            }));
        }
    });

    // Update both layers
    await Promise.all([
        startPointsLayer.applyEdits({
            deleteFeatures: allPointGraphics.features.length > 0 ? allPointGraphics.features : [],
            addFeatures: pointGraphics
        }),
        allRoutesLayer.applyEdits({
            deleteFeatures: allRouteGraphics.features.length > 0 ? allRouteGraphics.features : [],
            addFeatures: routeGraphics
        })
    ]);
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


export function zoomToGraphics(graphics) {
    if (graphics && graphics.length > 0) {
        view.goTo(graphics);
    }
}

export async function filterStartPoints(objectIds) {
    // Wait for layerViews to be ready before applying filter
    if (!startPointsLayerView || !allRoutesLayerView) {
        await Promise.all([
            reactiveUtils.whenOnce(() => !!startPointsLayerView),
            reactiveUtils.whenOnce(() => !!allRoutesLayerView)
        ]);
    }

    // Coerce to numbers so only valid IDs ever reach the SQL-like `where`
    // clause sent to the ArcGIS REST service.
    const validIds = objectIds === null ? null : objectIds.map(Number).filter(Number.isFinite);
    const filterObj = validIds === null ? null : new FeatureFilter({
        where: validIds.length > 0 ? `OBJECTID IN (${validIds.join(',')})` : `1=0`
    });

    startPointsLayerView.filter = filterObj;
    allRoutesLayerView.filter = filterObj;
}

export async function filterStartPointsByCodRuta(codRuta) {
    if (!startPointsLayerView) {
        await reactiveUtils.whenOnce(() => !!startPointsLayerView);
    }

    if (!codRuta) {
        // Remove effect: show all features (that pass the main filter)
        startPointsLayerView.featureEffect = null;
    } else {
        // Escape single quotes so codRuta can't break out of the string
        // literal in the SQL-like `where` clause.
        const escapedCodRuta = String(codRuta).replace(/'/g, "''");
        startPointsLayerView.featureEffect = {
            filter: {
                where: `cod_ruta = '${escapedCodRuta}'`
            },
            excludedEffect: "opacity(0)"
        };
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
                const visibleIds = results.features.map(f => f.attributes.OBJECTID || f.attributes.routeId);
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

    if (polyline && polyline.hasZ) {
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
        view.goTo(groupExtent.expand(1.2), { padding: { top: 40, left: 40, right: 40, bottom: 220 } });
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
        view.goTo(groupExtent.expand(1.2), { padding: { top: 40, left: 40, right: 40, bottom: 40 } });
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

