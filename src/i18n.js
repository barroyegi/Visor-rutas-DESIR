import { config } from "./config.js";
import { renderTable, renderRouteDetails } from "./ui.js";

// Current state
let currentLang = "es";

export const translations = {
    es: {
        ui: {
            title: "Visor de Rutas de Senderismo",
            distance: "Distancia",
            difficulty: "Dificultad",
            moreFilters: "Más Filtros",
            applyFilter: "Aplicar filtro",
            routesList: "Listado de Rutas",
            loadingRoutes: "Cargando rutas...",
            noRoutesFound: "No se encontraron rutas con estos filtros.",
            routeDetails: "Detalle de Ruta",
            selectRoute: "Selecciona una ruta para ver detalles.",
            duration: "Duración",
            elevation: "Desnivel",
            description: "Descripción",
            photos: "Fotos",
            all: "Todas",
            sliderMax: "+ 100 km",
            searchPlaceholder: "Buscar por nombre...",
            resetFilters: "Reiniciar",
            download: "Descargar GPX",
            viewInfoSheet: "Ver ficha del sendero",
            matricula: "Categoría",
            ruta_completa: "Ruta completa",
            filters: "Filtros",
            apply_filters: "Aplicar Filtros",
            stages: "Etapas",
            variants: "Variantes",
            grTitle: "Gran Recorrido (GR)",
            prTitle: "Pequeño Recorrido (PR)",
            slTitle: "Sendero Local (SL)",
            noDescription: "Descripción no disponible",
            photo: "Foto",
            loadingRoute: "Cargando ruta...",
            routeError: "No se pudo cargar la ruta. Inténtalo de nuevo.",
            retry: "Reintentar",
            listError: "No se pudieron cargar las rutas.",
            diff_1: "Fácil",
            diff_2: "Moderada",
            diff_3: "Difícil",
            diff_4: "Muy difícil",
            themeToggle: "Cambiar tema claro/oscuro"
        },
        data: {
            difficulty: {
                "Fácil": "Fácil",
                "Moderada": "Moderada",
                "Difícil": "Difícil",
                "1": "Fácil",
                "2": "Moderada",
                "3": "Difícil",
                "4": "Muy difícil"
            }
        }
    },
    fr: {
        ui: {
            title: "Visualiseur d'itinéraires de randonnée",
            distance: "Distance",
            difficulty: "Difficulté",
            moreFilters: "Plus de filtres",
            applyFilter: "Appliquer le filtre",
            routesList: "Liste des itinéraires",
            loadingRoutes: "Chargement des itinéraires...",
            noRoutesFound: "Aucun itinéraire trouvé avec ces filtres.",
            routeDetails: "Détails de l'itinéraire",
            selectRoute: "Sélectionnez un itinéraire pour voir les détails.",
            duration: "Durée",
            elevation: "Dénivelé",
            description: "Description",
            photos: "Photos",
            all: "Toutes",
            sliderMax: "+ 100 km",
            searchPlaceholder: "Rechercher par nom...",
            resetFilters: "Réinitialiser",
            download: "Télécharger GPX",
            viewInfoSheet: "Voir la fiche du sentier",
            matricula: "Catégorie",
            ruta_completa: "Route complète",
            filters: "Filtres",
            apply_filters: "Appliquer les filtres",
            stages: "Étapes",
            variants: "Variantes",
            grTitle: "Grande Randonnée (GR)",
            prTitle: "Petite Randonnée (PR)",
            slTitle: "Sentier Local (SL)",
            noDescription: "Description non disponible",
            photo: "Photo",
            loadingRoute: "Chargement de l'itinéraire...",
            routeError: "Impossible de charger l'itinéraire. Réessayez.",
            retry: "Réessayer",
            listError: "Impossible de charger les itinéraires.",
            diff_1: "Facile",
            diff_2: "Modérée",
            diff_3: "Difficile",
            diff_4: "Très difficile",
            themeToggle: "Basculer le thème clair/sombre"
        },
        data: {
            difficulty: {
                "Fácil": "Facile",
                "Moderada": "Modérée",
                "Difícil": "Difficile",
                "1": "Facile",
                "2": "Modérée",
                "3": "Difficile",
                "4": "Très difficile"
            }
        }
    },
    eus: {
        ui: {
            title: "Mendi Ibilbideen Bisorea",
            distance: "Distantzia",
            difficulty: "Zailtasuna",
            moreFilters: "Iragazki gehiago",
            applyFilter: "Aplikatu iragazkia",
            routesList: "Ibilbideen Zerrenda",
            loadingRoutes: "Ibilbideak kargatzen...",
            noRoutesFound: "Ez da ibilbiderik aurkitu iragazki hauekin.",
            routeDetails: "Ibilbidearen Xehetasunak",
            selectRoute: "Aukeratu ibilbide bat xehetasunak ikusteko.",
            duration: "Iraupena",
            elevation: "Desnibela",
            description: "Deskribapena",
            photos: "Argazkiak",
            all: "Guztiak",
            sliderMax: "+ 100 km",
            searchPlaceholder: "Bilatu izenaren arabera...",
            resetFilters: "Garbitu",
            download: "GPX Deskargatu",
            viewInfoSheet: "Ikusi bidearen fitxa",
            matricula: "Kategoria",
            ruta_completa: "Ibilbide osoa",
            filters: "Iragazkiak",
            apply_filters: "Iragazkiak Aplikatu",
            stages: "Etapak",
            variants: "Aldaerak",
            grTitle: "Ibilbide Handia (GR)",
            prTitle: "Ibilbide Txikia (PR)",
            slTitle: "Tokiko Ibilbidea (SL)",
            noDescription: "Deskribapenik ez dago eskuragarri",
            photo: "Argazkia",
            loadingRoute: "Ibilbidea kargatzen...",
            routeError: "Ezin izan da ibilbidea kargatu. Saiatu berriro.",
            retry: "Saiatu berriro",
            listError: "Ezin izan dira ibilbideak kargatu.",
            diff_1: "Erraza",
            diff_2: "Ertaina",
            diff_3: "Zaila",
            diff_4: "Oso zaila",
            themeToggle: "Gai argia/iluna aldatu"
        },
        data: {
            difficulty: {
                "Fácil": "Erraza",
                "Moderada": "Ertaina",
                "Difícil": "Zaila",
                "1": "Erraza",
                "2": "Ertaina",
                "3": "Zaila",
                "4": "Oso zaila"
            }
        }
    }
};

export function initLanguageSwitcher() {
    const buttons = document.querySelectorAll(".lang-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const lang = btn.getAttribute("data-lang");
            setLanguage(lang);
        });
    });
}

export function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;

    // Update buttons state
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });

    // Update static UI elements
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[lang].ui[key]) {
            el.textContent = translations[lang].ui[key];
        }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (translations[lang].ui[key]) {
            el.placeholder = translations[lang].ui[key];
        }
    });

    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.getAttribute("data-i18n-title");
        if (translations[lang].ui[key]) {
            el.title = translations[lang].ui[key];
        }
    });

    // Trigger re-render of dynamic content
    // We need to dispatch an event or call a global update function
    // For now, we'll assume the main app listens to a custom event or we directly call UI update if possible
    // But since we don't have direct access to the 'routes' data here, we might need to rely on the main app to re-render.
    // However, we can export 'getCurrentLang' and let UI components use it.

    // Dispatch event for other components to react
    document.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));
}

export function getCurrentLang() {
    return currentLang;
}

export function t(key) {
    return translations[currentLang].ui[key] || key;
}

export function tData(type, value) {
    if (translations[currentLang].data[type] && translations[currentLang].data[type][value]) {
        return translations[currentLang].data[type][value];
    }
    return value;
}
