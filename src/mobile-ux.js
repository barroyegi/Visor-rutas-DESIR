/**
 * Mejoras de interaccion para movil:
 *  - Perfil de altitud colapsable (libera alto de mapa).
 *  - Sidebar como bottom-sheet arrastrable con puntos de anclaje.
 */

const MOBILE_QUERY = "(max-width: 1000px)";
// Movil en horizontal: el layout pasa a lateral, ahi no hay bottom-sheet.
const LATERAL_QUERY = "(max-width: 1000px) and (orientation: landscape) and (max-height: 600px)";

// Distancia en px a partir de la cual el gesto cuenta como arrastre y no como clic.
const DRAG_THRESHOLD = 6;

/**
 * Botón para plegar/desplegar el perfil de altitud.
 * Chart.js usa responsive + maintainAspectRatio:false, así que se redimensiona
 * solo al cambiar la altura del contenedor.
 */
export function initChartCollapse() {
    const container = document.getElementById("chart-container");
    const btn = document.getElementById("chart-toggle");
    if (!container || !btn) return;

    btn.addEventListener("click", () => {
        const collapsed = container.classList.toggle("collapsed");
        btn.setAttribute("aria-expanded", String(!collapsed));
    });

    // En escritorio no se ofrece replegar. Si venimos plegados desde movil hay
    // que soltar el estado: si no, el perfil se queda oculto sin boton que lo
    // vuelva a abrir.
    window.addEventListener("resize", () => {
        if (window.matchMedia(MOBILE_QUERY).matches) return;
        container.classList.remove("collapsed");
        btn.setAttribute("aria-expanded", "true");
    });
}

/**
 * Convierte la sidebar en un bottom-sheet arrastrable en móvil vertical.
 * Arrastrar el tirador cambia la altura; al soltar, se ancla al punto más
 * cercano. Un clic sin arrastre cicla entre los puntos.
 */
export function initSidebarSheet() {
    const sidebar = document.querySelector(".sidebar");
    const handle = document.getElementById("sheet-handle");
    if (!sidebar || !handle) return;

    const isSheet = () =>
        window.matchMedia(MOBILE_QUERY).matches && !window.matchMedia(LATERAL_QUERY).matches;

    // Anclajes: asomado, mitad (por defecto) y casi completo.
    // Se miden sobre el contenedor, no sobre innerHeight: si no, la cabecera
    // no se descuenta y en el anclaje alto el mapa se queda sin un solo pixel.
    const snapPoints = () => {
        const available =
            sidebar.parentElement.getBoundingClientRect().height || window.innerHeight;
        return [
            Math.round(available * 0.18),
            Math.round(available * 0.5),
            Math.round(available * 0.85)
        ];
    };

    const nearestIndex = (height) => {
        const points = snapPoints();
        let best = 0;
        for (let i = 1; i < points.length; i++) {
            if (Math.abs(points[i] - height) < Math.abs(points[best] - height)) best = i;
        }
        return best;
    };

    let startY = 0;
    let startHeight = 0;
    let dragging = false;
    let moved = false;
    // Altura pedida durante el gesto. No sirve medir el elemento al soltar: el
    // layout puede caparla y entonces el anclaje salta al punto equivocado.
    let requestedHeight = 0;

    handle.addEventListener("pointerdown", (e) => {
        if (!isSheet()) return;
        dragging = true;
        moved = false;
        startY = e.clientY;
        // Si ya hay altura fijada, partimos de ella: medir el elemento da un
        // valor intermedio si la transicion de anclaje sigue en curso.
        startHeight = parseFloat(sidebar.style.height) || sidebar.getBoundingClientRect().height;
        requestedHeight = startHeight;
        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const delta = startY - e.clientY;
        if (Math.abs(delta) > DRAG_THRESHOLD) moved = true;

        const points = snapPoints();
        const min = points[0];
        const max = points[points.length - 1];
        requestedHeight = Math.min(max, Math.max(min, startHeight + delta));
        sidebar.style.height = `${requestedHeight}px`;
    });

    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);

        const points = snapPoints();

        // Clic limpio: pasa al siguiente anclaje. Arrastre: ancla al más cercano.
        const index = moved
            ? nearestIndex(requestedHeight)
            : (nearestIndex(requestedHeight) + 1) % points.length;

        sidebar.style.height = `${points[index]}px`;
    };

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    /**
     * Fija la altura en px al entrar en modo sheet y la suelta al salir.
     * Es obligatorio: el CSS base usa `height: 50%` y la transicion no
     * interpola de porcentaje a px, asi que el primer arrastre no se aplicaria.
     * Al redimensionar tambien reancla, porque los puntos dependen del alto.
     */
    const resetForMode = () => {
        if (!isSheet()) {
            sidebar.style.height = "";
            return;
        }
        const current = parseFloat(sidebar.style.height);
        const index = Number.isFinite(current) ? nearestIndex(current) : 1;
        sidebar.style.height = `${snapPoints()[index]}px`;
    };

    resetForMode();
    window.addEventListener("resize", resetForMode);
}
