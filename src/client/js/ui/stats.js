/**
 * @file stats.js
 * @description Module pour gérer l'affichage des statistiques en temps réel.
 * Transkryptor v5 — Design Cloud Temple dark theme.
 */

const dashboard = document.getElementById('dashboard');

export function showStats() {
    if (dashboard) dashboard.style.display = 'flex';
}

export function hideStats() {
    if (dashboard) dashboard.style.display = 'none';
}

export function updateStats({ progress, speed, size, avgTime }) {
    const statProgress = document.getElementById('stat-progress');
    const statSpeed = document.getElementById('stat-speed');
    const statSize = document.getElementById('stat-size');
    const statAvgTime = document.getElementById('stat-avg-time');

    if (progress && statProgress) statProgress.textContent = progress;
    if (speed && statSpeed) statSpeed.textContent = speed;
    if (size && statSize) statSize.textContent = size;
    if (avgTime && statAvgTime) statAvgTime.textContent = avgTime;
}

export function updateStatLabel(statKey, newLabel) {
    if (statKey === 'size') {
        const label = document.getElementById('stat-size-label');
        if (label) label.textContent = newLabel;
    }
}

export function renderFileInfo(info) {
    const fileInfoRow = document.getElementById('file-info-row');
    if (!fileInfoRow) return;

    const duration = info.duration ? `${info.duration.toFixed(1)}s` : '—';
    const sampleRate = info.sampleRate ? `${info.sampleRate / 1000}kHz` : '—';
    const channels = info.channels ? (info.channels === 1 ? 'Mono' : 'Stéréo') : '—';

    fileInfoRow.innerHTML = `
        <div class="file-info-card">
            <div class="stat-icon">🕐</div>
            <div class="stat-info">
                <div class="stat-label">Durée</div>
                <div class="stat-value">${duration}</div>
            </div>
        </div>
        <div class="file-info-card">
            <div class="stat-icon">🔊</div>
            <div class="stat-info">
                <div class="stat-label">Fréquence</div>
                <div class="stat-value">${sampleRate}</div>
            </div>
        </div>
        <div class="file-info-card">
            <div class="stat-icon">🎧</div>
            <div class="stat-info">
                <div class="stat-label">Canaux</div>
                <div class="stat-value">${channels}</div>
            </div>
        </div>
    `;
}

export function initStats() {
    showStats();
    renderFileInfo({});
}
