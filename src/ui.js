import { config } from "./config.js";
import { selectRoute, highlightPoint, removeHighlight } from "./map.js";
import { t, tData, getCurrentLang } from "./i18n.js";

export function renderTable(routes, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (routes.length === 0) {
    container.innerHTML = `<p>${t("loadingRoutes")}</p>`; // Or a "no results" message if we had one
    return;
  }

  const table = document.createElement("table");
  table.className = "routes-table";

  // Header
  const thead = document.createElement("thead");
  thead.innerHTML = `

  `;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  routes.forEach(route => {
    const tr = document.createElement("tr");

    const dist = route[config.fields.distance];
    const distRedondeada = dist.toFixed(2);

    tr.innerHTML = `
    <td colspan="4" class="route-card-cell">
      <div class="route-card">
        <div class="route-card-name">
          ${route[config.fields.name] || "N/A"}
        </div>

        <div class="route-card-details">
          <div class="left-group">
            <span class="detail">${distRedondeada} km</span>
            <span class="detail">${route[config.fields.desnivel_pos] || "N/A"}</span>
            <span class="detail">${tData("difficulty", route[config.fields.difficulty]) || "N/A"}</span>
          </div>
        </div>

      </div>
    </td>
  `;

    const card = tr.querySelector(".route-card");

    card.addEventListener("click", () => {
      selectRoute(route.OBJECTID);
    });

    card.addEventListener("mouseenter", () => {
      highlightPoint(route.OBJECTID);
    });

    card.addEventListener("mouseleave", () => {
      removeHighlight();
    });

    tbody.appendChild(tr);
  });


  table.appendChild(tbody);
  container.appendChild(table);

  // Update header if it exists in the container (it's outside renderTable usually, but wait, renderTable clears container)
  // Actually, looking at index.html, the header "Listado de Rutas" is OUTSIDE the container "routes-list".
  // So renderTable only renders the content.
  // BUT, in src/ui.js lines 66-69 (original), it seemed to be rendering the whole list container?
  // No, wait. In index.html:
  // <div class="list-container">
  //   <h3>Listado de Rutas</h3>
  //   <div id="routes-list">Cargando rutas...</div>
  // </div>
  // renderTable targets "routes-list".
  // So I don't need to update the header inside renderTable.
  // I only need to update the "No results" message if any.

  // Wait, I see I tried to replace lines 66-69 in ui.js before.
  // Let's check ui.js again.
  // Lines 66-69 are inside the loop? No.
  // Ah, I see. In ui.js, renderTable appends to container.
  // The container IS "routes-list".
  // So the header "Listado de Rutas" is static in index.html.
  // So I don't need to change it in ui.js.
  // I only need to change the "loading" or "no results" message.
  // I already changed the "no results" message in step 46 (line 10).

  // So what about "Detalle de Ruta"?
  // In index.html:
  // <div class="details-container">
  //   <h3>Detalle de Ruta</h3>
  //   <div id="route-details">Selecciona una ruta para ver detalles.</div>
  // </div>
  // In ui.js, renderRouteDetails updates "route-details".
  // So again, the header is static in index.html.
  // But wait, renderRouteDetails (lines 215+) overwrites contentDiv.
  // contentDiv is "route-details".
  // Inside "route-details", there is:
  // <div class="details-header">...</div>
  // <p>...</p>
  // So the "Detalle de Ruta" header is OUTSIDE "route-details".
  // So I don't need to change it in ui.js.

  // However, I DO need to change the labels INSIDE renderRouteDetails.
  // I already did that in step 46 (lines 213+).

  // So... it seems I might be done with ui.js?
  // Let's check if I missed anything.
  // Step 46 failed chunks 3 and 4.
  // Chunk 3 was:
  // <div class="list-container">
  //   <h3 data-i18n="routesList">${t("routesList")}</h3>
  //   <div id="routes-list">${t("loadingRoutes")}</div>
  // </div>
  // This chunk was trying to replace something that looked like it was in ui.js, but it's actually in index.html structure?
  // No, I was trying to replace lines 68-69 of ui.js?
  // Let's look at ui.js again (Step 57).
  // Lines 66-69 are:
  //   });
  // 
  // 
  //   table.appendChild(tbody);
  //   container.appendChild(table);
  // }

  // So my previous attempt to replace "Listado de Rutas" in ui.js was misguided because that text is NOT in ui.js (except maybe in comments or if I misread).
  // Ah, I see. I was looking at `view_file` output of `index.html` and confusing it with `ui.js`?
  // Or maybe I thought `renderTable` rendered the header too.
  // `renderTable` takes `containerId`. In `main.js`, it's called with "routes-list".
  // In `index.html`, "routes-list" is inside "list-container" which has the header.
  // So `ui.js` does NOT render the "Listado de Rutas" header.
  // So I don't need to change it in `ui.js`.

  // What about "Detalle de Ruta"?
  // Same thing. "route-details" is the container. The header is outside.
  // So I don't need to change it in `ui.js`.

  // So `ui.js` changes are actually mostly done?
  // I changed the "no results" message (line 10).
  // I changed the card details (lines 41-43).
  // I changed the route details content (lines 220-226).

  // Wait, did I change the "Select a route" message?
  // In `ui.js` line 201 (original), there is no "Select a route" message being rendered.
  // It's in `index.html` initially: `<div id="route-details">Selecciona una ruta para ver detalles.</div>`
  // But `renderRouteDetails` overwrites it.
  // If `attributes` is null, it just hides the container.
  // So I don't need to render "Select a route" in `ui.js`.

  // So `ui.js` seems fine.
  // I just need to make sure `index.html` is fully updated.

  // So I will proceed with `index.html` updates only.

}

export function initFilters(routes, onFilterChange) {
  const difficultyFilter = document.getElementById("difficulty-filter");
  const sliderOne = document.getElementById("distance-slider-min");
  const sliderTwo = document.getElementById("distance-slider-max");
  const sliderTrack = document.getElementById("slider-track");
  const sliderMinLabel = document.getElementById("slider-min-label");
  const sliderMaxLabel = document.getElementById("slider-max-label");

  // Dropdown toggle functionality
  const distanceDropdownBtn = document.getElementById("distance-dropdown-btn");
  const distanceDropdownContent = document.getElementById("distance-dropdown-content");
  const moreFiltersDropdownBtn = document.getElementById("more-filters-dropdown-btn");
  const moreFiltersDropdownContent = document.getElementById("more-filters-dropdown-content");

  // Apply filter buttons
  const applyDistanceFilter = document.getElementById("apply-distance-filter");
  const applyMoreFilters = document.getElementById("apply-more-filters");

  const minGap = 2; // Minimum gap between sliders

  function fillSlider() {
    const range = 50; // Max value defined in HTML
    const percent1 = (sliderOne.value / range) * 100;
    const percent2 = (sliderTwo.value / range) * 100;
    sliderTrack.style.background = `linear-gradient(to right, #ddd ${percent1}%, #ff8c00 ${percent1}%, #ff8c00 ${percent2}%, #ddd ${percent2}%)`;
  }

  function slideOne() {
    if (parseInt(sliderTwo.value) - parseInt(sliderOne.value) <= minGap) {
      sliderOne.value = parseInt(sliderTwo.value) - minGap;
    }
    sliderMinLabel.textContent = `${sliderOne.value} km`;
    fillSlider();
  }

  function slideTwo() {
    if (parseInt(sliderTwo.value) - parseInt(sliderOne.value) <= minGap) {
      sliderTwo.value = parseInt(sliderOne.value) + minGap;
    }
    if (parseFloat(sliderTwo.value) >= 50) {
      sliderMaxLabel.textContent = "+ 50 km";
    } else {
      sliderMaxLabel.textContent = `${sliderTwo.value} km`;
    }
    fillSlider();
  }

  // Initial fill
  fillSlider();

  // Event listeners for sliders
  sliderOne.addEventListener("input", slideOne);
  sliderTwo.addEventListener("input", slideTwo);

  // Toggle distance dropdown
  distanceDropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    distanceDropdownBtn.classList.toggle("active");
    distanceDropdownContent.classList.toggle("active");
    // Close other dropdown
    moreFiltersDropdownBtn.classList.remove("active");
    moreFiltersDropdownContent.classList.remove("active");
  });

  // Toggle more filters dropdown
  moreFiltersDropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    moreFiltersDropdownBtn.classList.toggle("active");
    moreFiltersDropdownContent.classList.toggle("active");
    // Close other dropdown
    distanceDropdownBtn.classList.remove("active");
    distanceDropdownContent.classList.remove("active");
  });

  // Close dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".filter-dropdown")) {
      distanceDropdownBtn.classList.remove("active");
      distanceDropdownContent.classList.remove("active");
      moreFiltersDropdownBtn.classList.remove("active");
      moreFiltersDropdownContent.classList.remove("active");
    }
  });

  // Apply filters function
  const applyFilters = () => {
    let filtered = routes;

    // Difficulty filter
    const difficulty = difficultyFilter.value;
    if (difficulty !== "All") {
      filtered = filtered.filter(r => r[config.fields.difficulty] === difficulty);
    }

    // Distance filter (min and max)
    const minDistance = parseFloat(sliderOne.value);
    const maxDistance = parseFloat(sliderTwo.value);

    filtered = filtered.filter(r => {
      const dist = r[config.fields.distance];
      return dist >= minDistance && dist <= maxDistance;
    });

    onFilterChange(filtered);
  };

  // Apply distance filter when button is clicked
  applyDistanceFilter.addEventListener("click", () => {
    applyFilters();
    // Close dropdown
    distanceDropdownBtn.classList.remove("active");
    distanceDropdownContent.classList.remove("active");
  });

  // Apply more filters when button is clicked
  applyMoreFilters.addEventListener("click", () => {
    applyFilters();
    // Close dropdown
    moreFiltersDropdownBtn.classList.remove("active");
    moreFiltersDropdownContent.classList.remove("active");
  });
}

export function renderRouteDetails(attributes) {
  const container = document.querySelector(".details-container");
  const contentDiv = document.getElementById("route-details");
  const overlay = document.querySelector(".sidebar-overlay");
  const sidebar = document.querySelector(".sidebar");

  if (!attributes) {
    // Hide details
    container.classList.remove("active");
    overlay.classList.remove("active");
    sidebar.classList.remove("details-open");
    return;
  }

  // Show details and overlay, block sidebar scroll
  container.classList.add("active");
  overlay.classList.add("active");
  sidebar.classList.add("details-open");

  contentDiv.innerHTML = `
    <div class="details-header">
      <h3>${attributes[config.fields.name]}</h3>
      <button class="close-details-btn" id="close-details-btn">&times;</button>
    </div>
    <p><strong>${t("distance")}:</strong> ${attributes[config.fields.distance]} km</p>
    <p><strong>${t("elevation")}:</strong> ${attributes[config.fields.elevation]} m</p>
    <p><strong>${t("difficulty")}:</strong> ${tData("difficulty", attributes[config.fields.difficulty])}</p>
    <p><strong>${t("duration")}:</strong> ${attributes[config.fields.duration]}</p>
    
    <h4>${t("description")}</h4>
    <p>${attributes[config.fields.description[getCurrentLang()]] || attributes[config.fields.description.es] || "No description available"}</p>
    
    <h4>${t("photos")}</h4>
    <div style="display: flex; gap: 10px; overflow-x: auto;">
      <div style="min-width: 100px; height: 100px; background-color: #eee; display: flex; align-items: center; justify-content: center;">Foto 1</div>
      <div style="min-width: 100px; height: 100px; background-color: #eee; display: flex; align-items: center; justify-content: center;">Foto 2</div>
    </div>
  `;

  // Add event listener to close button
  document.getElementById("close-details-btn").addEventListener("click", () => {
    closeRouteDetails();
  });
  document.querySelector(".sidebar-overlay").addEventListener("click", () => {
    closeRouteDetails();
  });
}

export function closeRouteDetails() {
  const container = document.querySelector(".details-container");
  const overlay = document.querySelector(".sidebar-overlay");
  const sidebar = document.querySelector(".sidebar");

  container.classList.remove("active");
  overlay.classList.remove("active");
  sidebar.classList.remove("details-open");

  // Also clear map selection/elevation profile if needed
  document.dispatchEvent(new CustomEvent("clearSelection"));
}
