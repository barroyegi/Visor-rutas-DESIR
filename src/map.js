import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import { config } from "./config.js";
import { fetchRouteGeometry } from "./data.js";

let view;
let startPointsLayer;
let routeLayer;

export async function initializeMap(containerId) {
    const map = new Map({
        basemap: "topo-vector"
    });

    view = new MapView({
        container: containerId,
        map: map,
        center: [-1.6, 42.8], // Navarra aproximada
        zoom: 9
    });
    // Cursor pointer al pasar por startPointsLayer
    view.on("pointer-move", async evt => {
        const hit = await view.hitTest(evt);
        const graphic = hit.results.filter(r => r.graphic.layer === startPointsLayer)[0]?.graphic;

        if (graphic) {
            view.container.style.cursor = "pointer";
            highlightPoint(graphic.attributes.OBJECTID);
        } else {
            view.container.style.cursor = "default";
            removeHighlight();
        }
    });

    // Layer for Start Points
    startPointsLayer = new GraphicsLayer();
    map.add(startPointsLayer);

    // Layer for Selected Route
    routeLayer = new GraphicsLayer();
    map.add(routeLayer);

    view.on("click", async (event) => {
        const response = await view.hitTest(event);
        if (response.results.length > 0) {
            const graphic = response.results.filter(r => r.graphic.layer === startPointsLayer)[0]?.graphic;
            if (graphic) {
                const objectId = graphic.attributes.OBJECTID;
                console.log("Clicked start point:", objectId);
                selectRoute(objectId);
            }
        }
    });

    return view;
}

let highlightedGraphic = null;

export function highlightPoint(objectId) {
    if (highlightedGraphic && highlightedGraphic.attributes.OBJECTID === objectId) return;

    // Reset previous
    removeHighlight();

    const graphic = startPointsLayer.graphics.find(g => g.attributes.OBJECTID === objectId);
    if (graphic) {
        highlightedGraphic = graphic;
        const symbol = graphic.symbol.clone();
        symbol.width = "40px";
        symbol.height = "40px";
        graphic.symbol = symbol;
    }
}

export function removeHighlight() {
    if (highlightedGraphic) {
        const symbol = highlightedGraphic.symbol.clone();
        symbol.width = "30px";
        symbol.height = "30px";
        highlightedGraphic.symbol = symbol;
        highlightedGraphic = null;
    }
}

export function renderStartPoints(features) {
    startPointsLayer.removeAll();

    const graphics = features.map(f => {
        // If feature is a Line, we need to extract the start point.
        // If feature is a Point, use geometry.
        let pointGeometry = f.geometry;

        if (f.geometry.type === "polyline") {
            pointGeometry = f.geometry.getPoint(0, 0); // First path, first point
        }

        return new Graphic({
            geometry: pointGeometry,
            symbol: {
                type: "picture-marker",
                url: "icons/hiking.svg",
                width: "30px",
                height: "30px"
            },
            attributes: f.attributes
        });
    });

    startPointsLayer.addMany(graphics);
}




export async function selectRoute(objectId) {
    // 1. Fetch full geometry
    const feature = await fetchRouteGeometry(objectId);

    if (feature) {
        // 2. Clear previous selection
        routeLayer.removeAll();

        // 3. Add new route graphic
        const graphic = new Graphic({
            geometry: feature.geometry,
            symbol: {
                type: "simple-line",
                color: [0, 0, 255],
                width: 3
            },
            attributes: feature.attributes
        });

        routeLayer.add(graphic);

        // 4. Zoom to route
        view.goTo(feature.geometry.extent.expand(1.2));

        // 5. Update UI (Side panel details) - Dispatch event or call UI function
        document.dispatchEvent(new CustomEvent("routeSelected", { detail: feature.attributes }));
    }
}
