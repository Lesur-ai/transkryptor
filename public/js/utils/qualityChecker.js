// Vérification de la qualité de la synthèse
export function checkSynthesisQuality(contentText, outputTokens, stopReason) {
    const warnings = [];
    
    // Vérification de la longueur
    if (outputTokens < 900) {
        warnings.push("⚠️ Réponse anormalement courte (moins de 900 tokens)");
    }
    
    // Vérification des marqueurs d'incomplétude
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
        "1. Introduction au sujet",
        "2. Concepts fondamentaux",
        "3. Mécanismes et applications",
        "4. Analyse et implications",
        "5. Questions de révision"
    ];
    
    const missingSections = requiredSections.filter(section => 
        !contentText.includes(section)
    );
    
    if (missingSections.length > 0) {
        warnings.push(`⚠️ Sections manquantes : ${missingSections.join(", ")}`);
    }

    // Vérification des questions et réponses
    const questionPattern = /\d+\.\s+Question\s*:/i;
    const questionMatches = contentText.match(new RegExp(questionPattern, 'g')) || [];
    if (questionMatches.length < 15) {
        warnings.push(`⚠️ Nombre insuffisant de questions : ${questionMatches.length}/15`);
    }

    const answerPattern = /\s*Réponse\s*:/i;
    const answerMatches = contentText.match(new RegExp(answerPattern, 'g')) || [];
    if (answerMatches.length < questionMatches.length) {
        warnings.push("⚠️ Certaines questions n'ont pas de réponses");
    }


    return warnings;
}
