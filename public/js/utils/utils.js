// Fonctions utilitaires
export function log(message) {
    const debug = document.getElementById("debug");
    const timestamp = new Date().toLocaleTimeString();
    debug.innerHTML += `[${timestamp}] ${message}<br>`;
    debug.scrollTop = debug.scrollHeight;
}

export function updateGlobalProgress(percent) {
    const progress = document.getElementById("globalProgress");
    const progressText = document.getElementById("globalProgressText");
    progress.style.width = `${percent}%`;
    progressText.textContent = `Progression : ${Math.round(percent)}%`;
}

// Export pour la compatibilité avec le code existant
window.log = log;
window.updateGlobalProgress = updateGlobalProgress;
