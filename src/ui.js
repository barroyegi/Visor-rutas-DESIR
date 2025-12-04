import { config } from "./config.js";
import { selectRoute, highlightPoint, removeHighlight } from "./map.js";

export function renderTable(routes, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (routes.length === 0) {
    container.innerHTML = "<p>No routes found.</p>";
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
            <span class="detail">${route[config.fields.difficulty] || "N/A"}</span>
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
}

export function initFilters(routes, onFilterChange) {
  const filterInput = document.getElementById("difficulty-filter");

  filterInput.addEventListener("change", (e) => {
    const val = e.target.value;
    const filtered = val === "All" ? routes : routes.filter(r => r[config.fields.difficulty] === val);
    onFilterChange(filtered);
  });
}

export function renderRouteDetails(attributes) {
  const container = document.querySelector(".details-container");
  const contentDiv = document.getElementById("route-details");
  const sidebar = document.querySelector(".sidebar");

  if (!attributes) {
    // Hide details
    container.classList.remove("active");
    sidebar.classList.remove("details-open");
    return;
  }

  // Show details
  container.classList.add("active");
  sidebar.classList.add("details-open");

  contentDiv.innerHTML = `
    <div class="details-header">
      <h3>${attributes[config.fields.name]}</h3>
      <button class="close-details-btn" id="close-details-btn">&times;</button>
    </div>
    <p><strong>Distancia:</strong> ${attributes[config.fields.distance]} km</p>
    <p><strong>Desnivel:</strong> ${attributes[config.fields.elevation]} m</p>
    <p><strong>Dificultad:</strong> ${attributes[config.fields.difficulty]}</p>
    <p><strong>Duración:</strong> ${attributes[config.fields.duration]}</p>
    
    <h4>Descripción</h4>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
    
    <h4>Fotos</h4>
    <div style="display: flex; gap: 10px; overflow-x: auto;">
      <div style="min-width: 100px; height: 100px; background-color: #eee; display: flex; align-items: center; justify-content: center;">Foto 1</div>
      <div style="min-width: 100px; height: 100px; background-color: #eee; display: flex; align-items: center; justify-content: center;">Foto 2</div>
    </div>
  `;

  // Add event listener to close button
  document.getElementById("close-details-btn").addEventListener("click", () => {
    closeRouteDetails();
  });
}

export function closeRouteDetails() {
  const container = document.querySelector(".details-container");
  const sidebar = document.querySelector(".sidebar");
  
  container.classList.remove("active");
  sidebar.classList.remove("details-open");
  
  // Also clear map selection/elevation profile if needed
  // We can dispatch an event or export a function to clear map selection
  document.dispatchEvent(new CustomEvent("clearSelection"));
}
