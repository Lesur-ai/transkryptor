// Fonctions utilitaires pour le traitement audio
export async function extractChunk(audioBuffer, start, end) {
    const chunkLength = Math.floor((end - start) * audioBuffer.sampleRate);
    const chunk = new AudioBuffer({
        sampleRate: audioBuffer.sampleRate,
        length: chunkLength,
        numberOfChannels: audioBuffer.numberOfChannels
    });

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const chunkData = chunk.getChannelData(channel);
        const startSample = Math.floor(start * audioBuffer.sampleRate);
        for (let i = 0; i < chunkLength; i++) {
            chunkData[i] = sourceData[startSample + i];
        }
    }

    return chunk;
}

export async function audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Audio Data
    const offset = 44;
    for (let i = 0; i < numberOfChannels; i++) {
        const channel = audioBuffer.getChannelData(i);
        for (let j = 0; j < length; j++) {
            const sample = Math.max(-1, Math.min(1, channel[j]));
            const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset + (j * blockAlign) + (i * bytesPerSample), value, true);
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
