/**
 * @file chart.js
 * @description Gère l'affichage du graphique de performance.
 */

// Chart.js est chargé via un CDN dans l'HTML pour simplifier
let performanceChart = null;

/**
 * Initialise le graphique.
 * @param {HTMLCanvasElement} canvasElement - L'élément canvas pour le graphique.
 */
export function initChart(canvasElement) {
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Vitesse (chunks/s)',
                data: [],
                borderColor: '#0061a4',
                backgroundColor: 'rgba(0, 97, 164, 0.1)',
                fill: true,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Vitesse' }
                },
                x: {
                    title: { display: true, text: 'Temps (s)' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/**
 * Ajoute un point de donnée au graphique.
 * @param {string} label - L'étiquette pour l'axe X (ex: temps).
 * @param {number} data - La valeur pour l'axe Y (ex: vitesse).
 */
export function addChartData(label, data) {
    if (!performanceChart) return;
    performanceChart.data.labels.push(label);
    performanceChart.data.datasets[0].data.push(data);
    performanceChart.update();
}

/**
 * Met à jour l'étiquette du dataset du graphique.
 * @param {string} newLabel 
 */
export function updateChartLabel(newLabel) {
    if (!performanceChart) return;
    performanceChart.data.datasets[0].label = newLabel;
    performanceChart.options.scales.y.title.text = newLabel;
    performanceChart.update();
}

/**
 * Réinitialise les données du graphique.
 */
export function resetChart() {
    if (!performanceChart) return;
    performanceChart.data.labels = [];
    performanceChart.data.datasets[0].data = [];
    performanceChart.update();
}
