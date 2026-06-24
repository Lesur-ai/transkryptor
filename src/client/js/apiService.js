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
        return '5.3.0';
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
 * @returns {Promise<object>} Le résultat de l'analyse.
 */
export async function analyze(text, model, metadata = {}) {
    const { clientId } = getState();
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
 * @returns {Promise<object>} Le résultat de la synthèse.
 */
export async function synthesize(analysisText, model, customPrompt) {
    const { clientId } = getState();
    const body = { text: analysisText, model, clientId };
    if (typeof customPrompt === 'string' && customPrompt.trim().length > 0) {
        body.customPrompt = customPrompt;
    }

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
