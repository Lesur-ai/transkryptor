import { synthesizeAnalysis } from './synthesizer.js';
import { 
    getRawTranscription, 
    setAnalyzedTranscription,
    setTotalBatches,
    setCompletedBatches,
    incrementCompletedBatches,
    getCompletedBatches
} from './state.js';
import { getConfig } from './config.js';
import { log, updateGlobalProgress } from './utils/utils.js';
import { analyzeChunkWithRetry } from './utils/analysisUtils.js';
import { initializeBatchProgress } from './utils/progressUtils.js';

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
        document.getElementById("batchProgress").innerHTML = '';

        log("Début de l'analyse...");
        updateGlobalProgress(0);

        // Découper en chunks
        const sentences = rawTranscription.match(/[^.!?]+[.!?]+/g) || [];
        const chunks = [];
        let currentChunk = "";
        let tokenCount = 0;

        for (let sentence of sentences) {
            const sentenceTokens = sentence.split(/\s+/).length;
            if (tokenCount + sentenceTokens > 500 && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
                tokenCount = 0;
            }
            currentChunk += sentence + " ";
            tokenCount += sentenceTokens;
        }
        if (currentChunk) chunks.push(currentChunk.trim());

        // Afficher les totaux et initialiser le traitement
        const totalChunks = chunks.length;
        const totalBatches = Math.ceil(totalChunks / config.batchSize);
        log(`Analyse de ${totalChunks} chunks en ${totalBatches} lots`);
        setTotalBatches(totalBatches);
        setCompletedBatches(0);
        let analyzedText = '';

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batchSize = Math.min(config.batchSize, chunks.length - batchIndex * config.batchSize);
            initializeBatchProgress(batchIndex, batchSize);
            
            // Traiter les chunks un par un pour préserver l'ordre
            for (let j = 0; j < batchSize; j++) {
                const chunkIndex = batchIndex * config.batchSize + j;
                const result = await analyzeChunkWithRetry(chunks[chunkIndex], anthropicKey, chunkIndex, batchIndex, totalChunks);
                analyzedText += result + '\n\n';

                // Mettre à jour la progression globale
                const completedChunks = chunkIndex + 1;
                updateGlobalProgress((completedChunks / totalChunks) * 100);
            }
            incrementCompletedBatches();
        }

        setAnalyzedTranscription(analyzedText);
        document.getElementById("analyzeResult").innerHTML = marked.parse(analyzedText);
        document.getElementById("downloadAnalysisButton").style.display = "block";
        document.getElementById("synthesizeButton").style.display = "block";
        
        updateGlobalProgress(100);
        log("Analyse terminée");
    } catch (error) {
        log("Erreur lors de l'analyse : " + error.message);
        alert("Une erreur est survenue lors de l'analyse. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}
