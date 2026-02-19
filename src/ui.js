import { config } from "./config.js";
import { selectRoute, highlightPoint, removeHighlight } from "./map.js";
import { t, tData, getCurrentLang } from "./i18n.js";

function formatDuration(value) {
  if (!value) return "N/A";

  // If it's a number (timestamp), convert to Date
  let date;
  if (typeof value === 'number') {
    date = new Date(value);
  } else {
    // Try to parse as date string
    date = new Date(value);
  }

  if (isNaN(date.getTime())) {
    // If parsing fails, try to extract time part with regex if it's a string like "30/12/1899 3:55:00"
    const timeMatch = String(value).match(/(\d{1,2}:\d{2})/);
    return timeMatch ? `${timeMatch[1]} h` : value;
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Format as H:mm h
  return `${hours}:${minutes.toString().padStart(2, '0')} h`;
}

// Map to keep track of pre-fetched images to avoid redundant loads
const prefetchedImages = new Set();

/**
 * Pre-fetches an image by creating an Image object in memory.
 */
export function prefetchImage(url) {
  if (!url || prefetchedImages.has(url)) return;

  const img = new Image();
  img.src = url;
  prefetchedImages.add(url);
  console.log(`[Prefetch] Started: ${url}`);
}

export function renderTable(routes, containerId, isLoading = false) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (isLoading) {
    container.innerHTML = `<p>${t("loadingRoutes")}</p>`;
    return;
  }

  if (routes.length === 0) {
    container.innerHTML = `<p>${t("noRoutesFound")}</p>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "routes-table";

  // Header
  const thead = document.createElement("thead");
  thead.innerHTML = ``;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  routes.forEach(route => {
    const tr = document.createElement("tr");

    const dist = route[config.fields.distance];
    const distRedondeada = dist ? dist.toFixed(2) : "N/A";

    tr.innerHTML = `
    <td colspan="4" class="route-card-cell">
      <div class="route-card">
        <div class="route-card-name">
          ${route[config.fields.name] || "N/A"}
          ${route[config.fields.matricula] === "GR" ? '<div class="gr-symbol" title="Gran Recorrido (GR)"></div>' : ''}
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

      // Pre-fetch the first image of the route on hover
      const imagesField = route[config.fields.images];
      if (imagesField) {
        const firstUrl = imagesField.split('|')[0]?.trim();
        if (firstUrl) prefetchImage(firstUrl);
      }
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
  const searchInput = document.getElementById("search-input");
  const matriculaFilter = document.getElementById("matricula-filter");
  const resetFiltersBtn = document.getElementById("reset-filters-btn");

  const minGap = 2; // Minimum gap between sliders

  function fillSlider() {
    const range = 100; // Max value defined in HTML
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
    if (parseFloat(sliderTwo.value) >= 100) {
      sliderMaxLabel.textContent = "+ 100 km";
    } else {
      sliderMaxLabel.textContent = `${sliderTwo.value} km`;
    }
    fillSlider();
  }

  // Initial fill
  fillSlider();

  // Populate Matricula Filter dynamically
  const matriculas = [...new Set(routes.map(r => r[config.fields.matricula]).filter(Boolean))].sort();
  matriculas.forEach(m => {
    const option = document.createElement("option");
    option.value = m;
    option.textContent = m;
    matriculaFilter.appendChild(option);
  });

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

    // Filtro de dificultad
    const difficulty = difficultyFilter.value;
    if (difficulty !== "All") {
      filtered = filtered.filter(r => r[config.fields.difficulty] === difficulty);
    }

    // Filtro de matricula
    const matricula = matriculaFilter.value;
    if (matricula !== "All") {
      filtered = filtered.filter(r => r[config.fields.matricula] === matricula);
    }

    // Filtro de distancia (min y max)
    const minDistance = parseFloat(sliderOne.value);
    const maxDistance = parseFloat(sliderTwo.value);

    filtered = filtered.filter(r => {
      const dist = r[config.fields.distance];
      return dist >= minDistance && dist <= maxDistance;
    });

    // Filtro de búsqueda por texto (nombre)
    const query = searchInput.value.toLowerCase().trim();
    if (query) {
      filtered = filtered.filter(r => {
        const name = (r[config.fields.name] || "").toLowerCase();
        return name.includes(query);
      });
    }

    onFilterChange(filtered);
  };

  // Escuchar eventos de teclado en el buscador
  searchInput.addEventListener("input", () => {
    applyFilters();
  });

  // Aplica el filtro de distancia cuando se hace clic en el botón
  applyDistanceFilter.addEventListener("click", () => {
    applyFilters();
    // Close dropdown
    distanceDropdownBtn.classList.remove("active");
    distanceDropdownContent.classList.remove("active");
  });

  // Aplica el filtro de más filtros cuando se hace clic en el botón
  applyMoreFilters.addEventListener("click", () => {
    applyFilters();
    // Close dropdown
    moreFiltersDropdownBtn.classList.remove("active");
    moreFiltersDropdownContent.classList.remove("active");
  });

  // Botón de reset de todos los filtros
  resetFiltersBtn.addEventListener("click", () => {
    // 1. Limpiar búsqueda por texto
    searchInput.value = "";

    // 2. Reiniciar dificultad y matricula
    difficultyFilter.value = "All";
    matriculaFilter.value = "All";

    // 3. Reiniciar sliders de distancia
    sliderOne.value = 0;
    sliderTwo.value = 100;

    // 4. Actualizar labels y track visual
    sliderMinLabel.textContent = "0 km";
    sliderMaxLabel.textContent = "+ 100 km";
    fillSlider();

    // 5. Aplicar cambios
    applyFilters();
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

  const imagesField = attributes[config.fields.images] || "";
  const imageUrls = imagesField.split('|').map(s => s.trim()).filter(s => s.length > 0);

  contentDiv.innerHTML = `
    <div class="details-header">
      <h3>${attributes[config.fields.name]}</h3>
      <button class="close-details-btn" id="close-details-btn">&times;</button>
    </div>
    
    <div class="route-stats-grid">
      <div class="stat-item">
        <div class="stat-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">${t("distance")}</span>
          <span class="stat-value">${attributes[config.fields.distance]} km</span>
        </div>
      </div>
      
      <div class="stat-item">
        <div class="stat-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path><path d="M16 8 L20 8 M16 12 L20 12 M16 16 L20 16"></path><path d="M12 16 L12 8"></path><path d="m9 10 3-3 3 3"></path></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">${t("elevation")}</span>
          <span class="stat-value">${attributes[config.fields.elevation]} m</span>
        </div>
      </div>
      
      <div class="stat-item">
        <div class="stat-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">${t("difficulty")}</span>
          <span class="stat-value">${tData("difficulty", attributes[config.fields.difficulty])}</span>
        </div>
      </div>
      
      <div class="stat-item">
        <div class="stat-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">${t("duration")}</span>
          <span class="stat-value">${formatDuration(attributes[config.fields.duration])}</span>
        </div>
      </div>
    </div>
    
    ${attributes[config.fields.downloadUrl] ? `
      <div class="download-container">
        <a href="${attributes[config.fields.downloadUrl]}" download class="download-route-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>${t("download")}</span>
        </a>
      </div>
    ` : ""}

    ${attributes[config.fields.routeCode] ? `
      <div class="info-sheet-container">
        <a href="https://senderos.nafarmendi.org/Ruta/ver/${attributes[config.fields.routeCode]}" target="_blank" class="info-sheet-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>${t("viewInfoSheet")}</span>
        </a>
      </div>
    ` : ""}
    
    <h4>${t("description")}</h4>
    <p>${attributes[config.fields.description[getCurrentLang()]] || attributes[config.fields.description.es] || "No description available"}</p>
    
    ${imageUrls.length > 0 ? `
      <h4>${t("photos")}</h4>
      <div class="photos-grid">
        ${imageUrls.map((url, index) => `
          <img src="${url}" 
               class="photo-thumb loading" 
               data-index="${index}" 
               alt="Foto ${index + 1}" 
               ${index < 3 ? 'fetchpriority="high"' : ''}
               decoding="async"
               onload="this.classList.remove('loading'); this.classList.add('loaded');">
        `).join('')}
      </div>
    ` : ""}
  `;

  // Add event listeners to thumbnails
  if (imageUrls.length > 0) {
    const thumbs = contentDiv.querySelectorAll(".photo-thumb");
    thumbs.forEach(thumb => {
      thumb.addEventListener("click", () => {
        const index = parseInt(thumb.getAttribute("data-index"));
        openPhotoModal(imageUrls, index);
      });
    });
  }

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

// --- Photo Modal Logic ---
let currentImages = [];
let currentImageIndex = 0;

function openPhotoModal(images, index) {
  currentImages = images;
  currentImageIndex = index;

  const modal = document.getElementById("photo-modal");
  const modalImg = document.getElementById("modal-image");
  const caption = document.getElementById("modal-caption");

  modal.style.display = "block";
  updateModalImage();

  // Close modal events
  const closeBtn = modal.querySelector(".modal-close");
  closeBtn.onclick = closePhotoModal;
  modal.onclick = (e) => {
    // Close if background, container or caption is clicked
    if (e.target === modal || e.target.classList.contains("modal-content") || e.target.id === "modal-caption") {
      closePhotoModal();
    }
  };

  // Navigation events
  modal.querySelector(".modal-prev").onclick = (e) => {
    e.stopPropagation();
    showPrevPhoto();
  };
  modal.querySelector(".modal-next").onclick = (e) => {
    e.stopPropagation();
    showNextPhoto();
  };

  // Keyboard navigation
  document.onkeydown = (e) => {
    if (modal.style.display === "block") {
      if (e.key === "ArrowLeft") showPrevPhoto();
      if (e.key === "ArrowRight") showNextPhoto();
      if (e.key === "Escape") closePhotoModal();
    }
  };
}

function updateModalImage() {
  const modalImg = document.getElementById("modal-image");
  const caption = document.getElementById("modal-caption");

  modalImg.src = currentImages[currentImageIndex];
  caption.innerHTML = `${currentImageIndex + 1} / ${currentImages.length}`;
}

function showNextPhoto() {
  currentImageIndex = (currentImageIndex + 1) % currentImages.length;
  updateModalImage();
}

function showPrevPhoto() {
  currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
  updateModalImage();
}

function closePhotoModal() {
  document.getElementById("photo-modal").style.display = "none";
  document.onkeydown = null;
}
