async function testAPIKeys() {
    const openaiKey = document.getElementById("openaiKey").value;
    const anthropicKey = document.getElementById("anthropicKey").value;

    if (!openaiKey || !anthropicKey) {
        alert("Veuillez entrer les deux clés API avant de les tester.");
        return;
    }

    try {
        const response = await axios.post(CONFIG.apiEndpoints.test, {
            openaiKey,
            anthropicKey
        });
        
        if (response.data.status === 'OK') {
            log("Clés API valides");
            alert("Les clés API sont valides.");
        } else {
            throw new Error(response.data.message);
        }
    } catch (error) {
        log("Erreur lors du test des clés API : " + error.message);
        alert("Erreur lors du test des clés API : " + error.message);
    }
}

async function processAudio() {
    try {
        const openaiKey = document.getElementById("openaiKey").value;
        const anthropicKey = document.getElementById("anthropicKey").value;
        const file = document.getElementById("audioFile").files[0];

        if (!file || !openaiKey || !anthropicKey) {
            throw new Error("Veuillez remplir tous les champs et sélectionner un fichier audio.");
        }

        // Test silencieux des clés API
        const response = await axios.post(CONFIG.apiEndpoints.test, {
            openaiKey,
            anthropicKey
        });
        
        if (response.data.status === 'OK') {
            log("Clés API valides");
        } else {
            throw new Error("Les clés API ne sont pas valides. Veuillez vérifier vos clés.");
        }

        document.getElementById("debug").textContent = "";
        document.getElementById("batchProgress").innerHTML = "";
        log("Début du processus...");

        updateGlobalProgress(10);
        log("Début de la transcription...");
        rawTranscription = await transcribeAudioParallel(file, openaiKey);
        log("Transcription terminée");
        updateGlobalProgress(100);
        document.getElementById("rawTranscription").textContent = rawTranscription;
    } catch (error) {
        log("Erreur détaillée: " + JSON.stringify(error, null, 2));
        log("Message d'erreur: " + error.message);
        log("Stack trace: " + error.stack);
        alert("Une erreur est survenue. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    log("Application initialisée");
});
