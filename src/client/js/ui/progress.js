/**
 * @file progress.js
 * @description Gère l'affichage visuel de la progression du traitement.
 * Transkryptor v5.
 */

let progressContainer;

export function initProgress(containerId) {
    progressContainer = document.getElementById(containerId);
}

export function setupProgress(totalChunks) {
    if (!progressContainer) return;
    progressContainer.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'chunks-grid';

    for (let i = 0; i < totalChunks; i++) {
        const chunk = document.createElement('div');
        chunk.className = 'chunk pending';
        chunk.id = `chunk_${i}`;
        chunk.title = `Chunk ${i + 1}`;
        grid.appendChild(chunk);
    }
    
    progressContainer.appendChild(grid);
}

export function updateChunkStatus(chunkIndex, status) {
    if (!progressContainer) return;
    const chunk = document.getElementById(`chunk_${chunkIndex}`);
    if (chunk) {
        chunk.className = `chunk ${status}`;
    }
}

export function clearProgress() {
    if (progressContainer) {
        progressContainer.innerHTML = '';
    }
}
