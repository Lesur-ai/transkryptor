/**
 * @file chart.js
 * @description Gère l'affichage du graphique de performance.
 * Transkryptor v5 — Couleurs adaptées au dark theme Cloud Temple.
 */

let performanceChart = null;

export function initChart(canvasElement) {
    if (!canvasElement) return;
    const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
    const ctx = canvasElement.getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: t('chart.performance.speedLabel'),
                data: [],
                borderColor: '#41a890',
                backgroundColor: 'rgba(65, 168, 144, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointBackgroundColor: '#41a890',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: t('chart.performance.yAxisTitle'), color: '#666680', font: { size: 10 } },
                    ticks: { color: '#666680', font: { size: 10 } },
                    grid: { color: 'rgba(42,42,72,0.5)' }
                },
                x: {
                    title: { display: true, text: t('chart.performance.xAxisTitle'), color: '#666680', font: { size: 10 } },
                    ticks: { color: '#666680', font: { size: 10 } },
                    grid: { color: 'rgba(42,42,72,0.3)' }
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
