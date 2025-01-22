async function analyzeTranscription() {
    try {
        const anthropicKey = document.getElementById("anthropicKey").value;
        if (!rawTranscription || !anthropicKey) {
            throw new Error("Veuillez d'abord transcrire un fichier audio ou charger une transcription.");
        }

        log("Début de l'analyse...");
        updateGlobalProgress(0);

        const sentences = rawTranscription.match(/[^.!?]+[.!?]+/g) || [];
        const batchSize = 1000;
        let currentBatch = "";
        let batches = [];
        let tokenCount = 0;

        for (let sentence of sentences) {
            const sentenceTokens = sentence.split(/\s+/).length;
            if (tokenCount + sentenceTokens > batchSize && currentBatch) {
                batches.push(currentBatch.trim());
                currentBatch = "";
                tokenCount = 0;
            }
            currentBatch += sentence + " ";
            tokenCount += sentenceTokens;
        }
        if (currentBatch) {
            batches.push(currentBatch.trim());
        }

        const totalBatches = batches.length;
        let completedBatches = 0;
        analyzedTranscription = '';

        for (let i = 0; i < totalBatches; i++) {
            log(`Traitement du lot ${i + 1}/${totalBatches}`);

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
            
            Voici la transcription à corriger (lot ${i + 1}/${totalBatches}) :
            
            ${batches[i]}`;

            const response = await axios.post(CONFIG.apiEndpoints.analyze, {
                prompt,
                apiKey: anthropicKey
            });

            // Nettoyer la réponse de Claude
            let correctedText = response.data.content[0].text.trim();

            // Supprimer les phrases d'introduction communes
            correctedText = correctedText.replace(/^(Voici |Here's |Here is |Le )?([Ll]e )?verbatim( corrigé| nettoyé| propre)?( et)?( corrigé| nettoyé| propre)? ?:?\s*/g, '');

            // Supprimer les phrases de conclusion communes
            correctedText = correctedText.replace(/\s*(J'ai |J'espère |Le texte |Voici |Le verbatim |La correction )?(est )?(maintenant )?(corrigé|terminé|fini|complete|fait)\.?$/g, '');

            analyzedTranscription += correctedText + '\n\n';
            document.getElementById("analyzeResult").textContent = analyzedTranscription;

            completedBatches++;
            updateGlobalProgress((completedBatches / totalBatches) * 100);
            log(`Lot ${i + 1}/${totalBatches} traité. Tokens utilisés : ${response.data.tokenCount}, Tokens de réponse : ${response.data.responseTokenCount}`);
        }

        log("Analyse terminée.");
        document.getElementById("downloadAnalysisButton").style.display = "block";
        document.getElementById("synthesizeButton").style.display = "block";
    } catch (error) {
        log("Erreur lors de l'analyse : " + error.message);
        alert("Une erreur est survenue lors de l'analyse. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}

async function synthesizeAnalysis() {
    try {
        const anthropicKey = document.getElementById("anthropicKey").value;
        if (!analyzedTranscription || !anthropicKey) {
            throw new Error("Veuillez d'abord analyser la transcription ou charger une analyse.");
        }

        log("Début de la synthèse...");
        updateGlobalProgress(0);

        const prompt = `En tant qu'expert en analyse de contenu pédagogique, crée une fiche de révision structurée et complète au format Markdown. 

STRUCTURE REQUISE :

# [Titre synthétique et précis]

## Concepts fondamentaux
- 5-7 concepts clés avec définitions concises
- Mots-clés et termes techniques essentiels
- Contextualisation historique brève

## Résumé structuré
### Points majeurs (3-4)
- Idées fondamentales
- Concepts structurants
- Contexte historique essentiel

### Points complémentaires (4-5)
- Exemples significatifs
- Applications concrètes
- Évolutions importantes

## Analyse thématique détaillée (3-5 sections)
Pour chaque thème principal :
### [Titre du thème]
- Concept central en une phrase
- 2-3 sous-points avec exemples précis
- Citations essentielles du texte
- Contextualisation historique
- Liens avec les autres thèmes
- Évolution ou transformation dans le temps

## Aide à la mémorisation et synthèse
- Chronologie des événements clés
- Relations entre les concepts
- Points de vigilance
- Schéma conceptuel suggéré
- Transitions importantes

## Questions de révision (20 questions total)
### Connaissances fondamentales (7 questions)
- Définitions précises
- Concepts clés
- Chronologie et contexte

### Analyse et compréhension (7 questions)
- Comparaisons
- Cas pratiques
- Évolutions historiques

### Synthèse et réflexion (6 questions)
- Questions transversales
- Mises en perspective
- Analyse critique

Format pour chaque question :
1. Q: [Question précise]
   N: [Niveau : Fondamental/Analyse/Synthèse]
   R: [Réponse structurée]
   J: [Justification avec citation exacte]
   C: [Contexte historique pertinent]
   A: [Aide à la mémorisation]
   L: [Liens avec d'autres concepts]

RÈGLES DE RÉDACTION :
- Style académique clair et précis
- Phrases concises mais complètes
- Citations exactes avec référence et contexte
- Objectivité rigoureuse
- Progression logique
- Liens explicites entre sections
- Équilibre entre concision et exhaustivité
- Contextualisation systématique

FORMAT DE SORTIE :
- Markdown strict
- Hiérarchie claire des titres
- Listes à puces uniformes
- Espacement optimisé
- Cohérence typographique
- Citations formatées uniformément

Texte à analyser :
${analyzedTranscription}`;

        log("Envoi de la demande de synthèse...");
        const response = await axios.post(CONFIG.apiEndpoints.analyze, {
            prompt,
            apiKey: anthropicKey
        });

        document.getElementById("synthesisResult").innerHTML = marked.parse(response.data.content[0].text);
        updateGlobalProgress(100);
        document.getElementById("downloadSynthesisButton").style.display = "block";
        log("Synthèse terminée. Tokens utilisés : " + response.data.tokenCount + ", Tokens de réponse : " + response.data.responseTokenCount);
    } catch (error) {
        log("Erreur lors de la synthèse : " + error.message);
        alert("Une erreur est survenue lors de la synthèse. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}