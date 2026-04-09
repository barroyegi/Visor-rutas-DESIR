import { initializeMap, renderStartPoints, filterStartPoints, zoomToGraphics, onExtentChange, selectRouteGroup } from './src/map.js';
import { fetchRoutesList, fetchStartPoints } from './src/data.js';
import { renderTable, initFilters, renderRouteDetails } from './src/ui.js';
import { initLanguageSwitcher } from './src/i18n.js';
import { config } from './src/config.js';

/**
 * Groups routes by cod_ruta. Returns a Map: cod_ruta (string) → [route, ...]
 * Routes without cod_ruta get their own group keyed by OBJECTID.
 */
function buildVariantGroups(routes) {
    const groups = new Map();
    for (const route of routes) {
        const cod = route[config.fields.routeCode] ?? `_${route.OBJECTID}`;
        if (!groups.has(cod)) groups.set(cod, []);
        groups.get(cod).push(route);
    }
    return groups;
}


async function init() {
    console.log("Inicializando aplicacion...");

    // 1. Initialize Map
    const view = await initializeMap("viewDiv");
    console.log("Mapa inicializado");

    // Initialize Language Switcher
    initLanguageSwitcher();

    // 2. Fetch Data
    const routes = await fetchRoutesList();
    console.log("Rutas obtenidas:", routes);

    // Build variant groups (all routes, unfiltered)
    const allVariantGroups = buildVariantGroups(routes);

    // 3. Fetch and Render Start Points on Map
    const startPoints = await fetchStartPoints();

    await renderStartPoints(startPoints);
    console.log("Start point definidos")

    let filteredRoutes = routes;
    let visibleIds = new Set(routes.map(r => String(r.OBJECTID)));
    let isInitialLoad = true;
    let isFiltering = false;

    const updateDisplay = () => {
        const finalRoutes = filteredRoutes.filter(r => {
            const hasMatch = visibleIds.has(String(r.OBJECTID));
            return hasMatch;
        });

        // Show one representative per cod_ruta group
        const seenCodes = new Set();
        const deduped = finalRoutes.filter(r => {
            const cod = r[config.fields.routeCode] ?? `_${r.OBJECTID}`;
            if (seenCodes.has(cod)) return false;
            seenCodes.add(cod);
            return true;
        });

        if (deduped.length === 0 && filteredRoutes.length > 0) {
            console.warn(`[UpdateDisplay] Intersection empty! Showing all filtered routes as fallback.`);
            renderTable(filteredRoutes, "routes-list", allVariantGroups, isInitialLoad);
        } else {
            renderTable(deduped, "routes-list", allVariantGroups, isInitialLoad);
        }
        isInitialLoad = false;
    };

    // 4. Aplicar filtro inicial de distancia (0-100km) y poblar el listado
    // Lo hacemos con un pequeño retardo para asegurar que la vista del mapa esté lista
    const initialFilteredRoutes = routes.filter(r => {
        const distKm = r[config.fields.distance];
        if (distKm == null || isNaN(distKm)) return true;
        return distKm >= 0;
    });

    isFiltering = true;
    filteredRoutes = initialFilteredRoutes;
    visibleIds = new Set(initialFilteredRoutes.map(r => String(r.OBJECTID)));

    // Aplicar filtro de la SDK (FeatureFilter)
    await filterStartPoints(initialFilteredRoutes.map(r => r.OBJECTID));

    isInitialLoad = false; // Quitar estado de carga para el renderizado real
    updateDisplay();

    // Liberar el bloqueo de filtrado tras un momento para permitir sincronización de extensión del mapa
    setTimeout(() => { isFiltering = false; }, 1000);


    // 5. Initialize Filters
    initFilters(routes, async (newFilteredRoutes) => {
        isFiltering = true;
        filteredRoutes = newFilteredRoutes;

        // Filter map points using FeatureFilter (SDK approach - no add/delete)
        const filteredIds = newFilteredRoutes.map(r => r.OBJECTID);
        filterStartPoints(filteredIds.length > 0 ? filteredIds : []);

        // Update visibleIds to match filtered set
        visibleIds = new Set(filteredIds.map(id => String(id)));
        updateDisplay();

        const filteredStartPoints = startPoints.filter(sp => visibleIds.has(String(sp.attributes.OBJECTID)));
        if (filteredStartPoints.length > 0) {
            await zoomToGraphics(filteredStartPoints);
            setTimeout(() => { isFiltering = false; }, 1000);
            updateDisplay();
        } else {
            isFiltering = false;
            updateDisplay();
        }
    });

    // 6. Listen for Map Extent Changes
    onExtentChange((newVisibleIds) => {
        if (isFiltering) {
            return;
        }
        visibleIds = new Set(newVisibleIds.map(id => String(id)));
        updateDisplay();
    });

    // 6. Listen for click on a map start point
    let currentRoute = null;
    document.addEventListener("mapStartPointClicked", (e) => {
        const objectId = Number(e.detail);
        console.log(`[MapClick] Start point clicked, OID: ${objectId}`);
        // Find the full variant group for this OBJECTID
        let selectedVariants = null;
        for (const [cod, variants] of allVariantGroups) {
            if (variants.find(v => Number(v.OBJECTID) === objectId)) {
                selectedVariants = variants;
                console.log(`[MapClick] Found group: ${cod} (${variants.length} variant(s))`);
                break;
            }
        }
        if (selectedVariants) {
            selectRouteGroup(objectId, selectedVariants);
        } else {
            console.warn(`[MapClick] No group found for OID: ${objectId}. Falling back to single-route call.`);
            // Fallback: treat as solo route using the minimal attribute set
            selectRouteGroup(objectId, [{ OBJECTID: objectId }]);
        }
    });

    // 7. Listen for route group selection (fires after selectRouteGroup completes)
    let currentVariants = [];
    document.addEventListener("routeGroupSelected", (e) => {
        currentRoute = e.detail.selectedAttributes;
        currentVariants = e.detail.allVariants;
        renderRouteDetails(e.detail.selectedAttributes, e.detail.allVariants);
    });

    document.addEventListener("clearSelection", () => {
        currentRoute = null;
    });

    // 7. Listen for language change
    document.addEventListener("languageChanged", () => {
        console.log("Idioma cambiado, re-renderizando...");
        updateDisplay();

        // Only re-render details if the details container is currently active
        const detailsContainer = document.querySelector(".details-container");
        if (detailsContainer && detailsContainer.classList.contains("active")) {
            renderRouteDetails(currentRoute, currentVariants);
        }
    });
}

init();

