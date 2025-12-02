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
  const container = document.getElementById("route-details");
  if (!attributes) {
    container.innerHTML = "<p>Select a route to see details.</p>";
    return;
  }

  container.innerHTML = `
    <h3>${attributes[config.fields.name]}</h3>
    <p><strong>Distance:</strong> ${attributes[config.fields.distance]}</p>
    <p><strong>Elevation:</strong> ${attributes[config.fields.elevation]}</p>
    <p><strong>Difficulty:</strong> ${attributes[config.fields.difficulty]}</p>
    <p><strong>Duration:</strong> ${attributes[config.fields.duration]}</p>
  `;
}
