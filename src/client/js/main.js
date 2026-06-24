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
import { SYNTHESIS_PROMPTS, DEFAULT_PRESET, PRESET_IDS, getPresetPrompt } from './prompts.js';

// --- localStorage keys ---
const LS_PRESET = 'transkryptor.synthesis.preset';
const LS_CUSTOM_PROMPT = 'transkryptor.synthesis.customPrompt';

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
const langSelector = document.getElementById('ui-language-selector');

let timerInterval = null;
let chunkDurations = [];

// --- Functions ---

function findPreferredModel(models) {
    return models.length > 0 ? models[0].id : null;
}

function setButtonContent(button, iconChar, labelKey) {
    button.innerHTML = `<span class="icon">${iconChar}</span><span data-i18n="${labelKey}">${window.i18n.t(labelKey)}</span>`;
}

async function updateModelList() {
    try {
        modelSelect.innerHTML = `<option data-i18n="config.model.loading">${window.i18n.t('config.model.loading')}</option>`;
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
            modelSelect.innerHTML = `<option data-i18n="ui.models.empty">${window.i18n.t('ui.models.empty')}</option>`;
        }
    } catch (error) {
        modelSelect.innerHTML = `<option data-i18n="ui.models.error">${window.i18n.t('ui.models.error')}</option>`;
    }
}

function handleFileSelect() {
    const file = fileInput.files[0];
    if (file) {
        updateState({ selectedFile: file });
        fileNameSpan.textContent = file.name;
        fileNameSpan.removeAttribute('data-i18n');
        fileDropZone.classList.add('has-file');
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        statsUI.updateStats({ size: `0.00 / ${fileSize} MB` });
    }
}

async function handleProcess() {
    const state = getState();
    if (!state.selectedFile) {
        alert(window.i18n.t('validation.audio.required'));
        return;
    }

    processBtn.disabled = true;
    synthesizeBtn.disabled = true;
    setButtonContent(processBtn, '⏳', 'ui.process.inProgress');

    chunkDurations = [];
    const startTime = Date.now();
    timerInterval = setInterval(() => {
        statTime.textContent = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    }, 100);

    try {
        statsUI.showStats();
        progressUI.clearProgress();
        chartUI.resetChart();
        resultsUI.showPlaceholderKey('status.transcription.preparing', null, '🎙️');

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
        resultsUI.showPlaceholderKey('status.analysis.inProgress', null, '🔍');
        progressUI.clearProgress();
        chartUI.resetChart();
        chartUI.updateChartLabel(window.i18n.t('chart.performance.speedLabelTokens'));
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
            errorMessage = window.i18n.t('errors.audio.decodeFailure');
        }
        resultsUI.showPlaceholderKey('errors.processing.generic', { errorMessage }, '❌');
        statsUI.hideStats();
        alert(window.i18n.t('errors.alert', { errorMessage }));
    } finally {
        processBtn.disabled = false;
        setButtonContent(processBtn, '🚀', 'button.process.label');
        clearInterval(timerInterval);
    }
}

async function handleSynthesize() {
    const state = getState();
    if (!state.results.analysis) {
        alert(window.i18n.t('validation.analysis.required'));
        return;
    }

    synthesizeBtn.disabled = true;
    setButtonContent(synthesizeBtn, '⏳', 'ui.synthesis.inProgress');

    try {
        updateState({ processingState: 'synthesizing' });
        resultsUI.setActiveTab('synthesis');
        resultsUI.showPlaceholderKey('status.synthesis.generating', null, '📝');

        const effectivePrompt = getEffectiveSynthesisPrompt();
        const synthesisResult = await api.synthesize(state.results.analysis, state.selectedModel, effectivePrompt);

        updateState({
            results: { ...state.results, synthesis: synthesisResult.synthesis },
            processingState: 'done'
        });

        resultsUI.updateSynthesisView();

    } catch (error) {
        updateState({ processingState: 'error' });
        resultsUI.showPlaceholderKey('errors.synthesis.failed', { errorMessage: error.message }, '❌');
        alert(window.i18n.t('errors.synthesis.alert', { errorMessage: error.message }));
    } finally {
        synthesizeBtn.disabled = false;
        setButtonContent(synthesizeBtn, '📝', 'button.synthesize.label');
    }
}

async function initialize() {
    // Attendre que le module i18n soit prêt avant d'initialiser le reste de l'UI
    await window.i18n.ready;

    // Synchroniser le sélecteur de langue avec la langue active
    if (langSelector) {
        langSelector.value = window.i18n.getLanguage();
        langSelector.addEventListener('change', (e) => {
            window.i18n.setLanguage(e.target.value);
        });
    }

    // Re-render des composants dynamiques en cas de changement de langue
    window.addEventListener('i18nchange', () => {
        statsUI.refreshFileInfo();
        chartUI.refreshLabels();
        resultsUI.refreshPlaceholder();
    });

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

    // Init prompts avancés (presets + custom)
    initAdvancedPrompts();

    // Charger les modèles
    updateModelList();
}

// ─────────────────────────────────────────────────────────────────────────────
// AXE 3 — Prompts de synthèse configurables
// ─────────────────────────────────────────────────────────────────────────────

function readPersistedPresetState() {
    let preset = DEFAULT_PRESET;
    let customPrompt = '';
    try {
        const storedPreset = localStorage.getItem(LS_PRESET);
        if (storedPreset && PRESET_IDS.includes(storedPreset)) {
            preset = storedPreset;
        }
        const storedCustom = localStorage.getItem(LS_CUSTOM_PROMPT);
        if (typeof storedCustom === 'string') {
            customPrompt = storedCustom;
        }
    } catch (e) {
        // localStorage indisponible (mode privé, etc.) : fallback aux valeurs par défaut.
    }
    return { preset, customPrompt };
}

function persistPresetState(preset, customPrompt) {
    try {
        localStorage.setItem(LS_PRESET, preset);
        localStorage.setItem(LS_CUSTOM_PROMPT, customPrompt || '');
    } catch (e) {
        // Silencieux : la persistance échoue, l'app reste fonctionnelle.
    }
}

function applyPresetToTextarea(textarea, preset, customPrompt) {
    if (preset === 'custom') {
        textarea.readOnly = false;
        textarea.value = customPrompt || '';
    } else {
        textarea.readOnly = true;
        textarea.value = getPresetPrompt(preset).trim();
    }
}

function getEffectiveSynthesisPrompt() {
    const { synthesisPreset, customSynthesisPrompt } = getState();
    if (synthesisPreset === 'custom') {
        const trimmed = (customSynthesisPrompt || '').trim();
        if (trimmed.length > 0) return customSynthesisPrompt;
        return SYNTHESIS_PROMPTS[DEFAULT_PRESET];
    }
    return getPresetPrompt(synthesisPreset);
}

function initAdvancedPrompts() {
    const presetSelector = document.getElementById('prompt-preset-selector');
    const promptTextarea = document.getElementById('custom-prompt-input');
    const resetBtn = document.getElementById('reset-prompt-btn');

    if (!presetSelector || !promptTextarea || !resetBtn) return;

    const { preset, customPrompt } = readPersistedPresetState();
    updateState({ synthesisPreset: preset, customSynthesisPrompt: customPrompt });
    presetSelector.value = preset;
    applyPresetToTextarea(promptTextarea, preset, customPrompt);

    presetSelector.addEventListener('change', (e) => {
        const newPreset = e.target.value;
        const state = getState();
        updateState({ synthesisPreset: newPreset });
        applyPresetToTextarea(promptTextarea, newPreset, state.customSynthesisPrompt);
        persistPresetState(newPreset, state.customSynthesisPrompt);
    });

    promptTextarea.addEventListener('input', () => {
        if (getState().synthesisPreset !== 'custom') return;
        const newCustom = promptTextarea.value;
        updateState({ customSynthesisPrompt: newCustom });
        persistPresetState('custom', newCustom);
    });

    resetBtn.addEventListener('click', () => {
        const confirmMsg = (window.i18n && typeof window.i18n.t === 'function')
            ? window.i18n.t('prompts.reset.confirm')
            : 'Réinitialiser le prompt de synthèse ?';
        if (!window.confirm(confirmMsg)) return;
        updateState({ synthesisPreset: DEFAULT_PRESET, customSynthesisPrompt: '' });
        presetSelector.value = DEFAULT_PRESET;
        applyPresetToTextarea(promptTextarea, DEFAULT_PRESET, '');
        persistPresetState(DEFAULT_PRESET, '');
    });
}

document.addEventListener('DOMContentLoaded', initialize);
