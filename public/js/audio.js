import { log, updateGlobalProgress } from './utils/utils.js';
import { 
    setRawTranscription,
    setTotalBatches,
    setCompletedBatches,
    incrementCompletedBatches,
    getCompletedBatches
} from './state.js';
import { getConfig } from './config.js';
import { extractChunk, audioBufferToWav } from './utils/audioUtils.js';
import { transcribeChunk, transcribeChunkWithRetry } from './utils/transcriptionUtils.js';
import { initializeBatchProgress, updateChunkStatus } from './utils/progressUtils.js';

// Traitement de l'audio
export async function processAudio() {
    try {
        const openaiKey = document.getElementById("openaiKey").value;
        const audioFile = document.getElementById("audioFile").files[0];
        const config = getConfig();

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
        document.getElementById("batchProgress").innerHTML = '';

        log("Début de la transcription...");
        updateGlobalProgress(0);

        const transcription = await transcribeAudioParallel(audioFile, openaiKey);
        setRawTranscription(transcription);
        document.getElementById("rawTranscription").innerHTML = marked.parse(transcription);
        
        log("Transcription terminée");
        updateGlobalProgress(100);
    } catch (error) {
        log("Erreur lors de la transcription : " + error.message);
        alert("Une erreur est survenue lors de la transcription. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}

async function transcribeAudioParallel(file, apiKey) {
    try {
        log("Démarrage de transcribeAudioParallel");
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        log("Contexte audio créé");
        const arrayBuffer = await file.arrayBuffer();
        log("ArrayBuffer créé");
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        log("AudioBuffer décodé");
        const totalDuration = audioBuffer.duration;
        log("Durée totale: " + totalDuration);

        const config = getConfig();
        const chunks = Math.ceil(totalDuration / (config.chunkDuration - config.chunkOverlap));
        log("Nombre de morceaux: " + chunks);
        const totalBatchCount = Math.ceil(chunks / config.batchSize);
        log("Nombre total de lots: " + totalBatchCount);
        setTotalBatches(totalBatchCount);
        setCompletedBatches(0);

        const transcriptionPromises = [];

        for (let batchIndex = 0; batchIndex < totalBatchCount; batchIndex++) {
            const batch = [];
            initializeBatchProgress(batchIndex, Math.min(config.batchSize, chunks - batchIndex * config.batchSize));
            
            for (let j = batchIndex * config.batchSize; j < Math.min((batchIndex + 1) * config.batchSize, chunks); j++) {
                const start = j * (config.chunkDuration - config.chunkOverlap);
                const end = Math.min((j + 1) * config.chunkDuration, totalDuration);
                const chunkBuffer = await extractChunk(audioBuffer, start, end);
                const chunkBlob = await audioBufferToWav(chunkBuffer);
                batch.push(transcribeChunkWithRetry(chunkBlob, apiKey, j, batchIndex));
            }

            const results = await Promise.all(batch);
            transcriptionPromises.push(...results);
            incrementCompletedBatches();
            const completedCount = getCompletedBatches();
            updateGlobalProgress(10 + (completedCount / totalBatchCount) * 90);
        }

        return transcriptionPromises.filter(t => t).join(' ');
    } catch (error) {
        log("Erreur dans transcribeAudioParallel: " + error.message);
        throw error;
    }
}

// Export pour l'interface globale
window.processAudio = processAudio;
