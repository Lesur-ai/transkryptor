/**
 * @file stats.js
 * @description Module pour gérer l'affichage des statistiques en temps réel.
 */

// --- DOM Elements ---
const statsCard = document.getElementById('stats-card');

/**
 * Affiche le conteneur de statistiques.
 */
export function showStats() {
    statsCard.style.display = 'block';
}

/**
 * Masque le conteneur de statistiques.
 */
export function hideStats() {
    statsCard.style.display = 'none';
}

/**
 * Met à jour les cartes de statistiques principales.
 * @param {object} stats - { progress, speed, size, avgTime }
 */
export function updateStats({ progress, speed, size, avgTime }) {
    const statProgress = document.getElementById('stat-progress');
    const statSpeed = document.getElementById('stat-speed');
    const statSize = document.getElementById('stat-size');
    const statAvgTime = document.getElementById('stat-avg-time');

    if (progress) statProgress.textContent = progress;
    if (speed) statSpeed.textContent = speed;
    if (size) statSize.textContent = size;
    if (avgTime) statAvgTime.textContent = avgTime;
}

/**
 * Affiche les informations du fichier audio.
 * @param {object} info - { duration, sampleRate, channels }
 */
export function renderFileInfo(info) {
    const fileInfoCard = document.getElementById('file-info-card');
    const duration = info.duration ? `${info.duration.toFixed(1)}s` : 'N/A';
    const sampleRate = info.sampleRate ? `${info.sampleRate / 1000}kHz` : 'N/A';
    const channels = info.channels ? (info.channels === 1 ? 'Mono' : 'Stéréo') : 'N/A';

    fileInfoCard.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-card-title">Durée</div>
                <div class="stat-card-value">${duration}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-title">Fréquence</div>
                <div class="stat-card-value">${sampleRate}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-title">Canaux</div>
                <div class="stat-card-value">${channels}</div>
            </div>
        </div>
    `;
}

/**
 * Initialise le module des statistiques.
 */
export function initStats() {
    // La carte est maintenant visible par défaut
    showStats();
    renderFileInfo({}); // Affiche les placeholders
}
