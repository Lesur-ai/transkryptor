import { getRawTranscription, getAnalyzedTranscription } from '../state.js';
import { log } from './utils.js';

// Fonction utilitaire pour le téléchargement
function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Téléchargement de la transcription
export function downloadTranscription() {
    try {
        const rawTranscription = getRawTranscription();
        if (!rawTranscription) {
            throw new Error("Aucune transcription à télécharger");
        }
        
        const filename = `transcription_${new Date().toISOString().slice(0,10)}.txt`;
        downloadFile(rawTranscription, filename);
        log("Transcription téléchargée : " + filename);
    } catch (error) {
        log("Erreur lors du téléchargement de la transcription : " + error.message);
        alert(error.message);
    }
}

// Téléchargement de l'analyse
export function downloadAnalysis() {
    try {
        const analyzedTranscription = getAnalyzedTranscription();
        if (!analyzedTranscription) {
            throw new Error("Aucune analyse à télécharger");
        }
        
        const filename = `analyse_${new Date().toISOString().slice(0,10)}.txt`;
        downloadFile(analyzedTranscription, filename);
        log("Analyse téléchargée : " + filename);
    } catch (error) {
        log("Erreur lors du téléchargement de l'analyse : " + error.message);
        alert(error.message);
    }
}

// Génération du HTML pour la synthèse
function generateSynthesisHTML(content) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Synthèse</title>
    <style>
        body {
            font-family: 'Google Sans', -apple-system, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 20px;
            color: #202124;
        }
        h1 { color: #202124; font-size: 28px; }
        h2 { color: #3c4043; font-size: 22px; margin-top: 32px; }
        h3 { color: #5f6368; font-size: 18px; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
        }
        th, td {
            padding: 12px;
            border: 1px solid #e8eaed;
            text-align: left;
        }
        th { background: #f8f9fa; }
        code { background: #f8f9fa; padding: 2px 4px; border-radius: 4px; }
        blockquote {
            margin: 0;
            padding: 12px 24px;
            border-left: 4px solid #dadce0;
            background: #f8f9fa;
        }
        
        /* Questions */
        .question-block {
            background-color: #f8f9fa;
            border-left: 4px solid #0066cc;
            margin: 1em 0;
            padding: 1em;
            border-radius: 4px;
        }
        .question {
            color: #0066cc;
            font-weight: 500;
            margin-bottom: 0.5em;
        }
        .reponse {
            color: #008060;
            margin-bottom: 0.5em;
            padding-left: 1em;
            border-left: 2px solid #008060;
        }
        .application {
            color: #9933cc;
            font-style: italic;
            margin-top: 0.5em;
            padding-left: 1em;
            border-left: 2px solid #9933cc;
        }
        
        /* Tableau des faits */
        .facts-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            font-size: 0.95em;
        }
        .facts-table th,
        .facts-table td {
            padding: 0.75em;
            border: 1px solid #ddd;
            text-align: left;
        }
        .facts-table th {
            background-color: #f8f9fa;
            font-weight: 500;
        }
        .facts-table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .facts-table tr:hover {
            background-color: #f0f0f0;
        }
        .facts-table .fact-number {
            width: 50px;
            text-align: center;
            font-weight: 500;
        }
        .facts-table .fact-type {
            width: 120px;
            text-align: center;
        }
        .facts-table .fact-content {
            line-height: 1.4;
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}

// Téléchargement de la synthèse
export function downloadSynthesis() {
    try {
        const synthesisResult = document.getElementById("synthesisResult").innerHTML;
        if (!synthesisResult) {
            throw new Error("Aucune synthèse à télécharger");
        }
        
        const filename = `synthese_${new Date().toISOString().slice(0,10)}.html`;
        const htmlContent = generateSynthesisHTML(synthesisResult);
        
        // Télécharger comme HTML
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        
        log("Synthèse téléchargée : " + filename);
    } catch (error) {
        log("Erreur lors du téléchargement de la synthèse : " + error.message);
        alert(error.message);
    }
}

// Export pour l'interface globale
window.downloadTranscription = downloadTranscription;
window.downloadAnalysis = downloadAnalysis;
window.downloadSynthesis = downloadSynthesis;
