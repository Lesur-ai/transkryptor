/**
 * @file apiService.js
 * @description Module de communication avec l'API backend.
 * Transkryptor v5 — Cloud Temple SecNumCloud uniquement.
 */
import { getState } from './state.js';

const API_BASE_URL = '';

/**
 * Récupère la version de l'application depuis le serveur.
 * @returns {Promise<string>} La version.
 */
export async function getVersion() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/version`);
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        const data = await response.json();
        return data.version;
    } catch (error) {
        console.error('Erreur lors de la récupération de la version.');
        return '6.1.2';
    }
}

/**
 * Récupère la liste des modèles Cloud Temple disponibles.
 * @returns {Promise<Array>} La liste des modèles.
 */
export async function getModels() {
    const { clientId } = getState();
    try {
        const response = await fetch(`${API_BASE_URL}/api/models?clientId=${clientId}`);
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de la récupération des modèles.');
        throw error;
    }
}

/**
 * Envoie un fichier audio au backend pour transcription via Cloud Temple.
 * @param {File|Blob} file - Le fichier audio à transcrire.
 * @param {object} [metadata={}] - Métadonnées additionnelles.
 * @returns {Promise<object>} Le résultat de la transcription.
 */
export async function transcribe(file, metadata = {}) {
    const { clientId } = getState();
    const formData = new FormData();
    const fileName = file instanceof Blob ? 'chunk.wav' : file.name;
    formData.append('file', file, fileName);
    formData.append('clientId', clientId);
    
    if (metadata.chunkIndex !== undefined) {
        formData.append('chunkIndex', metadata.chunkIndex);
        formData.append('totalChunks', metadata.totalChunks);
    }
    if (metadata.originalFileName) formData.append('originalFileName', metadata.originalFileName);
    if (metadata.originalFileType) formData.append('originalFileType', metadata.originalFileType);
    if (metadata.originalFileSize) formData.append('originalFileSize', metadata.originalFileSize);
    if (metadata.language) formData.append('language', metadata.language);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de la transcription.');
        throw error;
    }
}

/**
 * Envoie du texte au backend pour analyse via Cloud Temple.
 * @param {string} text - Le texte à analyser.
 * @param {string} model - L'identifiant du modèle.
 * @param {object} [metadata={}] - Métadonnées additionnelles.
 *   Peut contenir `targetLanguage` (ISO 639-1) pour que la sortie soit dans
 *   cette langue. Sans, l'analyse reste dans la langue source.
 * @returns {Promise<object>} Le résultat de l'analyse.
 */
export async function analyze(text, model, metadata = {}) {
    const { clientId } = getState();
    // `metadata` est spread dans le body : si elle contient `targetLanguage`,
    // il est automatiquement transmis au backend qui préfixera une instruction
    // de langue dans le prompt.
    const body = { text, model, ...metadata, clientId };

    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de l\'analyse.');
        throw error;
    }
}

/**
 * Envoie le texte de l'analyse au backend pour synthèse via Cloud Temple.
 * @param {string} analysisText - Le texte de l'analyse.
 * @param {string} model - L'identifiant du modèle.
 * @param {string} [customPrompt] - Prompt système personnalisé (optionnel).
 *   Si vide ou absent, le serveur applique le prompt de synthèse par défaut.
 * @param {string} [targetLanguage] - Code ISO 639-1 de la langue de synthèse souhaitée.
 *   Ignoré côté serveur si customPrompt est fourni.
 * @returns {Promise<object>} Le résultat de la synthèse.
 */
export async function synthesize(analysisText, model, customPrompt, targetLanguage) {
    const { clientId } = getState();
    const body = { text: analysisText, model, clientId };
    if (typeof customPrompt === 'string' && customPrompt.trim().length > 0) {
        body.customPrompt = customPrompt;
    }
    if (targetLanguage) body.targetLanguage = targetLanguage;

    try {
        const response = await fetch(`${API_BASE_URL}/api/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de la synthèse.');
        throw error;
    }
}

/**
 * Diarization LLM-based en STREAMING (AXE 4 — v6.0).
 *
 * Le backend renvoie un flux Server-Sent Events ; chaque événement "turn"
 * porte un tour de parole parsé en temps réel pendant que le LLM le génère.
 * Les callbacks permettent de mettre à jour l'UI à mesure que les tours
 * arrivent — pas d'attente de la réponse complète.
 *
 * @param {string} transcriptionText
 * @param {Array<object>} segments
 * @param {string} model
 * @param {number|null} speakerCount
 * @param {object} callbacks - {onStart, onTurn, onComplete, onError}
 * @returns {Promise<object>} payload de l'event "complete" si réussi, sinon throw.
 */
export async function diarizeStream(transcriptionText, segments, model, speakerCount, callbacks) {
    const cb = callbacks || {};
    const { clientId } = getState();
    const body = {
        text: transcriptionText,
        segments: segments || [],
        model,
        clientId,
    };
    if (speakerCount !== null && speakerCount !== undefined && speakerCount > 0) {
        body.speakerCount = speakerCount;
    }

    const response = await fetch(`${API_BASE_URL}/api/diarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
        let errMsg = `Erreur HTTP: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.error) errMsg = errorData.error;
        } catch (_) {}
        throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastComplete = null;
    let lastErrorMessage = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx;
        while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, nlIdx);
            buffer = buffer.slice(nlIdx + 2);

            const lines = rawEvent.split('\n');
            let eventName = 'message';
            let dataStr = '';
            for (const line of lines) {
                if (line.startsWith('event: ')) eventName = line.slice(7).trim();
                else if (line.startsWith('data: ')) dataStr += line.slice(6);
            }
            if (!dataStr) continue;

            let data;
            try { data = JSON.parse(dataStr); } catch (_) { continue; }

            if (eventName === 'start' && cb.onStart) cb.onStart(data);
            else if (eventName === 'turn' && cb.onTurn) cb.onTurn(data);
            else if (eventName === 'complete') {
                lastComplete = data;
                if (cb.onComplete) cb.onComplete(data);
            } else if (eventName === 'error') {
                lastErrorMessage = (data && data.message) || 'Erreur diarization';
                if (cb.onError) cb.onError(data);
            }
        }
    }

    if (lastErrorMessage) throw new Error(lastErrorMessage);
    if (!lastComplete) throw new Error('Diarization terminée sans événement complete.');
    return lastComplete;
}
