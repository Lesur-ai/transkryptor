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
            log(`Traitement du lot ${i+1}/${totalBatches}`);

            const prompt = `Tu es un expert en correction de verbatim. Tu dois corriger le texte suivant en:
- Corrigeant uniquement les erreurs de français et de grammaire
- Ajustant la ponctuation pour une meilleure lisibilité
- Conservant exactement le style et le contenu du discours
- Ne faisant aucune analyse ni résumé

Instructions critiques:
- Ne commence PAS ta réponse par une phrase d'introduction
- Ne termine PAS ta réponse par une conclusion
- Renvoie UNIQUEMENT le texte corrigé
- Ne commente PAS les corrections

Voici le texte à corriger (lot ${i+1}/${totalBatches}):

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
            log(`Lot ${i+1}/${totalBatches} traité. Tokens utilisés : ${response.data.tokenCount}, Tokens de réponse : ${response.data.responseTokenCount}`);
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

        const prompt = `En tant qu'expert en analyse de contenu, crée une fiche de synthèse complète et détaillée au format Markdown du texte suivant. 

Structure requise :
# [Titre approprié]

## Résumé des points clés
[Liste des 3-5 points essentiels]

## Analyse détaillée
[Pour chaque section thématique principale]
### [Titre de la section]
[3 points clés maximum par section, chacun expliqué en une phrase complète]

## Questions de cours
[20 questions pertinentes avec leurs réponses, structurées ainsi:]
1. Q: [Question]
   R: [Réponse]
   Justification: [Citation ou référence du texte]

Règles importantes:
- Reste factuel et objectif
- Ne fais aucune interprétation non justifiée par le texte
- Cite précisément le texte source pour les justifications
- Utilise un style clair et professionnel

Texte à analyser:

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