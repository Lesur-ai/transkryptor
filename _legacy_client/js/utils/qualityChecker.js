// Vérification de la qualité de la synthèse
export function checkSynthesisQuality(contentText, outputTokens, stopReason) {
    const warnings = [];
    
    // Vérification de la longueur
    if (outputTokens < 50) {
        warnings.push("⚠️ Réponse anormalement courte (moins de 50 tokens)");
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


    return warnings;
}
