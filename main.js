import { initializeMap, renderStartPoints, filterStartPoints, zoomToGraphics, onExtentChange } from './src/map.js';
import { fetchRoutesList, fetchStartPoints } from './src/data.js';
import { renderTable, initFilters, renderRouteDetails } from './src/ui.js';
import { initLanguageSwitcher } from './src/i18n.js';
import { config } from './src/config.js';

async function init() {
    console.log("Initializing application...");

    // 1. Initialize Map
    const view = await initializeMap("viewDiv");
    console.log("Map initialized");

    // Initialize Language Switcher
    initLanguageSwitcher();

    // 2. Fetch Data
    const routes = await fetchRoutesList();
    console.log("Routes fetched:", routes);

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

        console.log(`[UpdateDisplay] Filtered routes: ${filteredRoutes.length}, Visible map IDs: ${visibleIds.size}, Intersection: ${finalRoutes.length}`);

        if (finalRoutes.length === 0 && filteredRoutes.length > 0) {
            console.warn(`[UpdateDisplay] Intersection empty! Showing all filtered routes as fallback.`);
            // Fallback: if extent sync is failing for some reason, show all filtered routes
            // but log the details for debugging
            if (visibleIds.size > 0) {
                const sampleFilteredId = filteredRoutes[0].OBJECTID;
                const sampleVisibleId = Array.from(visibleIds)[0];
                console.warn(`Sample filtered ID: ${sampleFilteredId} (type: ${typeof sampleFilteredId})
                    Sample visible ID: ${sampleVisibleId} (type: ${typeof sampleVisibleId})`);
            }
            renderTable(filteredRoutes, "routes-list", isInitialLoad);
        } else {
            renderTable(finalRoutes, "routes-list", isInitialLoad);
        }
        isInitialLoad = false;
    };

    // 4. Aplicar filtro inicial de distancia (0-100km) y poblar el listado
    // Lo hacemos con un pequeño retardo para asegurar que la vista del mapa esté lista
    setTimeout(async () => {
        const initialFilteredRoutes = routes.filter(r => {
            const dist = r[config.fields.distance];
            return dist !== null && dist !== undefined && dist >= 0 && dist <= 100;
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
    }, 500);


    // 5. Initialize Filters
    initFilters(routes, async (newFilteredRoutes) => {
        console.log("Filter applied, new count:", newFilteredRoutes.length);
        isFiltering = true;
        filteredRoutes = newFilteredRoutes;

        // Filter map points using FeatureFilter (SDK approach - no add/delete)
        const filteredIds = newFilteredRoutes.map(r => r.OBJECTID);
        filterStartPoints(filteredIds.length > 0 ? filteredIds : []);

        // Update visibleIds to match filtered set
        visibleIds = new Set(filteredIds.map(id => String(id)));
        updateDisplay();

        console.log("Zooming to filtered points...");
        const filteredStartPoints = startPoints.filter(sp => visibleIds.has(String(sp.attributes.OBJECTID)));
        if (filteredStartPoints.length > 0) {
            await zoomToGraphics(filteredStartPoints);
            setTimeout(() => { isFiltering = false; }, 1000);
            updateDisplay();
        } else {
            isFiltering = false;
            updateDisplay();
        }
        console.log("Filter application complete.");
    });

    // 6. Listen for Map Extent Changes
    onExtentChange((newVisibleIds) => {
        if (isFiltering) {
            console.log("Extent changed but ignoring because filter is being applied.");
            return;
        }
        console.log("Extent changed, visible points:", newVisibleIds.length);
        visibleIds = new Set(newVisibleIds.map(id => String(id)));
        updateDisplay();
    });

    // 6. Listen for route selection (from Map or Table)
    let currentRoute = null;
    document.addEventListener("routeSelected", (e) => {
        currentRoute = e.detail;
        renderRouteDetails(currentRoute);
    });

    document.addEventListener("clearSelection", () => {
        currentRoute = null;
    });

    // 7. Listen for language change
    document.addEventListener("languageChanged", () => {
        console.log("Language changed, re-rendering...");
        updateDisplay();

        // Only re-render details if the details container is currently active
        const detailsContainer = document.querySelector(".details-container");
        if (currentRoute && detailsContainer && detailsContainer.classList.contains("active")) {
            renderRouteDetails(currentRoute);
        }
    });
}

init();

