/**
 * Configuration for ArcGIS Online resources
 */
export const config = {
    // URL of the Feature Layer containing the hiking routes (Polylines)
    routesLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/Senderos_Nafarmendi_03032026/FeatureServer/1",

    // Capa de puntos. En este caso es el mismo, y se generan los puntos con el punto inicial de cada ruta 
    startPointsLayerUrl: "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/Senderos_Nafarmendi_03032026/FeatureServer/1",

    // API Key for ArcGIS (Caduca diciembre 2026).
    // Set VITE_ARCGIS_API_KEY in a local .env file (see .env.example) for
    // development, and as an environment variable in your build/hosting
    // platform for production. Never commit the real key to git.
    apiKey: import.meta.env.VITE_ARCGIS_API_KEY,

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
        variantName: "Variante",
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

        url: "..."
    }
};
