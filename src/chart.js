import Chart from 'chart.js/auto';
import { t } from "./i18n.js";

let chartInstance = null;
let onHoverCallback = null;

// Theme-aware colours, read live so the chart matches the current data-theme
// without recreating the Chart instance.
function chartThemeColors() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return dark ? {
        text: "#e6e9ee",
        grid: "rgba(255, 255, 255, 0.12)",
        crosshair: "rgba(255, 255, 255, 0.45)",
        labelBg: "rgba(26, 31, 38, 0.95)",
        labelBorder: "rgba(255, 255, 255, 0.25)",
        labelText: "#e6e9ee"
    } : {
        text: "#333",
        grid: "rgba(0, 0, 0, 0.1)",
        crosshair: "rgba(0, 0, 0, 0.3)",
        labelBg: "rgba(255, 255, 255, 0.95)",
        labelBorder: "rgba(0, 0, 0, 0.2)",
        labelText: "#333"
    };
}


// Custom plugin for vertical line crosshair with dot indicator
const crosshairPlugin = {
    id: 'crosshair',
    afterDatasetsDraw(chart, args, options) {
        const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
        const theme = chartThemeColors();

        if (chart.tooltip?._active?.length) {
            const activePoint = chart.tooltip._active[0];
            const xPos = activePoint.element.x;
            const yPos = activePoint.element.y;
            const dataIndex = activePoint.index;
            const dataPoint = chart.data.datasets[0].data[dataIndex];

            // Draw vertical line
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = theme.crosshair;
            ctx.stroke();
            ctx.restore();

            // Draw dot indicator on the line
            ctx.save();
            ctx.beginPath();
            ctx.arc(xPos, yPos, 6, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgb(255, 100, 100)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Draw elevation label at top (inside chart area)
            const elevationText = `${Math.round(dataPoint.y)} m`;
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Background for elevation label
            const elevMetrics = ctx.measureText(elevationText);
            const elevPadding = 4;
            ctx.fillStyle = theme.labelBg;
            ctx.strokeStyle = theme.labelBorder;
            ctx.lineWidth = 1;
            const elevBoxX = xPos - elevMetrics.width / 2 - elevPadding;
            const elevBoxY = top + 5;
            const elevBoxWidth = elevMetrics.width + elevPadding * 2;
            const elevBoxHeight = 18;

            ctx.fillRect(elevBoxX, elevBoxY, elevBoxWidth, elevBoxHeight);
            ctx.strokeRect(elevBoxX, elevBoxY, elevBoxWidth, elevBoxHeight);

            // Elevation text
            ctx.fillStyle = theme.labelText;
            ctx.fillText(elevationText, xPos, top + 8);

            // Draw distance label at bottom (inside chart area)
            const distanceText = `${dataPoint.x.toFixed(2)} km`;
            ctx.textBaseline = 'bottom';

            // Background for distance label
            const distMetrics = ctx.measureText(distanceText);
            const distPadding = 4;
            ctx.fillStyle = theme.labelBg;
            ctx.strokeStyle = theme.labelBorder;
            const distBoxX = xPos - distMetrics.width / 2 - distPadding;
            const distBoxY = bottom - 23;
            const distBoxWidth = distMetrics.width + distPadding * 2;
            const distBoxHeight = 18;

            ctx.fillRect(distBoxX, distBoxY, distBoxWidth, distBoxHeight);
            ctx.strokeRect(distBoxX, distBoxY, distBoxWidth, distBoxHeight);

            // Distance text
            ctx.fillStyle = theme.labelText;
            ctx.fillText(distanceText, xPos, bottom - 5);
        }
    }
};

export function initChart(containerId, onHover) {
    const ctx = document.getElementById(containerId).getContext('2d');
    onHoverCallback = onHover;
    const theme = chartThemeColors();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: t('chartElevation'),
                data: [],
                borderColor: 'rgb(75, 150, 220)',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, '#8FB27D');
                    gradient.addColorStop(1, '#EBBD68');
                    return gradient;
                },
                fill: true,
                tension: 0.1,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    enabled: false // Disable default tooltip
                },
                legend: {
                    display: false
                },
                crosshair: true
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: t('chartDistance'),
                        color: theme.text
                    },
                    ticks: {
                        color: theme.text,
                        callback: function (value) {
                            return value.toFixed(1);
                        }
                    },
                    grid: { color: theme.grid }
                },
                y: {
                    title: {
                        display: true,
                        text: t('chartElevation'),
                        color: theme.text
                    },
                    ticks: { color: theme.text },
                    grid: { color: theme.grid }
                }
            },
            onHover: (event, activeElements) => {
                if (activeElements && activeElements.length > 0) {
                    const index = activeElements[0].index;
                    if (onHoverCallback) {
                        onHoverCallback(index);
                    }
                }
            }
        },
        plugins: [crosshairPlugin]
    });

    // Re-apply translated axis titles + theme colours when either changes,
    // without recreating the chart.
    document.addEventListener("languageChanged", refreshChartLocaleTheme);
    document.addEventListener("themeChanged", refreshChartLocaleTheme);
}

/**
 * Reapplies translated axis titles and theme colours to the existing chart.
 * The crosshair overlay reads colours live, so only the static axis/grid
 * options need updating here.
 */
export function refreshChartLocaleTheme() {
    if (!chartInstance) return;
    const theme = chartThemeColors();
    const opts = chartInstance.options.scales;

    chartInstance.data.datasets[0].label = t('chartElevation');
    opts.x.title.text = t('chartDistance');
    opts.x.title.color = theme.text;
    opts.x.ticks.color = theme.text;
    opts.x.grid.color = theme.grid;
    opts.y.title.text = t('chartElevation');
    opts.y.title.color = theme.text;
    opts.y.ticks.color = theme.text;
    opts.y.grid.color = theme.grid;

    chartInstance.update('none');
}

const ABS_MIN = 0;
const ABS_MAX = 3000;

function absStop(value) {
    return (value - ABS_MIN) / (ABS_MAX - ABS_MIN);
}

export function updateChartData(distances, elevations) {

    if (!chartInstance) {
        console.error("!!! chartInstance is null/undefined !!!");
        return;
    }

    chartInstance.data.labels = distances;
    chartInstance.data.datasets[0].data = elevations.map((ele, i) => ({ x: distances[i], y: ele }));

    // Set x-axis max to exact maximum distance. Samples are built with a
    // cumulative (monotonically increasing) distance, so the last value is the
    // maximum — avoids Math.max(...distances) which overflows the call stack on
    // long routes with thousands of samples.
    const maxDistance = distances.length > 0 ? distances[distances.length - 1] : undefined;
    chartInstance.options.scales.x.max = maxDistance;

    chartInstance.update();
}

export function highlightChartPoint(distance) {
    if (!chartInstance) return;

    // Find nearest index
    const data = chartInstance.data.datasets[0].data;
    let nearestIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < data.length; i++) {
        const diff = Math.abs(data[i].x - distance);
        if (diff < minDiff) {
            minDiff = diff;
            nearestIndex = i;
        }
    }

    if (nearestIndex !== -1) {
        const meta = chartInstance.getDatasetMeta(0);
        const point = meta.data[nearestIndex];

        if (point) {
            chartInstance.tooltip.setActiveElements([
                { datasetIndex: 0, index: nearestIndex }
            ], { x: point.x, y: point.y });
            chartInstance.update('none'); // Use 'none' mode for better performance
        }
    }
}

export function clearChart() {
    if (chartInstance) {
        chartInstance.data.labels = [];
        chartInstance.data.datasets[0].data = [];
        chartInstance.update();
    }
}
