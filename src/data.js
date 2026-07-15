import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import Query from "@arcgis/core/rest/support/Query.js";
import Point from "@arcgis/core/geometry/Point.js";
import Graphic from "@arcgis/core/Graphic.js";
import { config } from "./config.js";

/**
 * Fetches the list of routes (attributes only, no geometry) for the table.
 */
export async function fetchRoutesList() {
    const layer = new FeatureLayer({
        url: config.routesLayerUrl,
        apiKey: config.apiKey
    });

    const query = new Query();
    query.where = "1=1"; // Fetch all
    query.outFields = ["*"]; // Fetch all fields (or specify config.fields values)
    query.returnGeometry = false;

    // Errors propagate so the caller can distinguish a real failure (show an
    // error state + retry) from a genuinely empty result set.
    const results = await layer.queryFeatures(query);
    return results.features.map(f => f.attributes);
}

/**
 * Fetches the full geometry for a specific route by ID (OBJECTID).
 */
// Singleton reutilizado por fetchRouteGeometry para evitar reinstanciar la capa en cada llamada
let _routesLayerSingleton = null;
function getRoutesLayer() {
    if (!_routesLayerSingleton) {
        _routesLayerSingleton = new FeatureLayer({
            url: config.routesLayerUrl,
            apiKey: config.apiKey
        });
    }
    return _routesLayerSingleton;
}

export async function fetchRouteGeometry(objectId) {
    const layer = getRoutesLayer();

    const query = new Query();
    query.objectIds = [objectId];
    query.returnGeometry = true;
    query.returnZ = true;
    query.returnM = true;
    query.outFields = ["*"];

    try {
        const results = await layer.queryFeatures(query);
        if (results.features.length > 0) {
            return results.features[0];
        }
        return null;
    } catch (error) {
        console.error("Error fetching route geometry:", error);
        return null;
    }
}

// Cache of already-fetched route geometries keyed by OBJECTID. Geometries never
// change during a session, so re-opening a route (or switching between the map
// point and the list card) can reuse the cached feature instead of hitting the
// network again. Callers only ever read feature.geometry/attributes, so sharing
// the same Graphic instances is safe.
const _geometryCache = new Map();

/**
 * Fetches the geometries for multiple routes, using a per-session cache.
 *
 * Only the OBJECTIDs missing from the cache are requested, and they come back in
 * a SINGLE request (Query.objectIds accepts an array). Errors propagate to the
 * caller so the UI can show an error state.
 *
 * @param {number[]} objectIds
 * @returns {Promise<Graphic[]>} features for the requested ids that exist (order not guaranteed)
 */
export async function fetchRouteGeometries(objectIds) {
    if (!objectIds || objectIds.length === 0) return [];

    const missing = objectIds.filter(id => !_geometryCache.has(id));

    if (missing.length > 0) {
        const layer = getRoutesLayer();
        const query = new Query();
        query.objectIds = missing;
        query.returnGeometry = true;
        query.returnZ = true;
        query.returnM = true;
        query.outFields = ["*"];

        const results = await layer.queryFeatures(query);
        for (const feature of results.features) {
            _geometryCache.set(feature.attributes.OBJECTID, feature);
        }
    }

    // Return one feature per requested id that actually resolved to geometry.
    return objectIds
        .map(id => _geometryCache.get(id))
        .filter(Boolean);
}

/**
 * Fetches start points for the map.
 * Uses XStart and YStart fields to construct the point geometry.
 */
export async function fetchStartPoints() {
    const layer = new FeatureLayer({
        url: config.startPointsLayerUrl,
        apiKey: config.apiKey
    });

    try {
        await layer.load(); // Load metadata to get spatialReference

        const query = new Query();
        query.where = "1=1";
        query.returnGeometry = true; // We need geometry for fallback
        query.outFields = [
            config.fields.name,
            "OBJECTID",
            config.fields.xStart,
            config.fields.yStart,
            "Variante",
            "longitud_km",
            config.fields.routeCode,
            config.fields.images,
            config.fields.matricula
        ];

        const results = await layer.queryFeatures(query);

        let invalidCount = 0;

        const graphics = results.features.map(f => {
            let x = f.attributes[config.fields.xStart];
            let y = f.attributes[config.fields.yStart];

            x = typeof x === 'string' ? parseFloat(x.trim()) : x;
            y = typeof y === 'string' ? parseFloat(y.trim()) : y;

            let pointGeometry;

            // Strict check: if x and y are exactly 0, they are likely empty defaults and should fallback to geometry
            if (x !== null && y !== null && !isNaN(x) && !isNaN(y) && !(x === 0 && y === 0)) {
                pointGeometry = new Point({
                    x: x,
                    y: y,
                    spatialReference: layer.spatialReference
                });
            } else if (f.geometry) {
                // Fallback: use the first point of the geometry
                if (f.geometry.type === "polyline") {
                    pointGeometry = f.geometry.getPoint(0, 0);
                } else if (f.geometry.type === "point") {
                    pointGeometry = f.geometry;
                }
            }

            if (pointGeometry) {
                return new Graphic({
                    geometry: pointGeometry,
                    attributes: f.attributes
                });
            }
            console.error(`[Diagnostic] data.js: Failed to create point geometry for route: "${f.attributes[config.fields.name]}" (OID: ${f.attributes.OBJECTID}). x=${x}, y=${y}, hasGeometry=${!!f.geometry}, geomType=${f.geometry ? f.geometry.type : 'none'}`);
            invalidCount++;
            return null;
        }).filter(g => g !== null);

        return graphics;

    } catch (error) {
        console.error("Error fetching start points:", error);
        return [];
    }
}
