/**
 * @file apiService.js
 * @description Module de communication avec l'API backend.
 * Ce fichier centralise tous les appels HTTP vers le serveur.
 */
import { getState } from './state.js';

const API_BASE_URL = ''; // L'URL de base est la même que celle du site

/**
 * Récupère la liste des modèles disponibles pour un fournisseur donné.
 * @param {string} provider - L'identifiant du fournisseur (ex: 'cloud-temple').
 * @returns {Promise<Array>} La liste des modèles.
 */
export async function getModels(provider) {
    const { clientId } = getState();
    try {
        const response = await fetch(`${API_BASE_URL}/api/models?provider=${provider}&clientId=${clientId}`);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Erreur lors de la récupération des modèles pour ${provider}.`);
        throw error;
    }
}

/**
 * Envoie un fichier audio au backend pour transcription.
 * @param {File} file - Le fichier audio à transcrire.
 * @param {string} provider - L'identifiant du fournisseur.
 * @param {string} [apiKey] - La clé API (optionnelle, pour OpenAI).
 * @param {object} [metadata={}] - Métadonnées additionnelles comme l'index du chunk.
 * @returns {Promise<object>} Le résultat de la transcription.
 */
export async function transcribe(file, provider, apiKey = null, metadata = {}) {
    const { clientId } = getState();
    const formData = new FormData();
    const fileName = file instanceof Blob ? 'chunk.wav' : file.name;
    formData.append('file', file, fileName);
    formData.append('provider', provider);
    formData.append('clientId', clientId);
    if (metadata.chunkIndex !== undefined) {
        formData.append('chunkIndex', metadata.chunkIndex);
        formData.append('totalChunks', metadata.totalChunks);
    }
    if (metadata.originalFileName) {
        formData.append('originalFileName', metadata.originalFileName);
    }
    if (metadata.originalFileType) {
        formData.append('originalFileType', metadata.originalFileType);
    }
    if (metadata.originalFileSize) {
        formData.append('originalFileSize', metadata.originalFileSize);
    }
    
    // Note: La gestion fine des clés API (OpenAI vs Anthropic) sera ajoutée ici
    // Pour l'instant, on suppose que le backend gère la clé Cloud Temple par défaut.
    if (apiKey) {
        formData.append('apiKey', apiKey);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // Timeout de 60 secondes

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
        return await response.json(); // Retourne l'objet complet { text: "...", _serverDuration: 1234 }
    } catch (error) {
        console.error(`Erreur lors de la transcription avec ${provider}.`);
        throw error;
    }
}

/**
 * Envoie du texte au backend pour analyse.
 * @param {string} text - Le texte à analyser.
 * @param {string} provider - L'identifiant du fournisseur.
 * @param {string} model - L'identifiant du modèle à utiliser.
 * @param {string} [apiKey] - La clé API (optionnelle, pour Anthropic).
 * @param {object} [metadata={}] - Métadonnées additionnelles.
 * @returns {Promise<object>} Le résultat de l'analyse.
 */
export async function analyze(text, provider, model, apiKey = null, metadata = {}) {
    const { clientId } = getState();
    const body = {
        text,
        provider,
        ...metadata,
        model,
        apiKey, // Le backend utilisera la clé d'environnement si celle-ci est nulle
        clientId,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Erreur lors de l'analyse avec ${provider}.`);
        throw error;
    }
}

/**
 * Envoie le texte de l'analyse au backend pour synthèse.
 * @param {string} analysisText - Le texte de l'analyse à synthétiser.
 * @param {string} provider - L'identifiant du fournisseur.
 * @param {string} model - L'identifiant du modèle à utiliser.
 * @param {string} [apiKey] - La clé API (optionnelle).
 * @returns {Promise<object>} Le résultat de la synthèse.
 */
export async function synthesize(analysisText, provider, model, apiKey = null) {
    const { clientId } = getState();
    const body = {
        text: analysisText,
        provider,
        model,
        apiKey,
        clientId,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/synthesize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Erreur lors de la synthèse avec ${provider}.`);
        throw error;
    }
}

/**
 * Valide une clé API auprès du backend.
 * @param {string} provider - Le fournisseur ('openai' or 'anthropic').
 * @param {string} apiKey - La clé API à valider.
 * @returns {Promise<object>} Le résultat de la validation.
 */
export async function validateKey(provider, apiKey) {
    const { clientId } = getState();
    const body = { provider, apiKey, clientId };
    try {
        const response = await fetch(`${API_BASE_URL}/api/validate-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        return await response.json();
    } catch (error) {
        console.error(`Erreur lors de la validation de la clé pour ${provider}.`);
        // En cas d'erreur réseau, on considère la validation comme échouée
        return { success: false, message: `Erreur réseau lors de la validation pour ${provider}.` };
    }
}
