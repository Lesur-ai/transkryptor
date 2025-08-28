/**
 * @file state.js
 * @description Gestion de l'état global de l'application.
 * Ce module centralise les données de l'application pour qu'elles soient accessibles
 * et modifiables de manière cohérente par les autres modules.
 */

// État initial de l'application
const appState = {
    // Workflow sélectionné: 'cloud-temple' ou 'openai-anthropic'
    currentWorkflow: 'cloud-temple',
    
    // Modèle d'analyse sélectionné
    selectedModel: null,
    
    // Fichier audio sélectionné par l'utilisateur
    selectedFile: null,
    
    // Clés API entrées par l'utilisateur
    apiKeys: {
        openai: null,
        anthropic: null,
    },

    // Résultats du traitement
    results: {
        transcription: null,
        analysis: null,
        synthesis: null,
    },

    // État du processus en cours
    processingState: 'idle', // 'idle', 'transcribing', 'analyzing', 'synthesizing', 'done', 'error'
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
    // Le log a été supprimé pour nettoyer la console.
}
