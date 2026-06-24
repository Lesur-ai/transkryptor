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
const STORAGE_KEY_AUDIO_LANGUAGE = 'transkryptor.transcription.language';
const STORAGE_KEY_SYNTHESIS_LANGUAGE = 'transkryptor.synthesis.language';

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
const audioLanguageSelector = document.getElementById('audio-language-selector');
const synthesisLanguageSelector = document.getElementById('synthesis-language-selector');
const detectedLanguageBadge = document.getElementById('detected-language-badge');

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
    updateState({ detectedAudioLanguage: null });
    if (detectedLanguageBadge) {
        detectedLanguageBadge.hidden = true;
        detectedLanguageBadge.textContent = '';
    }
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

                    if (progress.detectedLanguage && !getState().detectedAudioLanguage) {
                        updateState({ detectedAudioLanguage: progress.detectedLanguage });
                        renderDetectedLanguageBadge();
                    }

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

        const transcriptionResult = await processAndTranscribeInChunks(state.selectedFile, onTranscriptionProgress, {
            language: state.audioLanguage || ''
        });
        // AXE 4 — Conserve les segments Whisper bruts dans le state pour la diarization
        if (transcriptionResult && Array.isArray(transcriptionResult.segments)) {
            updateState({
                results: {
                    ...getState().results,
                    transcription: transcriptionResult.text || getState().results.transcription,
                    whisperSegments: transcriptionResult.segments,
                },
            });
        }

        // AXE 4 — Diarization optionnelle (v6.0)
        await runDiarizationIfEnabled();

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
        const targetLanguage = resolveSynthesisTargetLanguage(state);
        const synthesisResult = await api.synthesize(state.results.analysis, state.selectedModel, effectivePrompt, targetLanguage);

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

    // Init multilingue (langues audio + synthèse)
    initLanguageSelectors();

    // Init diarization (AXE 4 — v6.0)
    initDiarizationControls();

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
    // Preset par défaut : on laisse le serveur appliquer SYNTHESIS_PROMPT_FR/EN selon targetLanguage.
    // Sans ça, on enverrait toujours le prompt FR du module client → court-circuite AXE 2.
    if (synthesisPreset === DEFAULT_PRESET) return null;
    if (synthesisPreset === 'custom') {
        const trimmed = (customSynthesisPrompt || '').trim();
        return trimmed.length > 0 ? customSynthesisPrompt : null;
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

// ─────────────────────────────────────────────────────────────────────────────
// AXE 2 — Multilingue transcription/synthèse
// ─────────────────────────────────────────────────────────────────────────────

function readStoredLanguage(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (_) {
        return fallback;
    }
}

function writeStoredLanguage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (_) { /* ignore quota / private mode */ }
}

function initLanguageSelectors() {
    if (!audioLanguageSelector || !synthesisLanguageSelector) return;

    const storedAudio = readStoredLanguage(STORAGE_KEY_AUDIO_LANGUAGE, '');
    const storedSynthesis = readStoredLanguage(STORAGE_KEY_SYNTHESIS_LANGUAGE, 'auto');

    if ([...audioLanguageSelector.options].some(o => o.value === storedAudio)) {
        audioLanguageSelector.value = storedAudio;
    }
    if ([...synthesisLanguageSelector.options].some(o => o.value === storedSynthesis)) {
        synthesisLanguageSelector.value = storedSynthesis;
    }

    updateState({
        audioLanguage: audioLanguageSelector.value,
        synthesisLanguage: synthesisLanguageSelector.value,
    });

    audioLanguageSelector.addEventListener('change', (e) => {
        const value = e.target.value;
        updateState({ audioLanguage: value });
        writeStoredLanguage(STORAGE_KEY_AUDIO_LANGUAGE, value);
    });

    synthesisLanguageSelector.addEventListener('change', (e) => {
        const value = e.target.value;
        updateState({ synthesisLanguage: value });
        writeStoredLanguage(STORAGE_KEY_SYNTHESIS_LANGUAGE, value);
    });

    // Re-render badge si l'utilisateur change la langue d'interface
    window.addEventListener('i18nchange', renderDetectedLanguageBadge);
}

function getLocalizedLanguageName(code) {
    if (!code) return '';
    const lower = code.toLowerCase();
    const key = `language.${lower}.name`;
    const translated = window.i18n ? window.i18n.t(key) : null;
    if (translated && translated !== key) return translated;
    return lower.toUpperCase();
}

function renderDetectedLanguageBadge() {
    if (!detectedLanguageBadge) return;
    const { detectedAudioLanguage, audioLanguage } = getState();
    if (!detectedAudioLanguage) {
        detectedLanguageBadge.hidden = true;
        detectedLanguageBadge.textContent = '';
        return;
    }
    // N'afficher le badge que si la langue détectée diffère du hint utilisateur
    // (ou si l'utilisateur n'a pas spécifié de hint = auto-détection).
    const hint = (audioLanguage || '').toLowerCase();
    const detected = detectedAudioLanguage.toLowerCase();
    if (hint && hint === detected) {
        detectedLanguageBadge.hidden = true;
        detectedLanguageBadge.textContent = '';
        return;
    }
    const langName = getLocalizedLanguageName(detected);
    detectedLanguageBadge.textContent = window.i18n.t('transcriptionLang.detectedBadge', { lang: langName });
    detectedLanguageBadge.hidden = false;
}

function resolveSynthesisTargetLanguage(state) {
    const synthesis = state.synthesisLanguage || 'auto';
    if (synthesis !== 'auto') return synthesis;
    // auto = identique à la langue source. Priorité : hint utilisateur > langue détectée Whisper.
    if (state.audioLanguage) return state.audioLanguage;
    if (state.detectedAudioLanguage) return state.detectedAudioLanguage;
    return undefined; // serveur retombe sur le prompt FR par défaut
}

document.addEventListener('DOMContentLoaded', initialize);

// ─────────────────────────────────────────────────────────────────────────────
// AXE 4 — Diarization LLM-based (v6.0)
// ─────────────────────────────────────────────────────────────────────────────

const DIARIZATION_TOGGLE_STORAGE_KEY = 'transkryptor.diarization.enabled';
const DIARIZATION_SPEAKER_NAMES_PREFIX = 'transkryptor.speakers.';

function tDiar(key, vars) {
    if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, vars);
    }
    const fallback = {
        'diarization.processing': 'Identification des locuteurs en cours...',
        'diarization.error': `Échec de la détection des locuteurs : ${vars ? vars.errorMessage : ''}`,
        'diarization.noSegments': "Aucun segment temporel n'a été retourné par la transcription. La détection des locuteurs nécessite des timestamps Whisper.",
    };
    return fallback[key] || key;
}

function computeFileHash(file) {
    if (!file) return null;
    const name = file.name || 'unknown';
    const size = typeof file.size === 'number' ? file.size : 0;
    const lastModified = typeof file.lastModified === 'number' ? file.lastModified : 0;
    return `${name}::${size}::${lastModified}`;
}

function loadSpeakerNames(fileHash) {
    if (!fileHash) return {};
    try {
        const raw = localStorage.getItem(`${DIARIZATION_SPEAKER_NAMES_PREFIX}${fileHash}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        return {};
    }
}

function saveSpeakerNames(fileHash, names) {
    if (!fileHash) return;
    try {
        localStorage.setItem(`${DIARIZATION_SPEAKER_NAMES_PREFIX}${fileHash}`, JSON.stringify(names || {}));
    } catch (_) {
        // Quota / private mode : silencieux
    }
}

async function runDiarizationIfEnabled() {
    const state = getState();
    if (!state.diarizationEnabled) return;

    const text = state.results.transcription;
    const segments = state.results.whisperSegments || [];
    if (!text) return;

    // Sans segments Whisper, la diarization n'aura aucun timestamp à mapper.
    // On affiche un message clair plutôt que d'envoyer un appel inutile au LLM.
    if (!Array.isArray(segments) || segments.length === 0) {
        resultsUI.setActiveTab('speakers');
        resultsUI.showPlaceholder(tDiar('diarization.error', {
            errorMessage: tDiar('diarization.noSegments')
        }));
        return;
    }

    const fileHash = computeFileHash(state.selectedFile);
    const speakerNames = loadSpeakerNames(fileHash);
    updateState({
        currentFileHash: fileHash,
        results: { ...getState().results, speakerNames },
        processingState: 'diarizing',
    });

    resultsUI.setActiveTab('speakers');

    // Diarization STREAMING : les tours sont poussés via SSE au fur et à mesure
    // que le LLM les génère. L'UI affiche un compteur en live + les cartes
    // déjà identifiées sous le placeholder de progression.
    if (typeof resultsUI.resetDiarizationStreamingState === 'function') {
        resultsUI.resetDiarizationStreamingState();
    }
    const diarizationStart = Date.now();
    const accumulatedTurns = [];

    const renderProgress = () => {
        const elapsed = Math.floor((Date.now() - diarizationStart) / 1000);
        const currentNames = getState().results.speakerNames || {};
        if (typeof resultsUI.showDiarizationStreamingProgress === 'function') {
            resultsUI.showDiarizationStreamingProgress(elapsed, accumulatedTurns, currentNames);
        } else if (typeof resultsUI.showDiarizationProgress === 'function') {
            resultsUI.showDiarizationProgress(elapsed);
        } else {
            resultsUI.showPlaceholder(tDiar('diarization.processing'));
        }
    };
    renderProgress();
    const diarizationTimer = setInterval(renderProgress, 1000);

    try {
        await api.diarizeStream(text, segments, state.selectedModel, state.diarizationSpeakerCount, {
            onStart: (_data) => { renderProgress(); },
            onTurn: (turn) => {
                accumulatedTurns.push(turn);
                updateState({
                    results: { ...getState().results, diarization: [...accumulatedTurns] },
                });
                renderProgress();
            },
            onComplete: (data) => {
                const finalTurns = (data && Array.isArray(data.diarization))
                    ? data.diarization
                    : accumulatedTurns;
                updateState({
                    results: { ...getState().results, diarization: finalTurns },
                });
                clearInterval(diarizationTimer);
                // Bascule sur la vue finale (cartes éditables + bouton download actif).
                // Le reset du state streaming évite de réutiliser des refs DOM obsolètes
                // au prochain run.
                if (typeof resultsUI.resetDiarizationStreamingState === 'function') {
                    resultsUI.resetDiarizationStreamingState();
                }
                if (typeof resultsUI.updateSpeakersView === 'function') {
                    resultsUI.updateSpeakersView();
                }
            },
            onError: (_data) => {
                // L'erreur sera relancée comme exception par diarizeStream
                // et traitée dans le catch ci-dessous.
            },
        });
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        resultsUI.showPlaceholder(tDiar('diarization.error', { errorMessage: message }));
        updateState({ results: { ...getState().results, diarization: null } });
    } finally {
        clearInterval(diarizationTimer);
    }
}

function initDiarizationControls() {
    const toggle = document.getElementById('diarization-toggle');
    const speakerCount = document.getElementById('diarization-speaker-count');
    if (!toggle || !speakerCount) return;

    // Restore from localStorage
    try {
        const stored = localStorage.getItem(DIARIZATION_TOGGLE_STORAGE_KEY);
        if (stored === 'true') {
            toggle.checked = true;
            speakerCount.disabled = false;
            updateState({ diarizationEnabled: true });
        }
    } catch (_) { /* noop */ }

    toggle.addEventListener('change', (e) => {
        const enabled = !!e.target.checked;
        speakerCount.disabled = !enabled;
        updateState({ diarizationEnabled: enabled });
        try { localStorage.setItem(DIARIZATION_TOGGLE_STORAGE_KEY, enabled ? 'true' : 'false'); } catch (_) { /* noop */ }
    });

    speakerCount.addEventListener('change', (e) => {
        const raw = parseInt(e.target.value, 10);
        const value = (Number.isFinite(raw) && raw > 0) ? raw : null;
        updateState({ diarizationSpeakerCount: value });
    });
}

// Expose un helper pour le renommage des speakers depuis l'UI
window.transkryptorRenameSpeaker = function renameSpeaker(oldName, newName) {
    const state = getState();
    const fileHash = state.currentFileHash || computeFileHash(state.selectedFile);
    if (!fileHash) return;
    const current = { ...(state.results.speakerNames || {}) };
    const trimmed = (newName || '').trim();
    if (trimmed) {
        current[oldName] = trimmed;
    } else {
        delete current[oldName];
    }
    updateState({ results: { ...state.results, speakerNames: current } });
    saveSpeakerNames(fileHash, current);
    if (typeof resultsUI.updateSpeakersView === 'function') {
        resultsUI.updateSpeakersView();
    }
};
