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
