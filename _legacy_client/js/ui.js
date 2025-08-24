async function downloadTranscription() {
    const blob = new Blob([rawTranscription], { type: "text/plain;charset=utf-8" });
    downloadFile(blob, "transcription.txt");
}

async function downloadAnalysis() {
    const blob = new Blob([analyzedTranscription], { type: "text/plain;charset=utf-8" });
    downloadFile(blob, "analyzed_transcription.txt");
}

async function downloadSynthesis() {
    const synthesisContent = document.getElementById("synthesisResult").innerHTML;
    const blob = new Blob([synthesisContent], { type: "text/html;charset=utf-8" });
    downloadFile(blob, "synthesis.html");
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
}

function loadTranscription() {
    const input = document.getElementById('transcriptionFile');
    input.click();
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                rawTranscription = e.target.result;
                document.getElementById("rawTranscription").textContent = rawTranscription;
                log("Transcription chargée avec succès");
            };
            reader.readAsText(file);
        }
    };
}

function loadAnalysis() {
    const input = document.getElementById('analysisFile');
    input.click();
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                analyzedTranscription = e.target.result;
                document.getElementById("analyzeResult").textContent = analyzedTranscription;
                log("Analyse chargée avec succès");
                document.getElementById("synthesizeButton").style.display = "block";
            };
            reader.readAsText(file);
        }
    };
}

import { getConfig } from './config.js';

function saveAPIKeys() {
    const openaiKey = document.getElementById("openaiKey").value;
    const anthropicKey = document.getElementById("anthropicKey").value;
    const config = getConfig();

    if (openaiKey) {
        localStorage.setItem(config.storage.openaiKey, openaiKey);
    }
    if (anthropicKey) {
        localStorage.setItem(config.storage.anthropicKey, anthropicKey);
    }
}

function loadAPIKeys() {
    const config = getConfig();
    const openaiKey = localStorage.getItem(config.storage.openaiKey);
    const anthropicKey = localStorage.getItem(config.storage.anthropicKey);

    if (openaiKey) {
        document.getElementById("openaiKey").value = openaiKey;
    }
    if (anthropicKey) {
        document.getElementById("anthropicKey").value = anthropicKey;
    }
}

function clearAPIKeys() {
    const config = getConfig();
    if (confirm("Voulez-vous vraiment effacer les clés API sauvegardées ?")) {
        localStorage.removeItem(config.storage.openaiKey);
        localStorage.removeItem(config.storage.anthropicKey);
        document.getElementById("openaiKey").value = '';
        document.getElementById("anthropicKey").value = '';
        log("Clés API effacées");
    }
}
