import { debugStyle } from './styles/debugStyle.js';
import { checkSynthesisQuality } from './utils/qualityChecker.js';
import { synthesisOnlyPrompt, synthesisSystem } from './prompts/synthesisPrompts.js';
import { extractFactsInBatches } from './utils/factBatchExtractor.js';
import { getAnalyzedTranscription } from './state.js';
import { getConfig } from './config.js';
import { log, updateGlobalProgress } from './utils/utils.js';
import { resetBatchProgress, initializeBatchProgress, updateChunkStatus } from './utils/progressUtils.js';
import { generateQuestionBatches } from './utils/questionGenerator.js';
import { formatMarkdownQuestions } from './utils/markdownFormatter.js';

export async function synthesizeAnalysis() {
    try {
        const anthropicKey = document.getElementById("anthropicKey")?.value || localStorage.getItem("anthropicKey");
        const analyzedTranscription = getAnalyzedTranscription();
        const config = getConfig();
        
        log(`État de l'analyse : ${analyzedTranscription ? 'présente' : 'absente'} (${analyzedTranscription?.length || 0} caractères)`);
        log(`État de la clé API : ${anthropicKey ? 'présente' : 'absente'} (${anthropicKey?.length || 0} caractères)`);

        if (!anthropicKey) {
            throw new Error("Veuillez d'abord configurer votre clé API Anthropic.");
        }
        
        if (!analyzedTranscription || analyzedTranscription.trim() === '') {
            throw new Error("Veuillez d'abord analyser la transcription ou charger une analyse.");
        }

        // Appliquer le style des logs
        const style = document.createElement('style');
        style.textContent = debugStyle;
        document.head.appendChild(style);

        log("Début de l'extraction des faits...");
        updateGlobalProgress(0);
        resetBatchProgress();

        // Découper en paragraphes et extraire les faits en parallèle
        const paragraphs = analyzedTranscription.split(/\n\n+/).filter(p => p.trim());
        const allFacts = await extractFactsInBatches(paragraphs, anthropicKey);

        updateGlobalProgress(50);

        // Phase 2A : Création de la synthèse (75%)
        log("=== Phase 2A : Création de la synthèse ===");
        updateGlobalProgress(60);
        
        let synthContent;
        let synthResponse;
        const maxRetries = 3;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                synthResponse = await axios.post(config.apiEndpoints.analyze, {
                    apiKey: anthropicKey,
                    messages: [{
                        role: "user",
                        content: synthesisOnlyPrompt(allFacts)
                    }],
                    model: "claude-3-5-sonnet-20241022",
                    max_tokens: 8192,
                    temperature: 0.7,
                    system: synthesisSystem
                });

                synthContent = synthResponse.data.content[0].text;

                // Logging de la phase 2A
                log(`\nStatistiques de tokens (Phase 2A - Tentative ${attempt + 1}/${maxRetries}) :
    - Stop reason : ${synthResponse.data.stop_reason}
    - Tokens en entrée : ${synthResponse.data.tokenCount}
    - Tokens en sortie : ${synthResponse.data.responseTokenCount}
    - Ratio d'utilisation : ${((synthResponse.data.responseTokenCount / 8192) * 100).toFixed(2)}%\n`);
                
                updateGlobalProgress(75);
                break; // Sortir de la boucle si succès
                
            } catch (error) {
                if (attempt === maxRetries - 1) {
                    throw error; // Relancer l'erreur si dernière tentative
                }
                const waitTime = 20000 * (attempt + 1); // 20s, 40s, 60s
                log(`Tentative ${attempt + 1} échouée pour la synthèse. Nouvelle tentative dans ${waitTime/1000} secondes...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // Phase 2B : Génération des questions par lots (90%)
        log("=== Phase 2B : Génération des questions ===");
        resetBatchProgress();
        
        const questionsContent = await generateQuestionBatches(allFacts, anthropicKey);
        updateGlobalProgress(90);

        // Vérifications de la qualité
        const warnings = checkSynthesisQuality(synthContent + questionsContent, 
            synthResponse.data.responseTokenCount, 
            synthResponse.data.stop_reason);
        
        if (warnings.length > 0) {
            log("AVERTISSEMENTS :");
            warnings.forEach(warning => log(warning));
        }

        // Phase 2C : Construction du tableau (90% -> 100%)
        log("=== Phase 2C : Construction du tableau des faits ===");
        updateGlobalProgress(90);
        resetBatchProgress();

        // Initialiser la progression pour le nombre de lots
        initializeBatchProgress(0, allFacts.length);
        
        log(`Début de la construction du tableau (${allFacts.length} lots à traiter)`);

        // Créer le tableau des faits
        let factsTable = '<h2>Tableau chronologique des faits</h2>\n';
        factsTable += '<table class="facts-table">\n';
        factsTable += '<thead><tr><th class="fact-number">N°</th><th class="fact-type">Type</th><th class="fact-content">Fait</th></tr></thead>\n';
        factsTable += '<tbody>\n';
        
        // Fonction optimisée pour ajouter un lot de faits
        async function addFactBatch(factGroup, startNumber, delay) {
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Créer un fragment pour éviter les reflows multiples
            const fragment = document.createDocumentFragment();
            let factsInBatch = 0;
            
            factGroup.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith('CONCEPT:') || 
                    trimmed.startsWith('MÉCANISME:') || 
                    trimmed.startsWith('EXEMPLE:')) {
                    const [type, ...content] = line.split(':');
                    const factText = content.join(':').trim();
                    
                    // Couleurs accessibles avec fort contraste
                    let typeColor;
                    switch(type) {
                        case 'CONCEPT':
                            typeColor = '#0066cc'; // Bleu foncé
                            break;
                        case 'MÉCANISME':
                            typeColor = '#008060'; // Vert foncé
                            break;
                        case 'EXEMPLE':
                            typeColor = '#9933cc'; // Violet
                            break;
                    }
                    
                    const row = document.createElement('tr');
                    row.className = 'fact-row';
                    row.innerHTML = `
                        <td class="fact-number">${startNumber}</td>
                        <td class="fact-type"><span style="color: ${typeColor}"><strong>${type}</strong></span></td>
                        <td class="fact-content">${factText}</td>
                    `;
                    fragment.appendChild(row);
                    startNumber++;
                    factsInBatch++;
                }
            });
            
            // Ajouter tous les éléments d'un coup
            const tbody = document.querySelector('.facts-table tbody');
            tbody.appendChild(fragment);
            
            // Animer toutes les lignes du lot
            requestAnimationFrame(() => {
                const rows = tbody.querySelectorAll('.fact-row:not(.visible)');
                rows.forEach(row => row.classList.add('visible'));
            });
            
            return factsInBatch;
        }
        
        factsTable += '</tbody></table>';
        
        // Ajouter le contenu initial
        const initialContent = marked.parse(synthContent) + 
                             '<h2>Questions de révision</h2>' + 
                             formatMarkdownQuestions(questionsContent) +
                             factsTable;
        
        document.getElementById("synthesisResult").innerHTML = initialContent;
        
        // Ajouter les lots progressivement avec progression
        let factNumber = 1;
        let processedFacts = 0;
        
        for (let i = 0; i < allFacts.length; i++) {
            log(`Traitement du lot ${i + 1}/${allFacts.length}...`);
            updateChunkStatus(0, i, 'processing');
            
            const factsInBatch = await addFactBatch(allFacts[i], factNumber, 300);
            factNumber += factsInBatch;
            
            // Mise à jour de la progression
            const progress = 90 + ((i + 1)/allFacts.length * 10);
            updateGlobalProgress(progress);
            updateChunkStatus(0, i, 'completed');
            
            log(`Lot ${i + 1}/${allFacts.length} traité (${factsInBatch} faits)`);
        }
        // Phase 2 terminée : 100%
        log("Synthèse terminée");
        updateGlobalProgress(100);
        document.getElementById("downloadSynthesisButton").style.display = "block";
    } catch (error) {
        log("Erreur lors de la synthèse : " + error.message);
        alert("Une erreur est survenue lors de la synthèse. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}
