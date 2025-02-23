import { log, updateGlobalProgress } from './utils/utils.js';
import { setRawTranscription } from './state.js';

// Traitement de l'audio
export async function processAudio() {
    try {
        const openaiKey = document.getElementById("openaiKey").value;
        const audioFile = document.getElementById("audioFile").files[0];

        if (!openaiKey) {
            throw new Error("Clé API OpenAI requise");
        }
        if (!audioFile) {
            throw new Error("Fichier audio requis");
        }

        // Vider les résultats précédents
        document.getElementById("rawTranscription").innerHTML = '';
        document.getElementById("analyzeResult").innerHTML = '';
        document.getElementById("synthesisResult").innerHTML = '';
        document.getElementById("downloadAnalysisButton").style.display = "none";
        document.getElementById("synthesizeButton").style.display = "none";
        document.getElementById("downloadSynthesisButton").style.display = "none";

        log("Début de la transcription...");
        updateGlobalProgress(0);

        // TODO: Implémenter la transcription avec OpenAI Whisper API
        // Pour l'instant, simulons une transcription
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const transcription = "Transcription simulée pour le fichier : " + audioFile.name;
        setRawTranscription(transcription);
        document.getElementById("rawTranscription").innerHTML = marked.parse(transcription);
        
        log("Transcription terminée");
        updateGlobalProgress(100);
    } catch (error) {
        log("Erreur lors de la transcription : " + error.message);
        alert("Une erreur est survenue lors de la transcription. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}

// Export pour l'interface globale
window.processAudio = processAudio;
