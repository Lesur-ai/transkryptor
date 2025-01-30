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

        const prompt = `Tu es un expert en analyse pédagogique. Génère une synthèse COMPLÈTE sans jamais t'interrompre.
        RÈGLE ABSOLUE : Produis une réponse intégrale en une fois, sans AUCUNE mention de suite ou de continuation. Utilise le style de réponse normal.
        
        Crée une fiche de révision Markdown structurée :
        
        # [Titre synthétique du sujet]
        
        ## Concepts essentiels 
        - 6-8 concepts clés avec définitions didactiques
        - Relations entre les concepts
        
        ## Points principaux 
        - 4-5 points majeurs et pourquoi
        - 4-5 points complémentaires
        
        ## Analyse thématique 
        
        - Concepts centraux
        - Points clés
        - Citations pertinentes
        - Applications
        
        ## Questions de révision
        Fait une dizaine de questions de révision.
        Q: [Question concise]
        R: [Réponse claire]
        A: [Application pratique]
        
        RÈGLES DE RÉDACTION :
        - rédige de facon didactique
        - Limites de mots strictes par section
        - Format Q/R/A uniquement pour clarté
        - Pas de métacommentaires
        - Pas de mentions de suite
        - Une seule réponse complète
        
        
        Texte à analyser :
        ${analyzedTranscription}`;

        log("Envoi de la demande de synthèse...");
        const response = await axios.post(CONFIG.apiEndpoints.analyze, {
            prompt,
            apiKey: anthropicKey,
        });

        const outputTokens = response.data.responseTokenCount;
        const inputTokens = response.data.tokenCount;
        const stopReason = response.data.stop_reason;
        const contentText = response.data.content[0].text;

        // Vérifications de la qualité
        const warnings = [];
        
        if (outputTokens < 900) {
            warnings.push("⚠️ Réponse anormalement courte (moins de 900 tokens)");
        }
        
        const incompletenessMarkers = [
            "[Suite", "continuer", "poursuivre", "[...]",
            "section suivante", "limite de caractères",
            "Note :", "dépasserait", "pour illustrer"
        ];
        
        if (incompletenessMarkers.some(marker => contentText.toLowerCase().includes(marker.toLowerCase()))) {
            warnings.push("⚠️ Détection de marqueurs d'incomplétude dans la réponse");
        }
        
        if (stopReason !== "end_turn") {
            warnings.push(`⚠️ Arrêt anormal de la génération (${stopReason})`);
        }

        // Vérification de la structure
        const requiredSections = [
            "# ", 
            "## Concepts essentiels",
            "## Points principaux",
            "## Analyse thématique",
            "## Questions de révision"
        ];
        
        const missingSections = requiredSections.filter(section => 
            !contentText.includes(section)
        );
        
        if (missingSections.length > 0) {
            warnings.push(`⚠️ Sections manquantes : ${missingSections.join(", ")}`);
        }

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

        document.getElementById("synthesisResult").innerHTML = marked.parse(contentText);
        updateGlobalProgress(100);
        document.getElementById("downloadSynthesisButton").style.display = "block";
    } catch (error) {
        log("Erreur lors de la synthèse : " + error.message);
        alert("Une erreur est survenue lors de la synthèse. Veuillez vérifier les logs de débogage pour plus de détails.");
    }
}