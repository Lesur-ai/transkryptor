/**
 * @file audioProcessor.js
 * @description Gère le découpage des fichiers audio en morceaux (chunks) et leur transcription.
 * Transkryptor v5 — Cloud Temple SecNumCloud uniquement.
 */

import * as api from './apiService.js';
import { audioBufferToWav } from './audioUtils.js';

const CHUNK_DURATION = 30;
const CHUNK_OVERLAP = 0.03;
const BATCH_SIZE = 10;

async function transcribeChunk(chunkBlob, metadata, onProgress, retries = 5) {
    try {
        const result = await api.transcribe(chunkBlob, metadata);
        return {
            text: result.text || '',
            duration: result._serverDuration || 0,
            language: result.language || null,
            segments: Array.isArray(result.segments) ? result.segments : [],
        };
    } catch (error) {
        if (retries > 0) {
            onProgress({ type: 'chunk_retrying', chunkIndex: metadata.chunkIndex });
            const waitTime = 2000 * (6 - retries);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return transcribeChunk(chunkBlob, metadata, onProgress, retries - 1);
        }
        throw error;
    }
}

function resampleAudioBuffer(audioBuffer, targetSampleRate) {
    const numberOfChannels = 1;
    const duration = audioBuffer.duration;
    const offlineContext = new OfflineAudioContext(numberOfChannels, duration * targetSampleRate, targetSampleRate);
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    return offlineContext.startRendering();
}

export async function processAndTranscribeInChunks(audioFile, onProgress, options = {}) {
    const { language } = options;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioFile.arrayBuffer();
    let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const targetSampleRate = 24000;
    if (audioBuffer.sampleRate !== targetSampleRate || audioBuffer.numberOfChannels !== 1) {
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
    const allSegmentsByChunk = new Array(numChunks);

    for (let batchStart = 0; batchStart < numChunks; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, numChunks);
        const batchPromises = [];

        for (let i = batchStart; i < batchEnd; i++) {
            const task = async () => {
                const start = i * effectiveChunkDuration;
                const end = Math.min(start + CHUNK_DURATION, totalDuration);
                const chunkDuration = end - start;

                if (chunkDuration < 0.1) {
                    allTranscriptions[i] = '';
                    allSegmentsByChunk[i] = [];
                    processedDuration += chunkDuration;
                    onProgress({
                        type: 'chunk_completed',
                        total: numChunks,
                        completed: ++completedChunks,
                        chunkIndex: i,
                        processedDuration: processedDuration,
                        chunkDuration: 0,
                        currentText: allTranscriptions.filter(Boolean).join(' ')
                    });
                    return;
                }

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
                    for (let j = 0; j < chunkLength; j++) {
                        if (startSample + j < sourceData.length) {
                            chunkData[j] = sourceData[startSample + j];
                        }
                    }
                }
                    
                const chunkBlob = await audioBufferToWav(chunkAudioBuffer);
                const metadata = {
                    chunkIndex: i,
                    totalChunks: numChunks,
                    originalFileName: audioFile.name,
                    originalFileType: audioFile.type,
                    originalFileSize: audioFile.size,
                    language: language || undefined,
                };

                onProgress({ type: 'chunk_processing', chunkIndex: i });
                try {
                    const { text, duration, language: detectedLang, segments } = await transcribeChunk(chunkBlob, metadata, onProgress);
                    allTranscriptions[i] = text;
                    // AXE 4 — Décale les timestamps locaux du chunk vers la timeline globale.
                    // Les IDs sont attribués globalement APRÈS tri par start (voir fin de la fonction).
                    const chunkStartOffset = i * effectiveChunkDuration;
                    allSegmentsByChunk[i] = (segments || []).map((seg) => ({
                        chunkIndex: i,
                        start: (typeof seg.start === 'number' ? seg.start : 0) + chunkStartOffset,
                        end: (typeof seg.end === 'number' ? seg.end : 0) + chunkStartOffset,
                        text: typeof seg.text === 'string' ? seg.text : '',
                    }));
                    processedDuration += chunkDuration;
                    onProgress({
                        type: 'chunk_completed',
                        total: numChunks,
                        completed: ++completedChunks,
                        chunkIndex: i,
                        processedDuration: processedDuration,
                        chunkDuration: duration,
                        detectedLanguage: detectedLang,
                        currentText: allTranscriptions.filter(Boolean).join(' ')
                    });
                } catch (error) {
                    onProgress({ type: 'chunk_error', chunkIndex: i, error: error.message });
                }
            };
            batchPromises.push(task());
        }
        await Promise.all(batchPromises);
    }

    const finalText = allTranscriptions.filter(Boolean).join(' ');
    // AXE 4 — IDs numériques globaux séquentiels après tri par timestamp.
    // Indispensable pour que le LLM (qui répond `segmentIds: [0,1,2]`) puisse
    // mapper sur les segments côté serveur via Map.get(<number>).
    const finalSegments = allSegmentsByChunk
        .filter(Array.isArray)
        .reduce((acc, arr) => acc.concat(arr), [])
        .sort((a, b) => a.start - b.start)
        .map((seg, idx) => ({ id: idx, ...seg }));
    return { text: finalText, segments: finalSegments };
}
