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
        const chunks = Math.ceil(totalDuration / (CONFIG.chunkDuration - CONFIG.chunkOverlap));
        log("Nombre de morceaux: " + chunks);
        totalBatches = Math.ceil(chunks / CONFIG.batchSize);
        log("Nombre total de lots: " + totalBatches);
        completedBatches = 0;

        const transcriptionPromises = [];

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batch = [];
            initializeBatchProgress(batchIndex, Math.min(CONFIG.batchSize, chunks - batchIndex * CONFIG.batchSize));
            
            for (let j = batchIndex * CONFIG.batchSize; j < Math.min((batchIndex + 1) * CONFIG.batchSize, chunks); j++) {
                const start = j * (CONFIG.chunkDuration - CONFIG.chunkOverlap);
                const end = Math.min((j + 1) * CONFIG.chunkDuration, totalDuration);
                const chunkBuffer = await extractChunk(audioBuffer, start, end);
                const chunkBlob = await audioBufferToWav(chunkBuffer);
                batch.push(transcribeChunkWithRetry(chunkBlob, apiKey, j, batchIndex));
            }

            const results = await Promise.all(batch);
            transcriptionPromises.push(...results);
            completedBatches++;
            updateGlobalProgress(10 + (completedBatches / totalBatches) * 90);
        }

        return transcriptionPromises.filter(t => t).join(' ');
    } catch (error) {
        log("Erreur dans transcribeAudioParallel: " + error.message);
        throw error;
    }
}

async function transcribeChunkWithRetry(chunkBlob, apiKey, chunkIndex, batchIndex, retries = 10) {
    updateChunkStatus(batchIndex, chunkIndex % CONFIG.batchSize, 'processing');
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const result = await transcribeChunk(chunkBlob, apiKey, chunkIndex, batchIndex, 20000 + attempt * 20000);
            updateChunkStatus(batchIndex, chunkIndex % CONFIG.batchSize, 'completed');
            return result;
        } catch (error) {
            if (attempt === retries - 1) {
                log(`Échec de la transcription du morceau ${chunkIndex + 1} après ${retries} tentatives: ${error.message}`);
                updateChunkStatus(batchIndex, chunkIndex % CONFIG.batchSize, 'error');
                return "";
            }
            log(`Tentative ${attempt + 1} échouée pour le morceau ${chunkIndex + 1}. Nouvelle tentative...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
}

async function transcribeChunk(chunkBlob, apiKey, chunkIndex, batchIndex, timeout) {
    const formData = new FormData();
    formData.append("file", chunkBlob, `chunk_${chunkIndex}.wav`);
    formData.append("model", "whisper-1");

    try {
        log(`Traitement du morceau ${chunkIndex + 1} commencé`);
        const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "multipart/form-data"
            },
            timeout: timeout,
        });
        log(`Traitement du morceau ${chunkIndex + 1} terminé`);
        return response.data.text;
    } catch (error) {
        log(`Erreur lors de la transcription du morceau ${chunkIndex + 1}: ${error.message}`);
        throw error;
    }
}
