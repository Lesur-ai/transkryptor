import { log, updateGlobalProgress } from './utils.js';
import { getConfig } from '../config.js';
import { initializeBatchProgress, updateChunkStatus } from './progressUtils.js';
import { extractFactsFromParagraph } from './factExtractor.js';

async function extractFactsWithRetry(paragraph, apiKey, previousFacts, globalIndex, batchIndex, localIndex, retries = 3) {
    updateChunkStatus(batchIndex, localIndex, 'processing');
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await extractFactsFromParagraph(paragraph, apiKey, previousFacts);
            const facts = response;
            const inputTokens = paragraph.split(/\s+/).length;
            const outputTokens = facts.split(/\s+/).length;
            
            // Logging des faits extraits
            log(`=== Paragraphe ${globalIndex + 1} ===`);
            log(`Tokens : ${inputTokens} → ${outputTokens} (${Math.round((outputTokens/inputTokens) * 100)}%)`);
            facts.split('\n')
                .filter(line => {
                    const trimmed = line.trim();
                    return trimmed.startsWith('CONCEPT:') || 
                           trimmed.startsWith('MÉCANISME:') || 
                           trimmed.startsWith('EXEMPLE:');
                })
                .forEach(fact => {
                    const [type, ...content] = fact.split(':');
                    const factText = content.join(':').trim();
                    let icon = '';
                    switch(type) {
                        case 'CONCEPT': icon = '🔍'; break;
                        case 'MÉCANISME': icon = '⚙️'; break;
                        case 'EXEMPLE': icon = '💡'; break;
                    }
                    log(`${icon} ${factText}`);
                });
            
            updateChunkStatus(batchIndex, localIndex, 'completed');
            return { index: globalIndex, facts };
        } catch (error) {
            if (attempt === retries - 1) {
                log(`Échec de l'extraction du paragraphe ${globalIndex + 1} après ${retries} tentatives: ${error.message}`);
                updateChunkStatus(batchIndex, localIndex, 'error');
                throw error;
            }
            log(`Tentative ${attempt + 1} échouée pour le paragraphe ${globalIndex + 1}. Nouvelle tentative...`);
            const waitTime = 20000 * (attempt + 1); // 20s, 40s, 60s
            log(`Attente de ${waitTime/1000} secondes avant la prochaine tentative...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

export async function extractFactsInBatches(paragraphs, apiKey, batchSize = 5) {
    // Découper en lots
    const batches = [];
    for (let i = 0; i < paragraphs.length; i += batchSize) {
        batches.push(paragraphs.slice(i, i + batchSize));
    }

    const totalBatches = batches.length;
    log(`Extraction des faits en ${totalBatches} lots...`);

    // Initialiser uniquement le premier lot
    const firstBatchSize = Math.min(batchSize, paragraphs.length);
    initializeBatchProgress(0, firstBatchSize);

    const allFacts = [];
    let previousFacts = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        log(`Traitement du lot ${batchIndex + 1}/${totalBatches} (${batch.length} paragraphes)`);
        
        const results = [];
        try {
            // Traiter les paragraphes en parallèle dans le lot
            const promises = batch.map((paragraph, index) => {
                const globalIndex = batchIndex * batchSize + index;
                return extractFactsWithRetry(
                    paragraph, 
                    apiKey, 
                    previousFacts.flat(), 
                    globalIndex,
                    batchIndex,
                    index
                );
            });

            // Attendre tous les résultats du lot
            results.push(...await Promise.all(promises));

            // Attendre avant de passer au lot suivant et initialiser le prochain lot
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (batchIndex < batches.length - 1) {
                const nextBatchSize = Math.min(batchSize, paragraphs.length - ((batchIndex + 1) * batchSize));
                initializeBatchProgress(batchIndex + 1, nextBatchSize);
            }
            
            // Trier par index pour préserver l'ordre
            results.sort((a, b) => a.index - b.index);
            
            // Ajouter les faits dans l'ordre
            const batchFacts = results.map(r => r.facts);
            allFacts.push(...batchFacts);
            previousFacts = batchFacts;
            
            // Mise à jour de la progression globale par chunk
            const totalChunks = paragraphs.length;
            const completedChunks = (batchIndex * batchSize) + results.length;
            const progress = (completedChunks / totalChunks) * 50; // 50% pour la phase 1
            updateGlobalProgress(progress);
            
            log(`Lot ${batchIndex + 1}/${totalBatches} complété (${completedChunks}/${totalChunks} chunks)\n`);
        } catch (error) {
            log(`Erreur dans le lot ${batchIndex + 1}: ${error.message}`);
            throw error;
        }
    }

    return allFacts;
}
