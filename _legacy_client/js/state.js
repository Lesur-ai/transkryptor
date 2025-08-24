// État global de l'application
const state = {
    rawTranscription: '',
    analyzedTranscription: '',
    totalBatches: 0,
    completedBatches: 0
};

// Getters
export function getRawTranscription() {
    return state.rawTranscription;
}

export function getAnalyzedTranscription() {
    return state.analyzedTranscription;
}

export function getTotalBatches() {
    return state.totalBatches;
}

export function getCompletedBatches() {
    return state.completedBatches;
}

// Setters
export function setRawTranscription(text) {
    state.rawTranscription = text;
    window.rawTranscription = text; // Pour la compatibilité
}

export function setAnalyzedTranscription(text) {
    state.analyzedTranscription = text;
    window.analyzedTranscription = text; // Pour la compatibilité
}

export function setTotalBatches(count) {
    state.totalBatches = count;
}

export function setCompletedBatches(count) {
    state.completedBatches = count;
}

export function incrementCompletedBatches() {
    state.completedBatches++;
}

// Export de l'état pour la compatibilité avec le code existant
window.rawTranscription = state.rawTranscription;
window.analyzedTranscription = state.analyzedTranscription;
