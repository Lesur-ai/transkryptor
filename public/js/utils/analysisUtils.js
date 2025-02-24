import { log } from './utils.js';
import { getConfig } from '../config.js';
import { updateChunkStatus } from './progressUtils.js';

function countTokens(text) {
    // Estimation simple des tokens : nombre de mots + ponctuation
    return text.split(/[\s,.!?;:()[\]{}'"]+/).filter(Boolean).length;
}

function verifyTokenRatio(inputText, outputText, chunkIndex, totalChunks) {
    const inputTokens = countTokens(inputText);
    const outputTokens = countTokens(outputText);
    const ratio = Math.abs(outputTokens - inputTokens) / inputTokens;
    
    // Accepte une réduction jusqu'à 2/3 des tokens (ratio = 0.66)
    if (ratio > 0.66) {
        const reduction = ((inputTokens - outputTokens) / inputTokens * 100).toFixed(1);
        throw new Error(`Chunk ${chunkIndex + 1}/${totalChunks} : Réduction de tokens trop importante : -${reduction}% (${inputTokens} → ${outputTokens} tokens)`);
    }
}

function createPreview(text) {
    const words = text.trim().split(/\s+/);
    if (words.length <= 10) {
        return text.trim();
    }
    return words.slice(0, 10).join(' ') + '...';
}

export async function analyzeChunk(chunk, apiKey, chunkIndex, batchIndex, totalChunks) {
    const preview = createPreview(chunk);
    const inputTokens = countTokens(chunk);
    log(`Chunk ${chunkIndex + 1}/${totalChunks} (${inputTokens} tokens) : "${preview}"`);

    const config = getConfig();
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

    const response = await axios.post(config.apiEndpoints.analyze, {
        apiKey,
        messages: [{
            role: "user",
            content: prompt
        }],
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        temperature: 0.3
    });

    // Nettoyer la réponse
    let correctedText = response.data.content[0].text.trim();
    correctedText = correctedText.replace(/^(Voici |Here's |Here is |Le )?([Ll]e )?verbatim( corrigé| nettoyé| propre)?( et)?( corrigé| nettoyé| propre)? ?:?\s*/g, '');
    correctedText = correctedText.replace(/\s*(J'ai |J'espère |Le texte |Voici |Le verbatim |La correction )?(est )?(maintenant )?(corrigé|terminé|fini|complete|fait)\.?$/g, '');

    // Vérifier le ratio de tokens
    try {
        verifyTokenRatio(chunk, correctedText, chunkIndex, totalChunks);
    } catch (error) {
        log(`⚠️ ${error.message}`);
        throw error; // Relancer l'erreur pour déclencher un retry
    }

    const resultPreview = createPreview(correctedText);
    const outputTokens = countTokens(correctedText);
    log(`Résultat ${chunkIndex + 1}/${totalChunks} (${outputTokens} tokens) : "${resultPreview}"`);

    return correctedText;
}

export async function analyzeChunkWithRetry(chunk, apiKey, chunkIndex, batchIndex, totalChunks, retries = 3) {
    const config = getConfig();
    updateChunkStatus(batchIndex, chunkIndex % config.batchSize, 'processing');
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const result = await analyzeChunk(chunk, apiKey, chunkIndex, batchIndex, totalChunks);
            updateChunkStatus(batchIndex, chunkIndex % config.batchSize, 'completed');
            return result;
        } catch (error) {
            if (attempt === retries - 1) {
                log(`Échec de l'analyse du chunk ${chunkIndex + 1} après ${retries} tentatives: ${error.message}`);
                updateChunkStatus(batchIndex, chunkIndex % config.batchSize, 'error');
                throw error;
            }
            log(`Tentative ${attempt + 1} échouée pour le chunk ${chunkIndex + 1}. Nouvelle tentative...`);
            const waitTime = 20000 * (attempt + 1); // 20s, 40s, 60s
            log(`Attente de ${waitTime/1000} secondes avant la prochaine tentative...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}
