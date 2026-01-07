import './style.css';
import { initializeMap, renderStartPoints, zoomToGraphics } from './src/map.js';
import { fetchRoutesList, fetchStartPoints } from './src/data.js';
import { renderTable, initFilters, renderRouteDetails } from './src/ui.js';
import { initLanguageSwitcher } from './src/i18n.js';

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
    renderStartPoints(startPoints);

    // 4. Render Table
    renderTable(routes, "routes-list");

    // 5. Initialize Filters
    initFilters(routes, (filteredRoutes) => {
        renderTable(filteredRoutes, "routes-list");

        // Filter map points
        const filteredIds = new Set(filteredRoutes.map(r => r.OBJECTID));
        const filteredStartPoints = startPoints.filter(sp => filteredIds.has(sp.attributes.OBJECTID));

        renderStartPoints(filteredStartPoints);
        zoomToGraphics(filteredStartPoints);
    });

    // 6. Listen for route selection (from Map or Table)
    let currentRoute = null;
    document.addEventListener("routeSelected", (e) => {
        currentRoute = e.detail;
        renderRouteDetails(currentRoute);
    });

    // 7. Listen for language change
    document.addEventListener("languageChanged", () => {
        console.log("Language changed, re-rendering...");
        renderTable(routes, "routes-list");
        if (currentRoute) {
            renderRouteDetails(currentRoute);
        }
    });
}

init();
