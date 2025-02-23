import { getRawTranscription, getAnalyzedTranscription } from '../state.js';
import { log } from './utils.js';

// Fonction utilitaire pour le téléchargement
function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Téléchargement de la transcription
export function downloadTranscription() {
    try {
        const rawTranscription = getRawTranscription();
        if (!rawTranscription) {
            throw new Error("Aucune transcription à télécharger");
        }
        
        const filename = `transcription_${new Date().toISOString().slice(0,10)}.txt`;
        downloadFile(rawTranscription, filename);
        log("Transcription téléchargée : " + filename);
    } catch (error) {
        log("Erreur lors du téléchargement de la transcription : " + error.message);
        alert(error.message);
    }
}

// Téléchargement de l'analyse
export function downloadAnalysis() {
    try {
        const analyzedTranscription = getAnalyzedTranscription();
        if (!analyzedTranscription) {
            throw new Error("Aucune analyse à télécharger");
        }
        
        const filename = `analyse_${new Date().toISOString().slice(0,10)}.txt`;
        downloadFile(analyzedTranscription, filename);
        log("Analyse téléchargée : " + filename);
    } catch (error) {
        log("Erreur lors du téléchargement de l'analyse : " + error.message);
        alert(error.message);
    }
}

// Téléchargement de la synthèse
export function downloadSynthesis() {
    try {
        const synthesisResult = document.getElementById("synthesisResult").innerHTML;
        if (!synthesisResult) {
            throw new Error("Aucune synthèse à télécharger");
        }
        
        const filename = `synthese_${new Date().toISOString().slice(0,10)}.txt`;
        // Convertir le HTML en texte brut
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = synthesisResult;
        const textContent = tempDiv.textContent;
        
        downloadFile(textContent, filename);
        log("Synthèse téléchargée : " + filename);
    } catch (error) {
        log("Erreur lors du téléchargement de la synthèse : " + error.message);
        alert(error.message);
    }
}

// Export pour l'interface globale
window.downloadTranscription = downloadTranscription;
window.downloadAnalysis = downloadAnalysis;
window.downloadSynthesis = downloadSynthesis;
