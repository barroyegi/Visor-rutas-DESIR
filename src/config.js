/**
 * Configuration for ArcGIS Online resources
 */
export const config = {
    // URL of the Feature Layer containing the hiking routes (Polylines)
    // This layer must contain fields: Name, Distance, ElevationGain, Difficulty, Duration
    routesLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/P73_FL_SenderosGR11_GR10_GRT/FeatureServer/0", // Example public layer for dev

    // URL of the Feature Layer for Start Points. 
    // If not available, we can query the routes layer with returnGeometry=true (heavy) or use a separate point layer.
    // For this demo, we'll use the same layer and extract points or use a mock point layer if needed.
    startPointsLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/P73_FL_SenderosGR11_GR10_GRT/FeatureServer/0", // Using same for now

    // API Key for ArcGIS Platform (if layers are private or using basemaps that require it)
    // Get one at developers.arcgis.com
    apiKey: "***REMOVED-ARCGIS-API-KEY***",

    // Field Names Mapping (Adjust these to match your actual Feature Layer)
    fields: {
        name: "Nombre", // Example field
        distance: "Longitud",
        elevation: "ELEVATION", // Might not exist in example
        difficulty: "Dificultad", // Might not exist
        duration: "TiempoEstimado", // Might not exist
        xStart: "XStart",
        yStart: "YStart"
    }
};
