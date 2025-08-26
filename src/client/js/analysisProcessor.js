/**
 * @file analysisProcessor.js
 * @description Gère le découpage du texte et son analyse par lots.
 */

import * as api from './apiService.js';

const TOKEN_LIMIT = 500;
const BATCH_SIZE = 10;

/**
 * Estime le nombre de tokens dans un texte.
 * NOTE : Il s'agit d'une approximation grossière basée sur les mots.
 * Pour un comptage précis, une librairie de tokenization spécifique au modèle serait nécessaire.
 * @param {string} text Le texte à évaluer.
 * @returns {number} Le nombre approximatif de tokens.
 */
function countTokens(text) {
    return text.split(/\s+/).length;
}

function splitTextIntoChunks(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const chunks = [];
    let currentChunk = "";
    let tokenCount = 0;
    for (const sentence of sentences) {
        const sentenceTokens = countTokens(sentence);
        if (tokenCount + sentenceTokens > TOKEN_LIMIT && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
            tokenCount = 0;
        }
        currentChunk += sentence + " ";
        tokenCount += sentenceTokens;
    }
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

async function analyzeChunk({ chunk, provider, model, apiKey, chunkIndex, totalChunks, onProgress }, retries = 5) {
    try {
        const prompt = `Tu es un expert en correction de transcriptions audio. Tu dois nettoyer et corriger ce texte issu d'une reconnaissance vocale en :

CORRECTIONS REQUISES :
- Corrigeant les erreurs de français et de grammaire sans changer le contenu
- Ajustant la ponctuation pour une meilleure lisibilité
- Supprimant les marqueurs d'hésitation (euh, um, ah, etc.)
- Nettoyant les faux départs de phrases et répétitions involontaires
- Corrigeant les mots mal interprétés par la reconnaissance vocale selon le contexte
- Gérant les pauses/silences avec une ponctuation appropriée (..., —, etc.)
- Uniformisant la notation des nombres :
  * En lettres jusqu'à seize
  * En chiffres au-delà
  * Exceptions : dates, mesures, et données chiffrées toujours en chiffres
- Traitant les sigles et acronymes :
  * Vérifier leur exactitude selon le contexte
  * Maintenir la forme utilisée par le locuteur (développée ou sigle)
  * Utiliser la casse appropriée (UNESCO, Covid-19, etc.)
- Structurant le texte en paragraphes cohérents
- Restituant correctement les noms propres, dates et termes techniques

CONTRAINTES STRICTES :
- Conserver EXACTEMENT le même sens et contenu
- Maintenir le style de langage (formel/informel) du locuteur
- Préserver les expressions et tournures personnelles
- Ne faire AUCUNE analyse ou résumé
- Ne pas modifier la structure du discours
- Respecter les pauses naturelles du discours avec la ponctuation adaptée
- Maintenir tous les exemples et références donnés
- Préserver la progression logique de l'argumentation
- Ne pas simplifier les concepts techniques ou complexes

FORMAT DE SORTIE STRICT :
- COMMENCE DIRECTEMENT par le texte corrigé sans aucune phrase d'introduction
- AUCUNE formule du type "Voici", "Voilà", "Texte corrigé :", etc.
- Pas de commentaires avant, pendant ou après le texte
- Pas de métadonnées ou d'explications
- Uniquement le texte corrigé brut organisé en paragraphes
- Ne pas ajouter d'introduction ni de conclusion
- Ne pas commenter les corrections effectuées

Voici la transcription à corriger :

${chunk}`;
        const metadata = { chunkIndex, totalChunks, textPreview: chunk };
        const result = await api.analyze(prompt, provider, model, apiKey, metadata);
        const analyzedText = result.content ? result.content[0].text : result.choices[0].message.content;
        const inputTokens = countTokens(chunk);
        const outputTokens = countTokens(analyzedText);
        if (inputTokens > 50 && (outputTokens / inputTokens) < 0.5) {
            throw new Error(`Le morceau ${chunkIndex + 1} a été trop résumé.`);
        }
        return analyzedText;
    } catch (error) {
        if (retries > 0) {
            onProgress({ type: 'chunk_retrying', chunkIndex });
            const waitTime = 2000 * (6 - retries);
            console.warn(`Échec de l'analyse du chunk ${chunkIndex + 1}, nouvelle tentative dans ${waitTime / 1000}s... (${retries - 1} restantes)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return analyzeChunk({ chunk, provider, model, apiKey, chunkIndex, totalChunks, onProgress }, retries - 1);
        }
        console.error(`Échec final de l'analyse du chunk ${chunkIndex + 1} après plusieurs tentatives.`);
        throw error;
    }
}

export async function processAndAnalyzeInBatches({ text, provider, model, apiKey, onProgress, totalFileSize }) {
    const chunks = splitTextIntoChunks(text);
    const totalChunks = chunks.length;
    onProgress({ total: totalChunks, completed: 0, processedTokens: 0 });

    let completedChunks = 0;
    let processedTokens = 0;
    const allAnalyzedTexts = new Array(totalChunks);

    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);
        const batchPromises = [];

        for (let i = batchStart; i < batchEnd; i++) {
            const task = async () => {
                const chunkText = chunks[i];
                onProgress({ type: 'chunk_processing', chunkIndex: i });
                try {
                    const analyzedText = await analyzeChunk({
                        chunk: chunkText,
                        provider,
                        model,
                        apiKey,
                        chunkIndex: i,
                        totalChunks,
                        onProgress
                    });
                    allAnalyzedTexts[i] = analyzedText;
                    processedTokens += countTokens(chunkText);
                    const processedSize = ((i + 1) / totalChunks) * totalFileSize;
                    onProgress({
                        type: 'chunk_completed',
                        total: totalChunks,
                        completed: ++completedChunks,
                        chunkIndex: i,
                        processedTokens: processedTokens,
                        processedSize: processedSize,
                        text: analyzedText // Ne renvoyer que le texte du chunk
                    });
                } catch (error) {
                    onProgress({ type: 'chunk_error', chunkIndex: i, error: error.message });
                }
            };
            batchPromises.push(task());
        }
        await Promise.all(batchPromises);
    }

    // Attendre que tous les chunks soient terminés avant de joindre
    await Promise.all(
        Array.from({ length: totalChunks }, (_, i) => 
            allAnalyzedTexts[i] === undefined ? new Promise(resolve => {
                // On pourrait ajouter un timeout ici si nécessaire
            }) : Promise.resolve()
        )
    );
    return allAnalyzedTexts.join('\n\n');
}
