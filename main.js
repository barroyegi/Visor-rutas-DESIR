import "@arcgis/core/assets/esri/themes/light/main.css";
import { initializeMap, renderStartPoints, filterStartPoints, zoomToGraphics, onExtentChange, selectRouteGroup } from './src/map.js';
import { fetchRoutesList, fetchStartPoints } from './src/data.js';
import { renderTable, renderRoutesError, initFilters, renderRouteDetails, renderRouteDetailsLoading, renderRouteDetailsError, setupMobileFilters } from './src/ui.js';
import { initLanguageSwitcher } from './src/i18n.js';
import { config } from './src/config.js';

/**
 * Applies the saved (or system-preferred) colour theme and wires the toggle.
 */
function initTheme() {
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    root.setAttribute("data-theme", theme);

    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
        toggle.addEventListener("click", () => {
            const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            root.setAttribute("data-theme", next);
            localStorage.setItem("theme", next);
            document.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme: next } }));
        });
    }
}

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
    // Apply theme and show the loading skeleton before anything slow runs.
    initTheme();
    renderTable([], "routes-list", new Map(), true);

    // 1. Initialize Map
    const view = await initializeMap("viewDiv");

    // Initialize Language Switcher
    initLanguageSwitcher();

    // 2. Fetch Data
    let routes;
    try {
        routes = await fetchRoutesList();
    } catch (error) {
        console.error("Error fetching routes list:", error);
        renderRoutesError("routes-list", () => location.reload());
        return;
    }

    // Build variant groups (all routes, unfiltered)
    const allVariantGroups = buildVariantGroups(routes);

    // 3. Fetch and Render Start Points on Map
    const startPoints = await fetchStartPoints();

    await renderStartPoints(startPoints);

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
        // Clear previous selection and UI
        document.dispatchEvent(new CustomEvent("clearSelection"));
        renderRouteDetails(null);
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
    setupMobileFilters();

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
        // Find the full variant group for this OBJECTID
        let selectedVariants = null;
        for (const [cod, variants] of allVariantGroups) {
            if (variants.find(v => Number(v.OBJECTID) === objectId)) {
                selectedVariants = variants;
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

    // 7. Listen for route group loading/selection/error (fired by selectRouteGroup)
    let currentVariants = [];
    let lastGroupSelection = null; // { objectId, variants } for retry

    document.addEventListener("routeGroupLoading", (e) => {
        // Remember what was clicked so the error state can offer a retry.
        lastGroupSelection = { objectId: e.detail.selectedObjectId, variants: e.detail.allVariants };
        // Show the panel with a spinner immediately, before geometry arrives.
        renderRouteDetailsLoading();
    });

    document.addEventListener("routeGroupSelected", (e) => {
        currentRoute = e.detail.selectedAttributes;
        currentVariants = e.detail.allVariants;
        renderRouteDetails(e.detail.selectedAttributes, e.detail.allVariants);
    });

    document.addEventListener("routeGroupError", () => {
        renderRouteDetailsError(lastGroupSelection
            ? () => selectRouteGroup(lastGroupSelection.objectId, lastGroupSelection.variants)
            : null);
    });

    document.addEventListener("clearSelection", () => {
        currentRoute = null;
    });

    // 7. Listen for language change
    document.addEventListener("languageChanged", () => {
        updateDisplay();

        // Only re-render details if the details container is currently active
        const detailsContainer = document.querySelector(".details-container");
        if (detailsContainer && detailsContainer.classList.contains("active")) {
            renderRouteDetails(currentRoute, currentVariants);
        }
    });
}

init();

