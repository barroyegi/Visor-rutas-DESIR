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

    try {
        const results = await layer.queryFeatures(query);
        return results.features.map(f => f.attributes);
    } catch (error) {
        console.error("Error fetching routes list:", error);
        return [];
    }
}

/**
 * Fetches the full geometry for a specific route by ID (OBJECTID).
 */
export async function fetchRouteGeometry(objectId) {
    const layer = new FeatureLayer({
        url: config.routesLayerUrl,
        apiKey: config.apiKey
    });

    const query = new Query();
    query.objectIds = [objectId];
    query.returnGeometry = true;
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
        query.returnGeometry = false; // We construct geometry manually
        query.outFields = [config.fields.name, "OBJECTID", config.fields.xStart, config.fields.yStart];

        const results = await layer.queryFeatures(query);

        return results.features.map(f => {
            const x = f.attributes[config.fields.xStart];
            const y = f.attributes[config.fields.yStart];

            if (x != null && y != null) {
                const point = new Point({
                    x: x,
                    y: y,
                    spatialReference: layer.spatialReference
                });

                return new Graphic({
                    geometry: point,
                    attributes: f.attributes
                });
            }
            return null;
        }).filter(g => g !== null);

    } catch (error) {
        console.error("Error fetching start points:", error);
        return [];
    }
}
