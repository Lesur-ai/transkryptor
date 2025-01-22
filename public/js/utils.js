function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substr(0, 19);
}

function log(message) {
    const debugElement = document.getElementById("debug");
    const timestampedMessage = `[${getTimestamp()}] ${message}`;
    debugElement.textContent += timestampedMessage + "\n";
    debugElement.scrollTop = debugElement.scrollHeight;
    console.log(timestampedMessage);
}

function updateGlobalProgress(percent) {
    document.getElementById("globalProgress").style.width = `${percent}%`;
    document.getElementById("globalProgressText").textContent = `${Math.round(percent)}%`;
}

function initializeBatchProgress(batchIndex, size) {
    const batchProgressContainer = document.getElementById("batchProgress");
    const batchElement = document.createElement("div");
    batchElement.className = "batch-progress";
    batchElement.innerHTML = `Lot ${batchIndex + 1}: `;
    for (let i = 0; i < size; i++) {
        const chunkStatus = document.createElement("span");
        chunkStatus.className = "chunk-status pending";
        chunkStatus.id = `chunk-${batchIndex}-${i}`;
        batchElement.appendChild(chunkStatus);
    }
    batchProgressContainer.appendChild(batchElement);
}

function updateChunkStatus(batchIndex, chunkIndex, status) {
    const chunkElement = document.getElementById(`chunk-${batchIndex}-${chunkIndex}`);
    if (chunkElement) {
        chunkElement.className = `chunk-status ${status}`;
    }
}
