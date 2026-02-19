/**
 * Configuration for ArcGIS Online resources
 */
export const config = {
    // URL of the Feature Layer containing the hiking routes (Polylines)
    // This layer must contain fields: Name, Distance, ElevationGain, Difficulty, Duration
    routesLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/Senderos_Nafarmendi/FeatureServer/0",

    // Capa de puntos. En este caso es el mismo, y se generan los puntos con el punto inicial de cada ruta 
    startPointsLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/Senderos_Nafarmendi/FeatureServer/0",

    // API Key for ArcGIS (Caduca diciembre 2026)
    apiKey: "AAPTxy8BH1VEsoebNVZXo8HurHGgNl8nviSaJX7VdixHvIh2A3CkX5h3TXOcFHYUrh94cgnUzthWA6sHK3U3s79_0ZbPgcwGwmvp3awa53UgDsVm0Wop4owpK5Lnz_u5GAHKz7l2A2NQ25WaDLwbBL761TOsogRpJxYoffOYMuBl2o4oS5NkrTjMLyu_YTpUat_hsfbKNOkErubB3qFtme-8WTvpjGzYPOPGrQI-tF-5Too.AT1_OdijBCA8",

    // Nombres de campos
    fields: {
        name: "name_1",
        distance: "longitud_km",
        elevation: "pos_elev",
        difficulty: "mide_difficulty",
        duration: "time_one_way",
        desnivel_pos: "pos_elev",
        elevationProfile: "elevation_profile",
        images: "images",
        xStart: "XStart",
        yStart: "YStart",
        downloadUrl: "URL_Descarga",
        routeCode: "cod_ruta",
        matricula: "Matricula",
        // Language-specific field mappings
        description: {
            es: "description",
            fr: "Descripcion_fr",
            eus: "Descripcion_eus"
        },
        shortDesc: {
            es: "Desc_breve_es",
            fr: "Desc_breve_fr",
            eus: "Desc_breve_eus"
        }
    },
    navarraFeatureService: {
        // Replace this URL with your ArcGIS Online Feature Service URL
        // Example: "https://services.arcgis.com/YOUR_ORG/arcgis/rest/services/YOUR_SERVICE/FeatureServer/0"
        url: "YOUR_FEATURE_SERVICE_URL_HERE"
    }
};
