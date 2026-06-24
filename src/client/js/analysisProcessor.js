/**
 * @file analysisProcessor.js
 * @description Gère le découpage du texte et son analyse par lots.
 * Transkryptor v5 — Cloud Temple SecNumCloud uniquement.
 */

import * as api from './apiService.js';

const TOKEN_LIMIT = 500;
const BATCH_SIZE = 10;

function countTokens(text) {
    return text.split(/\s+/).length;
}

function splitTextIntoChunks(text) {
    let sentences = text.match(/[^.!?]+[.!?]+/g);
    if (!sentences) {
        sentences = [text];
    }
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

async function analyzeChunk({ chunk, model, chunkIndex, totalChunks, onProgress }, retries = 5) {
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
        const result = await api.analyze(prompt, model, metadata);
        const analyzedText = result.choices[0].message.content;
        const inputTokens = countTokens(chunk);
        const outputTokens = countTokens(analyzedText);
        if (inputTokens > 50 && (outputTokens / inputTokens) < 0.5) {
            const message = (typeof window !== 'undefined' && window.i18n)
                ? window.i18n.t('analysis.error.chunkTooSummarized', { chunkIndex: chunkIndex + 1 })
                : `Le morceau ${chunkIndex + 1} a été trop résumé.`;
            throw new Error(message);
        }
        return analyzedText;
    } catch (error) {
        if (retries > 0) {
            onProgress({ type: 'chunk_retrying', chunkIndex });
            const waitTime = 2000 * (6 - retries);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return analyzeChunk({ chunk, model, chunkIndex, totalChunks, onProgress }, retries - 1);
        }
        throw error;
    }
}

export async function processAndAnalyzeInBatches({ text, model, onProgress, totalFileSize }) {
    const chunks = splitTextIntoChunks(text);
    const totalChunks = chunks.length;
    const totalTokens = countTokens(text);
    onProgress({ total: totalChunks, completed: 0, processedTokens: 0, totalTokens });

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
                        model,
                        chunkIndex: i,
                        totalChunks,
                        onProgress
                    });
                    allAnalyzedTexts[i] = analyzedText;
                    processedTokens += countTokens(chunkText);
                    completedChunks++;

                    const finalProcessedTokens = (completedChunks === totalChunks) ? totalTokens : processedTokens;
                    const processedSize = (completedChunks / totalChunks) * totalFileSize;
                    onProgress({
                        type: 'chunk_completed',
                        total: totalChunks,
                        completed: completedChunks,
                        chunkIndex: i,
                        processedTokens: finalProcessedTokens,
                        processedSize: processedSize,
                        currentText: allAnalyzedTexts.filter(Boolean).join('\n\n')
                    });
                } catch (error) {
                    onProgress({ type: 'chunk_error', chunkIndex: i, error: error.message });
                }
            };
            batchPromises.push(task());
        }
        await Promise.all(batchPromises);
    }

    return allAnalyzedTexts.filter(Boolean).join('\n\n');
}
