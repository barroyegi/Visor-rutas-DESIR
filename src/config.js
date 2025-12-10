/**
 * Configuration for ArcGIS Online resources
 */
export const config = {
    // URL of the Feature Layer containing the hiking routes (Polylines)
    // This layer must contain fields: Name, Distance, ElevationGain, Difficulty, Duration
    routesLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/P73_FL_SenderosGR11_GR10_GRT/FeatureServer/0",

    // Capa de puntos. En este caso es el mismo, y se generan los puntos con el punto inicial de cada ruta 
    startPointsLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/P73_FL_SenderosGR11_GR10_GRT/FeatureServer/0",

    // API Key for ArcGIS (Caduca diciembre 2026)
    apiKey: "***REMOVED-ARCGIS-API-KEY***",

    // Nombres de campos
    fields: {
        name: "Nombre",
        distance: "Longitud",
        elevation: "ELEVATION",
        difficulty: "Dificultad",
        duration: "TiempoEstimado",
        desnivel_pos: "Desnivel_pos",
        xStart: "XStart",
        yStart: "YStart"
    },
    navarraFeatureService: {
        // Replace this URL with your ArcGIS Online Feature Service URL
        // Example: "https://services.arcgis.com/YOUR_ORG/arcgis/rest/services/YOUR_SERVICE/FeatureServer/0"
        url: "YOUR_FEATURE_SERVICE_URL_HERE"
    }
};
