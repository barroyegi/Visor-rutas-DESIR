import './style.css';
import { initializeMap, renderStartPoints } from './src/map.js';
import { fetchRoutesList, fetchStartPoints } from './src/data.js';
import { renderTable, initFilters, renderRouteDetails } from './src/ui.js';

async function init() {
    console.log("Initializing application...");

    // 1. Initialize Map
    const view = await initializeMap("viewDiv");
    console.log("Map initialized");

    // 2. Fetch Data
    const routes = await fetchRoutesList();
    console.log("Routes fetched:", routes);

    // 3. Render Table
    renderTable(routes, "routes-list");

    // 4. Initialize Filters
    initFilters(routes, (filteredRoutes) => {
        renderTable(filteredRoutes, "routes-list");
        // Optional: Filter map points too?
        // For now, we just filter the table.
    });

    // 5. Fetch and Render Start Points on Map
    // Note: We might want to use the same 'routes' list if we extracted points from it,
    // but fetchStartPoints might use a different strategy (e.g. returnGeometry=true)
    const startPoints = await fetchStartPoints();
    renderStartPoints(startPoints);

    // 6. Listen for route selection (from Map or Table)
    document.addEventListener("routeSelected", (e) => {
        renderRouteDetails(e.detail);
    });
}

init();
