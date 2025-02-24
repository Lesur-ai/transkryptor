import { debugStyle } from './styles/debugStyle.js';
import { checkSynthesisQuality } from './utils/qualityChecker.js';
import { synthesisPrompt, synthesisSystem } from './prompts/synthesisPrompts.js';
import { extractFactsFromParagraph } from './utils/factExtractor.js';
import { getAnalyzedTranscription, getConfig } from './state.js';
import { log, updateGlobalProgress } from './utils/utils.js';

export async function synthesizeAnalysis() {
    try {
        const anthropicKey = document.getElementById("anthropicKey").value;
        const analyzedTranscription = getAnalyzedTranscription();
        const config = getConfig();

        if (!analyzedTranscription || !anthropicKey) {
            throw new Error("Veuillez d'abord analyser la transcription ou charger une analyse.");
        }

        // Appliquer le style des logs
        const style = document.createElement('style');
        style.textContent = debugStyle;
        document.head.appendChild(style);

        log("Début de l'extraction des faits...");
        updateGlobalProgress(0);

        // Découper en paragraphes
        const paragraphs = analyzedTranscription.split(/\n\n+/);
        let allFacts = [];
        let completedParagraphs = 0;

        // Extraire les faits de chaque paragraphe
        for (const paragraph of paragraphs) {
            if (paragraph.trim()) {
                log(`=== Paragraphe ${completedParagraphs + 1}/${paragraphs.length} ===`);
                const facts = await extractFactsFromParagraph(paragraph, anthropicKey, allFacts);
                allFacts.push(facts);
                
                // Afficher les faits dans les logs web
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
                
                // Mise à jour de la progression
                updateGlobalProgress((completedParagraphs / paragraphs.length) * 90);
                completedParagraphs++;
            }
        }

        log("=== Création de la synthèse ===");
        // Phase 2 commence à 90%
        updateGlobalProgress(90);
        
        // Synthèse finale avec tous les faits
        const response = await axios.post(config.apiEndpoints.analyze, {
            apiKey: anthropicKey,
            messages: [{
                role: "user",
                content: synthesisPrompt(allFacts)
            }],
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 8192,
            temperature: 0.7,
            system: synthesisSystem
        });

        const outputTokens = response.data.responseTokenCount;
        const inputTokens = response.data.tokenCount;
        const stopReason = response.data.stop_reason;
        const contentText = response.data.content[0].text;

        // Vérifications de la qualité
        const warnings = checkSynthesisQuality(contentText, outputTokens, stopReason);

        // Logging
        log(`Statistiques de tokens :
    - Stop reason : ${stopReason}
    - Tokens en entrée : ${inputTokens}
    - Tokens en sortie : ${outputTokens}
    - Ratio d'utilisation : ${((outputTokens / 8192) * 100).toFixed(2)}%`);
        
        if (warnings.length > 0) {
            log("AVERTISSEMENTS :");
            warnings.forEach(warning => log(warning));
        }

        // Créer le tableau des faits
        let factsTable = "\n\n## Tableau chronologique des faits\n\n";
        factsTable += "| N° | Type | Fait |\n";
        factsTable += "|-----|------|------|\n";
        
        // Parcourir les faits collectés pendant la phase 1
        let factNumber = 1;
        allFacts.forEach(factGroup => {
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
                    
                    factsTable += `| ${factNumber} | <span style="color: ${typeColor}"><strong>${type}</strong></span> | ${factText} |\n`;
                    factNumber++;
                }
            });
        });

        // Ajouter le tableau à la synthèse
        const finalContent = contentText + factsTable;
        
        document.getElementById("synthesisResult").innerHTML = marked.parse(finalContent);
        // Phase 2 terminée : 100%
        log("Synthèse terminée");
        updateGlobalProgress(100);
        document.getElementById("downloadSynthesisButton").style.display = "block";
    } catch (error) {
        log("Erreur lors de la synthèse : " + error.message);
        alert("Une erreur est survenue lors de la synthèse. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}
