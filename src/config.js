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
    apiKey: "AAPTxy8BH1VEsoebNVZXo8HurHGgNl8nviSaJX7VdixHvIh2A3CkX5h3TXOcFHYUrh94cgnUzthWA6sHK3U3s79_0ZbPgcwGwmvp3awa53UgDsVm0Wop4owpK5Lnz_u5GAHKz7l2A2NQ25WaDLwbBL761TOsogRpJxYoffOYMuBl2o4oS5NkrTjMLyu_YTpUat_hsfbKNOkErubB3qFtme-8WTvpjGzYPOPGrQI-tF-5Too.AT1_OdijBCA8",

    // Field Names Mapping (Adjust these to match your actual Feature Layer)
    fields: {
        name: "Nombre", // Example field
        distance: "Longitud",
        elevation: "ELEVATION", // Might not exist in example
        difficulty: "Dificultad", // Might not exist
        duration: "TiempoEstimado", // Might not exist
        xStart: "XStart",
        yStart: "YStart"
    },
    navarraWMS: {
        url: "https://idena.navarra.es/ogc/ows",
        layerName: "REFERE_Pol_Navarra"
    }
};
