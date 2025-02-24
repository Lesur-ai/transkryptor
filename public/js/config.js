// Définition de l'URL de l'API
const API_URL = window.location.origin;

const CONFIG = {
    version: '3.0.15',
    chunkDuration: 60, // 60 secondes par morceau
    chunkOverlap: 0.03, // 30 ms de chevauchement
    batchSize: 10, // 10 morceaux par lot
    apiEndpoints: {
        test: `${API_URL}/test-keys`,
        analyze: `${API_URL}/analyze`
    },
    anthropicVersion: '2023-06-01',
    storage: {
        openaiKey: 'transkryptor_openai_key',
        anthropicKey: 'transkryptor_anthropic_key'
    }
};

// Mise à jour de la version dans l'interface
function updateVersion() {
    const config = getConfig();
    document.title = `Transkryptor v${config.version}`;
    document.querySelector('h1').textContent = `Transkryptor v${config.version}`;
}

// Exécuter au chargement
document.addEventListener('DOMContentLoaded', updateVersion);

// Variables globales
let totalBatches = 0;
let completedBatches = 0;
let rawTranscription = "";
let analyzedTranscription = "";

// Fonction pour obtenir la configuration
export function getConfig() {
    return CONFIG;
}

export { updateVersion };
