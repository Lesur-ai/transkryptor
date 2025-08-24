import { log } from './utils/utils.js';
import { getConfig } from './config.js';

// Gestion des clés API
window.testAPIKeys = async function() {
    try {
        const openaiKey = document.getElementById("openaiKey").value;
        const anthropicKey = document.getElementById("anthropicKey").value;

        if (!openaiKey || !anthropicKey) {
            throw new Error("Les deux clés API sont requises");
        }

        log("Test des clés API en cours...");
        const config = getConfig();
        log(`Test des clés avec l'endpoint : ${config.apiEndpoints.testKeys}`);
        const response = await axios.post(config.apiEndpoints.testKeys, {
            openaiKey,
            anthropicKey
        });

        log("Test des clés API réussi : " + response.data.message);
        alert("Les clés API sont valides !");

        // Sauvegarder les clés dans le localStorage
        localStorage.setItem("openaiKey", openaiKey);
        localStorage.setItem("anthropicKey", anthropicKey);
    } catch (error) {
        log("Erreur lors du test des clés API : " + error.message);
        alert("Erreur lors du test des clés API. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
};

window.clearAPIKeys = function() {
    document.getElementById("openaiKey").value = "";
    document.getElementById("anthropicKey").value = "";
    localStorage.removeItem("openaiKey");
    localStorage.removeItem("anthropicKey");
    log("Clés API effacées");
};

// Restaurer les clés API au chargement
document.addEventListener("DOMContentLoaded", () => {
    const openaiKey = localStorage.getItem("openaiKey");
    const anthropicKey = localStorage.getItem("anthropicKey");
    
    if (openaiKey) {
        document.getElementById("openaiKey").value = openaiKey;
    }
    if (anthropicKey) {
        document.getElementById("anthropicKey").value = anthropicKey;
    }
});
