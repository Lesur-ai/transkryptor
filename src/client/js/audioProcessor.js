/**
 * @file audioProcessor.js
 * @description Gère le découpage des fichiers audio en morceaux (chunks) et leur transcription.
 */

import * as api from './apiService.js';
import { audioBufferToWav } from './audioUtils.js';

// Configuration du découpage
const CHUNK_DURATION = 30;
const CHUNK_OVERLAP = 0.03;
const BATCH_SIZE = 10;

async function transcribeChunk(chunkBlob, provider, apiKey, metadata, onProgress, retries = 5) {
    try {
        const result = await api.transcribe(chunkBlob, provider, apiKey, metadata);
        return { text: result.text || '', duration: result._serverDuration || 0 };
    } catch (error) {
        console.error(`Caught error in transcribeChunk for chunk ${metadata.chunkIndex}:`, error);
        if (retries > 0) {
            onProgress({ type: 'chunk_retrying', chunkIndex: metadata.chunkIndex });
            const waitTime = 2000 * (6 - retries);
            console.warn(`Échec de la transcription du chunk ${metadata.chunkIndex + 1}, nouvelle tentative dans ${waitTime / 1000}s... (${retries - 1} restantes)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return transcribeChunk(chunkBlob, provider, apiKey, metadata, onProgress, retries - 1);
        }
        console.error(`Échec final de la transcription du chunk ${metadata.chunkIndex + 1} après plusieurs tentatives.`);
        throw error;
    }
}

function resampleAudioBuffer(audioBuffer, targetSampleRate) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const duration = audioBuffer.duration;
    const offlineContext = new OfflineAudioContext(numberOfChannels, duration * targetSampleRate, targetSampleRate);
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    return offlineContext.startRendering();
}

export async function processAndTranscribeInChunks(audioFile, provider, apiKey, onProgress) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioFile.arrayBuffer();
    let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const targetSampleRate = 24000;
    if (audioBuffer.sampleRate !== targetSampleRate) {
        console.log(`Rééchantillonnage de ${audioBuffer.sampleRate}Hz à ${targetSampleRate}Hz...`);
        audioBuffer = await resampleAudioBuffer(audioBuffer, targetSampleRate);
    }

    const totalDuration = audioBuffer.duration;
    onProgress({ 
        type: 'audio_info', 
        duration: totalDuration, 
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
    });

    const effectiveChunkDuration = CHUNK_DURATION - CHUNK_OVERLAP;
    const numChunks = Math.ceil(totalDuration / effectiveChunkDuration);
    onProgress({ total: numChunks, completed: 0, processedDuration: 0 });

    let completedChunks = 0;
    let processedDuration = 0;
    const allTranscriptions = new Array(numChunks);

    for (let batchStart = 0; batchStart < numChunks; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, numChunks);
        const batchPromises = [];

        for (let i = batchStart; i < batchEnd; i++) {
            const task = async () => {
                const start = i * effectiveChunkDuration;
                const end = Math.min(start + CHUNK_DURATION, totalDuration);
                const chunkDuration = end - start;

            // Logique de découpage sécurisée, identique à la V3
            const chunkLength = Math.floor((end - start) * audioBuffer.sampleRate);
            const chunkAudioBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                chunkLength,
                audioBuffer.sampleRate
            );

            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const sourceData = audioBuffer.getChannelData(channel);
                const chunkData = chunkAudioBuffer.getChannelData(channel);
                const startSample = Math.floor(start * audioBuffer.sampleRate);
                for (let i = 0; i < chunkLength; i++) {
                    // Vérification de sécurité pour éviter le "out of bounds"
                    if (startSample + i < sourceData.length) {
                        chunkData[i] = sourceData[startSample + i];
                    }
                }
            }
                
                const chunkBlob = audioBufferToWav(chunkAudioBuffer);
                const metadata = { chunkIndex: i, totalChunks: numChunks };
                
                onProgress({ type: 'chunk_processing', chunkIndex: i });
                try {
                    const { text, duration } = await transcribeChunk(chunkBlob, provider, apiKey, metadata, onProgress);
                    allTranscriptions[i] = text;
                    processedDuration += chunkDuration;
                    onProgress({
                        type: 'chunk_completed',
                        total: numChunks,
                        completed: ++completedChunks,
                        chunkIndex: i,
                        processedDuration: processedDuration,
                        chunkDuration: duration
                    });
                } catch (error) {
                    onProgress({ type: 'chunk_error', chunkIndex: i, error: error.message });
                }
            };
            batchPromises.push(task());
        }
        await Promise.all(batchPromises);
    }

    return allTranscriptions.filter(Boolean).join(' ');
}
