/**
 * @file progress.js
 * @description Gère l'affichage visuel de la progression du traitement.
 */

let progressContainer;

/**
 * Initialise le module et récupère le conteneur DOM.
 * @param {string} containerId - L'ID de l'élément conteneur.
 */
export function initProgress(containerId) {
    progressContainer = document.getElementById(containerId);
    if (!progressContainer) {
        console.error(`Le conteneur de progression #${containerId} n'a pas été trouvé.`);
    }
}

/**
 * Réinitialise et prépare la grille de LEDs pour un nouveau traitement.
 * @param {number} totalChunks - Le nombre total de morceaux à traiter.
 */
export function setupProgress(totalChunks) {
    if (!progressContainer) return;
    progressContainer.innerHTML = ''; // Vide l'affichage précédent

    const grid = document.createElement('div');
    grid.className = 'chunks-grid';

    for (let i = 0; i < totalChunks; i++) {
        const chunk = document.createElement('div');
        chunk.className = 'chunk pending';
        chunk.id = `chunk_${i}`;
        chunk.title = `Chunk ${i + 1}`; // Tooltip
        grid.appendChild(chunk);
    }
    
    progressContainer.appendChild(grid);
}

/**
 * Met à jour le statut visuel d'un morceau (LED).
 * @param {number} chunkIndex - L'index du morceau.
 * @param {string} status - Le nouveau statut ('processing', 'completed', 'error').
 */
export function updateChunkStatus(chunkIndex, status) {
    if (!progressContainer) return;
    const chunk = document.getElementById(`chunk_${chunkIndex}`);
    if (chunk) {
        chunk.className = `chunk ${status}`;
    }
}

/**
 * Vide l'affichage de la progression.
 */
export function clearProgress() {
    if (progressContainer) {
        progressContainer.innerHTML = '';
    }
}
