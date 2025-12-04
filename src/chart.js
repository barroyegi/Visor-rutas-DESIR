import Chart from 'chart.js/auto';

let chartInstance = null;
let onHoverCallback = null;

// Function to get color based on elevation
function getColorForElevation(elevation, minElevation, maxElevation) {
    const normalized = (elevation - minElevation) / (maxElevation - minElevation);

    // Gradient: green -> yellow -> orange -> red -> violet
    if (normalized < 0.25) {
        // Green to Yellow
        const t = normalized / 0.25;
        return `rgb(${Math.round(0 + 255 * t)}, ${Math.round(200 - 55 * t)}, 0)`;
    } else if (normalized < 0.5) {
        // Yellow to Orange
        const t = (normalized - 0.25) / 0.25;
        return `rgb(255, ${Math.round(145 - 80 * t)}, 0)`;
    } else if (normalized < 0.75) {
        // Orange to Red
        const t = (normalized - 0.5) / 0.25;
        return `rgb(255, ${Math.round(65 * (1 - t))}, 0)`;
    } else {
        // Red to Violet
        const t = (normalized - 0.75) / 0.25;
        return `rgb(${Math.round(255 - 105 * t)}, 0, ${Math.round(138 * t)})`;
    }
}

// Custom plugin for vertical line crosshair with dot indicator
const crosshairPlugin = {
    id: 'crosshair',
    afterDatasetsDraw(chart, args, options) {
        const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;

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
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
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
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Background for elevation label
            const elevMetrics = ctx.measureText(elevationText);
            const elevPadding = 4;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            const elevBoxX = xPos - elevMetrics.width / 2 - elevPadding;
            const elevBoxY = top + 5;
            const elevBoxWidth = elevMetrics.width + elevPadding * 2;
            const elevBoxHeight = 18;

            ctx.fillRect(elevBoxX, elevBoxY, elevBoxWidth, elevBoxHeight);
            ctx.strokeRect(elevBoxX, elevBoxY, elevBoxWidth, elevBoxHeight);

            // Elevation text
            ctx.fillStyle = '#333';
            ctx.fillText(elevationText, xPos, top + 8);

            // Draw distance label at bottom (inside chart area)
            const distanceText = `${dataPoint.x.toFixed(2)} km`;
            ctx.textBaseline = 'bottom';

            // Background for distance label
            const distMetrics = ctx.measureText(distanceText);
            const distPadding = 4;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            const distBoxX = xPos - distMetrics.width / 2 - distPadding;
            const distBoxY = bottom - 23;
            const distBoxWidth = distMetrics.width + distPadding * 2;
            const distBoxHeight = 18;

            ctx.fillRect(distBoxX, distBoxY, distBoxWidth, distBoxHeight);
            ctx.strokeRect(distBoxX, distBoxY, distBoxWidth, distBoxHeight);

            // Distance text
            ctx.fillStyle = '#333';
            ctx.fillText(distanceText, xPos, bottom - 5);
        }
    }
};

export function initChart(containerId, onHover) {
    const ctx = document.getElementById(containerId).getContext('2d');
    onHoverCallback = onHover;

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Altitud',
                data: [],
                borderColor: 'rgb(75, 150, 220)',
                backgroundColor: 'rgba(75, 150, 220, 0.3)',
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
                        text: 'Distancia (km)'
                    },
                    ticks: {
                        callback: function (value) {
                            return value.toFixed(1);
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Altitud (m)'
                    }
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

    // Set x-axis max to exact maximum distance
    const maxDistance = Math.max(...distances);
    chartInstance.options.scales.x.max = maxDistance;

    // Create gradient for area fill
    const ctx = chartInstance.ctx;
    const chartArea = chartInstance.chartArea;

    if (chartArea) {
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);

        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);


        gradient.addColorStop(0, '#8FB27D');
        gradient.addColorStop(1, '#EBBD68');

        chartInstance.data.datasets[0].backgroundColor = gradient;
    }

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
