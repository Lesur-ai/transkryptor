async function extractChunk(buffer, start, end) {
    try {
        const sampleRate = buffer.sampleRate;
        const channels = buffer.numberOfChannels;
        const startOffset = Math.floor(start * sampleRate);
        const endOffset = Math.floor(end * sampleRate);
        const frameCount = endOffset - startOffset;

        const newBuffer = new AudioBuffer({
            length: frameCount,
            numberOfChannels: channels,
            sampleRate: sampleRate
        });

        for (let channel = 0; channel < channels; channel++) {
            const channelData = buffer.getChannelData(channel);
            newBuffer.copyToChannel(channelData.slice(startOffset, endOffset), channel);
        }

        return newBuffer;
    } catch (error) {
        log("Erreur dans extractChunk: " + error.message);
        throw error;
    }
}

async function audioBufferToWav(buffer) {
    try {
        const wavFile = await encodeWAV(buffer);
        return new Blob([wavFile], { type: 'audio/wav' });
    } catch (error) {
        log("Erreur dans audioBufferToWav: " + error.message);
        throw error;
    }
}

function encodeWAV(samples) {
    try {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, samples.sampleRate, true);
        view.setUint32(28, samples.sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        const floatTo16BitPCM = (output, offset, input) => {
            for (let i = 0; i < input.length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        };

        floatTo16BitPCM(view, 44, samples.getChannelData(0));
        return buffer;
    } catch (error) {
        log("Erreur dans encodeWAV: " + error.message);
        throw error;
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
