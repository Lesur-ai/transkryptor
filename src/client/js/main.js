/**
 * @file main.js
 * @description Point d'entrée principal de l'application frontend.
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
const workflowOptions = document.querySelectorAll('.workflow-option');
const modelSelect = document.getElementById('model-select');
const processBtn = document.getElementById('process-btn');
const fileInput = document.getElementById('audio-file');
const openaiKeyInput = document.getElementById('openai-key');
const anthropicKeyInput = document.getElementById('anthropic-key');
const fileNameSpan = document.getElementById('file-name');
const statTime = document.getElementById('stat-time');
const fileInfoCard = document.getElementById('file-info-card');
const serverLogsContent = document.getElementById('server-logs-content');
const chartCard = document.querySelector('.chart-card');

let timerInterval = null;
let chunkDurations = []; // Pour stocker les durées de chaque chunk

// --- Functions ---

async function updateModelList(provider) {
    try {
        modelSelect.innerHTML = '<option>Chargement...</option>';
        const models = await api.getModels(provider);
        modelSelect.innerHTML = '';
        if (models && models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
            
            const preferredModel = 'qwen3:30b-a3b';
            const defaultModel = models.find(m => m.id === preferredModel) ? preferredModel : models[0].id;
            modelSelect.value = defaultModel;
            updateState({ selectedModel: defaultModel });
        } else {
            modelSelect.innerHTML = '<option>Aucun modèle trouvé</option>';
        }
    } catch (error) {
        modelSelect.innerHTML = '<option>Erreur de chargement</option>';
    }
}

function handleWorkflowChange(event) {
    const selectedWorkflow = event.currentTarget.dataset.workflow;
    updateState({ currentWorkflow: selectedWorkflow });
    workflowOptions.forEach(opt => opt.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('config-cloud-temple').style.display = selectedWorkflow === 'cloud-temple' ? 'block' : 'none';
    document.getElementById('config-openai-anthropic').style.display = selectedWorkflow === 'openai-anthropic' ? 'block' : 'none';
    if (selectedWorkflow === 'cloud-temple') {
        updateModelList('cloud-temple');
    } else {
        modelSelect.innerHTML = `<option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>`;
        updateState({ selectedModel: 'claude-3-5-sonnet-20240620' });
    }
}

function handleFileSelect() {
    const file = fileInput.files[0];
    if (file) {
        updateState({ selectedFile: file });
        fileNameSpan.textContent = file.name;
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
    if (state.currentWorkflow === 'openai-anthropic') {
        updateState({ apiKeys: { openai: openaiKeyInput.value, anthropic: anthropicKeyInput.value } });
    }

    processBtn.disabled = true;
    processBtn.textContent = 'Traitement en cours...';
    chunkDurations = []; // Réinitialise les durées
    const startTime = Date.now();
    timerInterval = setInterval(() => {
        statTime.textContent = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    }, 100);

    try {
        statsUI.showStats();
        progressUI.clearProgress();
        chartUI.resetChart();
        chartCard.style.display = 'block';
        resultsUI.showPlaceholder('Préparation du fichier audio...');

        const onTranscriptionProgress = (progress) => {
            console.log('PROGRESS EVENT:', progress); // Log de débogage
            switch (progress.type) {
                case 'audio_info':
                    statsUI.renderFileInfo(progress);
                    fileInfoCard.style.display = 'block';
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
                
                if (progress.chunkDuration) {
                    chunkDurations.push(progress.chunkDuration);
                }
                const avgTime = (chunkDurations.reduce((a, b) => a + b, 0) / chunkDurations.length / 1000).toFixed(1);

                statsUI.updateStats({
                    progress: `${progress.completed} / ${progress.total}`,
                    speed: `x${speedRatio}`,
                    size: `${processedSize} / ${totalSize} MB`,
                    avgTime: `${avgTime}s`
                });
                progressUI.updateChunkStatus(progress.chunkIndex, 'completed');
                chartUI.addChartData(elapsedTime.toFixed(1), speedRatio);
                break;
            }
            default: // Initial call
                progressUI.setupProgress(progress.total);
            }
        };

        const transcriptionProvider = state.currentWorkflow === 'cloud-temple' ? 'cloud-temple' : 'openai';
        const transcriptionText = await processAndTranscribeInChunks(state.selectedFile, transcriptionProvider, state.apiKeys.openai, onTranscriptionProgress);
        updateState({ results: { ...state.results, transcription: transcriptionText } });
        resultsUI.updateTranscriptionView();

        resultsUI.showPlaceholder('Analyse du texte en cours...');
        progressUI.clearProgress();
        chartUI.resetChart();
        chartUI.updateChartLabel('Vitesse (tokens/s)');
        const analysisStartTime = Date.now();

        const onAnalysisProgress = (progress) => {
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
                const totalSize = (state.selectedFile.size / (1024*1024)).toFixed(2);
                const processedSize = (progress.processedSize / (1024*1024)).toFixed(2);
                const avgTime = (elapsedTime / progress.completed).toFixed(1);
                statsUI.updateStats({
                    progress: `${progress.completed} / ${progress.total}`,
                    speed: `${speed} tokens/s`,
                    size: `${processedSize} / ${totalSize} MB`,
                    avgTime: `${avgTime}s`
                });
                progressUI.updateChunkStatus(progress.chunkIndex, 'completed');
                chartUI.addChartData(elapsedTime.toFixed(1), speed);
                break;
            }
            default: // Initial call
                progressUI.setupProgress(progress.total);
            }
        };

        const analysisProvider = state.currentWorkflow === 'cloud-temple' ? 'cloud-temple' : 'anthropic';
        const analysisText = await processAndAnalyzeInBatches({
            text: state.results.transcription,
            provider: analysisProvider,
            model: state.selectedModel,
            apiKey: state.apiKeys.anthropic,
            onProgress: onAnalysisProgress,
            totalFileSize: state.selectedFile.size
        });
        updateState({ results: { ...state.results, analysis: analysisText } });
        resultsUI.updateAnalysisView();

        updateState({ processingState: 'done' });
        alert("Traitement terminé !");

    } catch (error) {
        updateState({ processingState: 'error' });
        resultsUI.showPlaceholder(`Une erreur est survenue : ${error.message}`);
        statsUI.hideStats();
        alert(`Erreur: ${error.message}`);
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = 'Lancer le Traitement';
        clearInterval(timerInterval);
    }
}

function initialize() {
    resultsUI.initResults();
    statsUI.initStats();
    progressUI.initProgress('progress-visualization');
    chartUI.initChart(document.getElementById('performance-chart'));

    workflowOptions.forEach(opt => opt.addEventListener('click', handleWorkflowChange));
    modelSelect.addEventListener('change', (e) => updateState({ selectedModel: e.target.value }));
    fileInput.addEventListener('change', handleFileSelect);
    processBtn.addEventListener('click', handleProcess);

    const logSource = new EventSource('/api/logs');
    logSource.onmessage = (event) => {
        const logData = JSON.parse(event.data);
        const p = document.createElement('p');
        p.textContent = logData;
        serverLogsContent.appendChild(p);
        serverLogsContent.scrollTop = serverLogsContent.scrollHeight;
    };

    updateModelList('cloud-temple');
}

document.addEventListener('DOMContentLoaded', initialize);
