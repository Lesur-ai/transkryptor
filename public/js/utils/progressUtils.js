import { log } from './utils.js';

// Gestion de la progression des lots
let currentBatchIndex = -1;

export function initializeBatchProgress(batchIndex, chunkCount) {
    // N'afficher que si c'est le prochain lot
    if (batchIndex > currentBatchIndex + 1) {
        return;
    }
    
    currentBatchIndex = batchIndex;
    const batchProgress = document.getElementById('batchProgress');
    const batchDiv = document.createElement('div');
    batchDiv.id = `batch_${batchIndex}`;
    batchDiv.className = 'batch-progress';
    
    const batchLabel = document.createElement('div');
    batchLabel.className = 'batch-label';
    batchLabel.textContent = `Lot ${batchIndex + 1}:`;
    batchDiv.appendChild(batchLabel);

    const chunksDiv = document.createElement('div');
    chunksDiv.className = 'chunks';
    
    for (let i = 0; i < chunkCount; i++) {
        const chunk = document.createElement('div');
        chunk.className = 'chunk pending';
        chunk.id = `chunk_${batchIndex}_${i}`;
        chunksDiv.appendChild(chunk);
    }
    
    batchDiv.appendChild(chunksDiv);
    batchProgress.appendChild(batchDiv);
    batchDiv.scrollIntoView({ behavior: 'smooth' });
}

export function resetBatchProgress() {
    currentBatchIndex = -1;
    document.getElementById('batchProgress').innerHTML = '';
}

export function updateChunkStatus(batchIndex, chunkIndex, status) {
    const chunk = document.getElementById(`chunk_${batchIndex}_${chunkIndex}`);
    if (chunk) {
        chunk.className = `chunk ${status}`;
    }
}
