import './style.css';
import { initializeMap, renderStartPoints, zoomToGraphics } from './src/map.js';
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
    document.addEventListener("routeSelected", (e) => {
        renderRouteDetails(e.detail);
    });
}

init();
