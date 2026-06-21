/**
 * @file main.js
 * @description Point d'entrée principal de l'application frontend.
 * Transkryptor v5 — Cloud Temple SecNumCloud uniquement.
 */

import { getState, updateState } from './state.js';
import * as api from './apiService.js';
import { processAndTranscribeInChunks } from './audioProcessor.js';
import { processAndAnalyzeInBatches } from './analysisProcessor.js';
import * as resultsUI from './ui/results.js';
import * as statsUI from './ui/stats.js';
import * as progressUI from './ui/progress.js';
import * as chartUI from './ui/chart.js';

// --- DOM Elements ---
const modelSelect = document.getElementById('model-select');
const processBtn = document.getElementById('process-btn');
const synthesizeBtn = document.getElementById('synthesize-btn');
const fileInput = document.getElementById('audio-file');
const fileNameSpan = document.getElementById('file-name');
const fileDropZone = document.getElementById('file-drop-zone');
const statTime = document.getElementById('stat-time');
const headerVersion = document.getElementById('header-version');
const serverLogsContent = document.getElementById('server-logs-content');

let timerInterval = null;
let chunkDurations = [];

// --- Functions ---

function findPreferredModel(models) {
    return models.length > 0 ? models[0].id : null;
}

async function updateModelList() {
    try {
        modelSelect.innerHTML = '<option>Chargement...</option>';
        const models = await api.getModels();
        modelSelect.innerHTML = '';
        if (models && models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
            
            const defaultModel = findPreferredModel(models);
            if (defaultModel) {
                modelSelect.value = defaultModel;
                updateState({ selectedModel: defaultModel });
            }
        } else {
            modelSelect.innerHTML = '<option>Aucun modèle trouvé</option>';
        }
    } catch (error) {
        modelSelect.innerHTML = '<option>Erreur de chargement</option>';
    }
}

function handleFileSelect() {
    const file = fileInput.files[0];
    if (file) {
        updateState({ selectedFile: file });
        fileNameSpan.textContent = file.name;
        fileDropZone.classList.add('has-file');
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        statsUI.updateStats({ size: `0.00 / ${fileSize} MB` });
    }
}

async function handleProcess() {
    const state = getState();
    if (!state.selectedFile) {
        alert("Veuillez sélectionner un fichier audio.");
        return;
    }

    processBtn.disabled = true;
    synthesizeBtn.disabled = true;
    processBtn.innerHTML = '⏳ Traitement en cours...';

    chunkDurations = [];
    const startTime = Date.now();
    timerInterval = setInterval(() => {
        statTime.textContent = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    }, 100);

    try {
        statsUI.showStats();
        progressUI.clearProgress();
        chartUI.resetChart();
        resultsUI.showPlaceholder('🎙️ Préparation du fichier audio...');

        const onTranscriptionProgress = (progress) => {
            switch (progress.type) {
                case 'audio_info':
                    statsUI.renderFileInfo(progress);
                    break;
                case 'chunk_processing':
                    progressUI.updateChunkStatus(progress.chunkIndex, 'processing');
                    break;
                case 'chunk_retrying':
                    progressUI.updateChunkStatus(progress.chunkIndex, 'retrying');
                    break;
                case 'chunk_error':
                    progressUI.updateChunkStatus(progress.chunkIndex, 'error');
                    break;
                case 'chunk_completed': {
                    const elapsedTime = (Date.now() - startTime) / 1000;
                    const speedRatio = (progress.processedDuration / elapsedTime).toFixed(1);
                    const totalSize = (state.selectedFile.size / (1024*1024)).toFixed(2);
                    const processedSize = ((progress.completed / progress.total) * state.selectedFile.size / (1024*1024)).toFixed(2);
                    
                    if (progress.chunkDuration) chunkDurations.push(progress.chunkDuration);
                    const avgTime = (chunkDurations.reduce((a, b) => a + b, 0) / chunkDurations.length / 1000).toFixed(1);

                    statsUI.updateStats({
                        progress: `${progress.completed} / ${progress.total}`,
                        speed: `x${speedRatio}`,
                        size: `${processedSize} / ${totalSize} MB`,
                        avgTime: `${avgTime}s`
                    });
                    progressUI.updateChunkStatus(progress.chunkIndex, 'completed');
                    chartUI.addChartData(elapsedTime.toFixed(1), speedRatio);

                    if (progress.currentText) {
                        updateState({ results: { ...getState().results, transcription: progress.currentText } });
                        resultsUI.updateTranscriptionView();
                    }
                    break;
                }
                default:
                    progressUI.setupProgress(progress.total);
            }
        };

        await processAndTranscribeInChunks(state.selectedFile, onTranscriptionProgress);
        
        resultsUI.setActiveTab('analysis');
        resultsUI.showPlaceholder('🔍 Analyse du texte en cours...');
        progressUI.clearProgress();
        chartUI.resetChart();
        chartUI.updateChartLabel('Vitesse (tokens/s)');
        statsUI.updateStatLabel('size', 'Tokens');
        
        const analysisStartTime = Date.now();
        let totalTokens = 0;

        const onAnalysisProgress = (progress) => {
            if (progress.totalTokens) totalTokens = progress.totalTokens;
            switch (progress.type) {
                case 'chunk_processing':
                    progressUI.updateChunkStatus(progress.chunkIndex, 'processing');
                    break;
                case 'chunk_retrying':
                    progressUI.updateChunkStatus(progress.chunkIndex, 'retrying');
                    break;
                case 'chunk_error':
                    progressUI.updateChunkStatus(progress.chunkIndex, 'error');
                    break;
                case 'chunk_completed': {
                    const elapsedTime = (Date.now() - analysisStartTime) / 1000;
                    const speed = (progress.processedTokens / (elapsedTime || 1)).toFixed(0);
                    const avgTime = (elapsedTime / progress.completed).toFixed(1);
                    statsUI.updateStats({
                        progress: `${progress.completed} / ${progress.total}`,
                        speed: `${speed} tokens/s`,
                        size: `${progress.processedTokens} / ${totalTokens}`,
                        avgTime: `${avgTime}s`
                    });
                    progressUI.updateChunkStatus(progress.chunkIndex, 'completed');
                    chartUI.addChartData(elapsedTime.toFixed(1), speed);

                    if (progress.currentText) {
                        updateState({ results: { ...getState().results, analysis: progress.currentText } });
                        resultsUI.updateAnalysisView();
                    }
                    break;
                }
                default:
                    progressUI.setupProgress(progress.total);
                    if (progress.totalTokens) {
                        statsUI.updateStats({ size: `0 / ${progress.totalTokens}` });
                    }
            }
        };

        await processAndAnalyzeInBatches({
            text: state.results.transcription,
            model: state.selectedModel,
            onProgress: onAnalysisProgress,
            totalFileSize: state.selectedFile.size
        });
        
        resultsUI.updateAnalysisView(); 
        synthesizeBtn.disabled = false;
        updateState({ processingState: 'done' });

    } catch (error) {
        updateState({ processingState: 'error' });
        let errorMessage = error.message;
        if (error instanceof DOMException) {
            errorMessage = "Impossible de décoder le fichier audio. Il est peut-être corrompu ou dans un format non supporté.";
        }
        resultsUI.showPlaceholder(`❌ Erreur : ${errorMessage}`);
        statsUI.hideStats();
        alert(`Erreur: ${errorMessage}`);
    } finally {
        processBtn.disabled = false;
        processBtn.innerHTML = '🚀 Lancer le Traitement';
        clearInterval(timerInterval);
    }
}

async function handleSynthesize() {
    const state = getState();
    if (!state.results.analysis) {
        alert("Veuillez d'abord terminer une analyse.");
        return;
    }

    synthesizeBtn.disabled = true;
    synthesizeBtn.innerHTML = '⏳ Synthèse...';

    try {
        updateState({ processingState: 'synthesizing' });
        resultsUI.setActiveTab('synthesis');
        resultsUI.showPlaceholder('📝 Génération de la synthèse en cours...');

        const synthesisResult = await api.synthesize(state.results.analysis, state.selectedModel);
        
        updateState({ 
            results: { ...state.results, synthesis: synthesisResult.synthesis },
            processingState: 'done' 
        });
        
        resultsUI.updateSynthesisView();

    } catch (error) {
        updateState({ processingState: 'error' });
        resultsUI.showPlaceholder(`❌ Erreur lors de la synthèse : ${error.message}`);
        alert(`Erreur de synthèse: ${error.message}`);
    } finally {
        synthesizeBtn.disabled = false;
        synthesizeBtn.innerHTML = '📝 Synthèse';
    }
}

async function initialize() {
    // ID client unique
    const clientId = `client_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`;
    updateState({ clientId });

    // Charger la version
    const version = await api.getVersion();
    updateState({ appVersion: version });
    if (headerVersion) headerVersion.textContent = `v${version}`;

    // Init modules UI
    resultsUI.initResults();
    statsUI.initStats();
    progressUI.initProgress('progress-visualization');
    chartUI.initChart(document.getElementById('performance-chart'));

    // Event listeners
    modelSelect.addEventListener('change', (e) => updateState({ selectedModel: e.target.value }));
    fileInput.addEventListener('change', handleFileSelect);
    processBtn.addEventListener('click', handleProcess);
    synthesizeBtn.addEventListener('click', handleSynthesize);

    // Drag & drop sur la zone de fichier
    if (fileDropZone) {
        fileDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropZone.classList.add('dragover');
        });
        fileDropZone.addEventListener('dragleave', () => {
            fileDropZone.classList.remove('dragover');
        });
        fileDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect();
            }
        });
    }

    // SSE logs
    const logSource = new EventSource(`/api/logs?clientId=${clientId}`);
    logSource.onmessage = (event) => {
        const logData = JSON.parse(event.data);
        const p = document.createElement('p');
        p.textContent = logData;
        serverLogsContent.appendChild(p);
        serverLogsContent.scrollTop = serverLogsContent.scrollHeight;
    };

    // Charger les modèles
    updateModelList();
}

document.addEventListener('DOMContentLoaded', initialize);
