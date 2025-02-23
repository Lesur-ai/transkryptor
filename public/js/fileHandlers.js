import { log } from './utils/utils.js';
import { setRawTranscription, setAnalyzedTranscription } from './state.js';

// Chargement d'une transcription
export async function loadTranscription() {
    const input = document.getElementById("transcriptionFile");
    input.click();
    
    input.onchange = async function() {
        const file = input.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            setRawTranscription(text);
            document.getElementById("rawTranscription").innerHTML = marked.parse(text);
            log("Transcription chargée : " + file.name);
        } catch (error) {
            log("Erreur lors du chargement de la transcription : " + error.message);
            alert("Erreur lors du chargement de la transcription");
        }
    };
}

// Chargement d'une analyse
export async function loadAnalysis() {
    const input = document.getElementById("analysisFile");
    input.click();
    
    input.onchange = async function() {
        const file = input.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            setAnalyzedTranscription(text);
            document.getElementById("analyzeResult").innerHTML = marked.parse(text);
            document.getElementById("downloadAnalysisButton").style.display = "block";
            document.getElementById("synthesizeButton").style.display = "block";
            log("Analyse chargée : " + file.name);
        } catch (error) {
            log("Erreur lors du chargement de l'analyse : " + error.message);
            alert("Erreur lors du chargement de l'analyse");
        }
    };
}

// Export pour l'interface globale
window.loadTranscription = loadTranscription;
window.loadAnalysis = loadAnalysis;
