// État global de l'application
const state = {
    rawTranscription: '',
    analyzedTranscription: '',
    config: {
        apiEndpoints: {
            analyze: '/analyze',
            testKeys: '/test-keys'
        }
    }
};

// Getters
export function getRawTranscription() {
    return state.rawTranscription;
}

export function getAnalyzedTranscription() {
    return state.analyzedTranscription;
}

export function getConfig() {
    return state.config;
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

// Export de l'état pour la compatibilité avec le code existant
window.rawTranscription = state.rawTranscription;
window.analyzedTranscription = state.analyzedTranscription;
window.CONFIG = state.config;
