// Import des fonctions
import { synthesizeAnalysis } from './synthesizer.js';
import { getRawTranscription, setAnalyzedTranscription, getConfig } from './state.js';
import { log } from './utils/utils.js';

// Export des fonctions pour l'interface globale
window.synthesizeAnalysis = synthesizeAnalysis;
window.analyzeTranscription = analyzeTranscription;

// Fonction d'analyse
async function analyzeTranscription() {
    try {
        const anthropicKey = document.getElementById("anthropicKey").value;
        const rawTranscription = getRawTranscription();
        const config = getConfig();

        if (!rawTranscription || !anthropicKey) {
            throw new Error("Veuillez d'abord transcrire le fichier audio ou charger une transcription.");
        }

        // Vider les résultats précédents
        document.getElementById("analyzeResult").innerHTML = '';
        document.getElementById("synthesisResult").innerHTML = '';
        document.getElementById("downloadAnalysisButton").style.display = "none";
        document.getElementById("synthesizeButton").style.display = "none";
        document.getElementById("downloadSynthesisButton").style.display = "none";

        // Analyse de la transcription
        log("Début de l'analyse...");
        const response = await axios.post(config.apiEndpoints.analyze, {
            prompt: rawTranscription,
            apiKey: anthropicKey
        });

        // Affichage du résultat
        const analyzedText = response.data.content[0].text;
        setAnalyzedTranscription(analyzedText);
        document.getElementById("analyzeResult").innerHTML = marked.parse(analyzedText);
        
        // Activation des boutons
        document.getElementById("downloadAnalysisButton").style.display = "block";
        document.getElementById("synthesizeButton").style.display = "block";
        
        log("Analyse terminée");
    } catch (error) {
        log("Erreur lors de l'analyse : " + error.message);
        alert("Une erreur est survenue lors de l'analyse. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}
