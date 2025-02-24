const CONFIG = {
    version: '3.0.18',
    chunkDuration: 60, // 60 secondes par morceau
    chunkOverlap: 0.03, // 30 ms de chevauchement
    batchSize: 10, // 10 morceaux par lot
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

// Fonction pour obtenir la configuration
export function getConfig() {
    // Calculer l'URL de l'API au moment de l'appel
    const API_URL = window.location.origin;
    return {
        ...CONFIG,
        apiEndpoints: {
            testKeys: `${API_URL}/test-keys`,
            analyze: `${API_URL}/analyze`
        }
    };
}

export { updateVersion };
