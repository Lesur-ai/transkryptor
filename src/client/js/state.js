/**
 * @file state.js
 * @description Gestion de l'état global de l'application.
 * Transkryptor v5 — Cloud Temple SecNumCloud uniquement.
 */

const appState = {
    // Modèle d'analyse sélectionné
    selectedModel: null,
    
    // Fichier audio sélectionné par l'utilisateur
    selectedFile: null,

    // Identifiant unique de la session client
    clientId: null,

    // Version de l'application (chargée depuis le serveur)
    appVersion: '5.4.0',

    // Résultats du traitement
    results: {
        transcription: null,
        analysis: null,
        synthesis: null,
    },

    // État du processus en cours
    processingState: 'idle', // 'idle', 'transcribing', 'analyzing', 'synthesizing', 'done', 'error'

    // Preset de synthèse sélectionné (executive, meeting, actions, verbatim, thematic, custom)
    synthesisPreset: 'executive',

    // Prompt personnalisé saisi par l'utilisateur (utilisé uniquement quand synthesisPreset === 'custom')
    customSynthesisPrompt: '',

    // Langue audio (ISO 639-1) pour le hint Whisper. '' = auto-détection.
    audioLanguage: '',

    // Langue cible de la synthèse. 'auto' = identique à la langue source détectée.
    synthesisLanguage: 'auto',

    // Langue détectée par Whisper sur le premier chunk (ISO 639-1), si différente du hint.
    detectedAudioLanguage: null,
};

/**
 * Récupère l'état actuel de l'application.
 * @returns {object} L'état complet de l'application.
 */
export function getState() {
    return appState;
}

/**
 * Met à jour une ou plusieurs propriétés de l'état.
 * @param {object} newState - Un objet contenant les nouvelles valeurs à fusionner avec l'état actuel.
 */
export function updateState(newState) {
    Object.assign(appState, newState);
}
