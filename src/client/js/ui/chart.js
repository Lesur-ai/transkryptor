/**
 * @file chart.js
 * @description Gère l'affichage du graphique de performance.
 * Lit les tokens couleur depuis les CSS variables — suit automatiquement le brand actif
 * (data-brand="lesur-ai" → cyan, data-brand="cloud-temple" → vert legacy).
 */

let performanceChart = null;

function readToken(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

export function initChart(canvasElement) {
    if (!canvasElement) return;
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
    const line   = readToken('--chart-line', '#00A7C7');
    const fill   = readToken('--chart-fill', 'rgba(0, 167, 199, 0.12)');
    const axis   = readToken('--chart-axis', '#8B96A2');
    const gridY  = readToken('--chart-grid-y', 'rgba(14, 20, 31, 0.06)');
    const gridX  = readToken('--chart-grid-x', 'rgba(14, 20, 31, 0.04)');
    const ctx = canvasElement.getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: t('chart.performance.speedLabel'),
                data: [],
                borderColor: line,
                backgroundColor: fill,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointBackgroundColor: line,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: t('chart.performance.yAxisTitle'), color: axis, font: { size: 10 } },
                    ticks: { color: axis, font: { size: 10 } },
                    grid: { color: gridY }
                },
                x: {
                    title: { display: true, text: t('chart.performance.xAxisTitle'), color: axis, font: { size: 10 } },
                    ticks: { color: axis, font: { size: 10 } },
                    grid: { color: gridX }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

export function addChartData(label, data) {
    if (!performanceChart) return;
    performanceChart.data.labels.push(label);
    performanceChart.data.datasets[0].data.push(data);
    performanceChart.update();
}

export function updateChartLabel(newLabel) {
    if (!performanceChart) return;
    performanceChart.data.datasets[0].label = newLabel;
    performanceChart.options.scales.y.title.text = newLabel;
    performanceChart.update();
}

export function refreshLabels() {
    if (!performanceChart) return;
    const t = window.i18n.t.bind(window.i18n);
    performanceChart.options.scales.y.title.text = t('chart.performance.yAxisTitle');
    performanceChart.options.scales.x.title.text = t('chart.performance.xAxisTitle');
    performanceChart.update();
}

export function resetChart() {
    if (!performanceChart) return;
    performanceChart.data.labels = [];
    performanceChart.data.datasets[0].data = [];
    performanceChart.update();
}
