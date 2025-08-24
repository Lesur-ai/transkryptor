/**
 * @file audioUtils.js
 * @description Fonctions utilitaires pour la manipulation de l'audio.
 */

/**
 * Écrit une chaîne de caractères dans un DataView.
 * @param {DataView} view - La vue sur les données binaires.
 * @param {number} offset - La position où commencer à écrire.
 * @param {string} string - La chaîne à écrire.
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Convertit un AudioBuffer en un Blob au format WAV.
 * @param {AudioBuffer} audioBuffer - Le buffer audio à convertir.
 * @returns {Blob} Un Blob contenant les données audio au format WAV.
 */
export function audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // En-tête WAV
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // 1 = PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // 16 bits par échantillon
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Données audio (PCM)
    const offset = 44;
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = audioBuffer.getChannelData(channel)[i];
            // Clamp and convert to 16-bit integer
            const value = Math.max(-1, Math.min(1, sample)) * 32767;
            view.setInt16(offset + i * blockAlign + channel * bytesPerSample, value, true);
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}
