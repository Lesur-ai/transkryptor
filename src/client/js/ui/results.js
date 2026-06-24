/**
 * @file results.js
 * @description Module pour gérer l'affichage des résultats.
 * Transkryptor v6 — Design Cloud Temple dark theme.
 *
 * AXE 4 (v6.0) : ajout de l'onglet "Locuteurs" et du rendu inline diarisé
 * pour la transcription. La diarization est faite par LLM sur le texte
 * (pas vraie diarization audio).
 */

import { getState } from '../state.js';
import { downloadActiveResult } from '../download.js';

const contentContainer = document.getElementById('tab-content-container');
const downloadBtn = document.getElementById('download-btn');

let activeTab = 'transcription';
let lastPlaceholderKey = 'results.placeholder.selectFile';
let lastPlaceholderVars = null;
let lastPlaceholderIcon = null;
let lastPlaceholderRaw = null;

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function tr(key, vars) {
    if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, vars);
    }
    const fallback = {
        'diarization.disabled.message': 'Activez la détection des participants pour voir cette vue.',
        'speakers.rename.placeholder': 'Renommer ce locuteur',
        'speakers.timestamp': `[${vars ? vars.start : '?'} - ${vars ? vars.end : '?'}]`,
    };
    return fallback[key] || key;
}

function formatTimestamp(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--:--';
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
}

function resolveSpeakerName(speakerId, speakerNames) {
    if (speakerNames && Object.prototype.hasOwnProperty.call(speakerNames, speakerId)) {
        const named = speakerNames[speakerId];
        if (named && named.trim()) return named;
    }
    return speakerId;
}

function renderPlaceholder(message, iconChar) {
    const icon = iconChar ? `<span class="icon">${iconChar}</span>` : '';
    contentContainer.innerHTML = `<div class="placeholder">${icon}${message}</div>`;
}

function renderTranscriptionView(state) {
    const text = state.results.transcription;
    const turns = state.results.diarization;
    if (!text) {
        showPlaceholderKey('results.placeholder.noContent', { activeTab });
        return;
    }

    if (Array.isArray(turns) && turns.length > 0) {
        const names = state.results.speakerNames || {};
        const html = turns.map(turn => {
            const speaker = escapeHtml(resolveSpeakerName(turn.speaker, names));
            const body = escapeHtml(turn.text || '').replace(/\n/g, '<br>');
            return `<p><strong>${speaker} :</strong> ${body}</p>`;
        }).join('');
        contentContainer.innerHTML = html;
    } else {
        contentContainer.innerHTML = `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
    }
    if (downloadBtn) downloadBtn.disabled = false;
}

function renderMarkdownView(content) {
    if (typeof window !== 'undefined' && typeof window.marked !== 'undefined') {
        contentContainer.innerHTML = window.marked.parse(content);
    } else {
        contentContainer.innerHTML = `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
    }
    if (downloadBtn) downloadBtn.disabled = false;
}

function renderSpeakersView(state) {
    const turns = state.results.diarization;
    if (!Array.isArray(turns) || turns.length === 0) {
        showPlaceholderKey('diarization.disabled.message');
        return;
    }
    const names = state.results.speakerNames || {};
    const placeholder = tr('speakers.rename.placeholder');

    const html = turns.map((turn, idx) => {
        const start = formatTimestamp(turn.startTime);
        const end = formatTimestamp(turn.endTime);
        const speakerId = turn.speaker;
        const displayName = resolveSpeakerName(speakerId, names);
        const safeText = escapeHtml(turn.text || '').replace(/\n/g, '<br>');
        const safeId = escapeHtml(speakerId);
        const safeDisplay = escapeHtml(displayName);
        const timestamp = tr('speakers.timestamp', { start, end });
        return `
            <div class="speaker-card" data-turn-index="${idx}">
                <div class="speaker-card-header">
                    <input type="text"
                           class="speaker-name-input"
                           value="${safeDisplay}"
                           data-speaker-id="${safeId}"
                           placeholder="${escapeHtml(placeholder)}">
                    <span class="speaker-card-time">${escapeHtml(timestamp)}</span>
                </div>
                <div class="speaker-card-body">${safeText}</div>
            </div>
        `;
    }).join('');

    contentContainer.innerHTML = `<div class="speakers-list">${html}</div>`;
    if (downloadBtn) downloadBtn.disabled = false;

    // Wire les inputs de renommage
    contentContainer.querySelectorAll('.speaker-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const oldId = e.target.dataset.speakerId;
            const newName = e.target.value;
            if (typeof window.transkryptorRenameSpeaker === 'function') {
                window.transkryptorRenameSpeaker(oldId, newName);
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
    });
}

function renderActiveTabContent() {
    const state = getState();

    if (activeTab === 'speakers') {
        renderSpeakersView(state);
        return;
    }

    const content = state.results[activeTab];
    if (content) {
        if (activeTab === 'transcription') {
            renderTranscriptionView(state);
        } else {
            renderMarkdownView(content);
        }
    } else {
        showPlaceholderKey('results.placeholder.noContent', { activeTab });
    }
}

export function setActiveTab(tabName) {
    activeTab = tabName;
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderActiveTabContent();
}

export function showPlaceholder(message) {
    lastPlaceholderRaw = message;
    lastPlaceholderKey = null;
    lastPlaceholderVars = null;
    lastPlaceholderIcon = null;
    contentContainer.innerHTML = `<div class="placeholder">${escapeHtml(message)}</div>`;
}

export function showPlaceholderKey(key, vars, iconChar) {
    lastPlaceholderKey = key;
    lastPlaceholderVars = vars || null;
    lastPlaceholderIcon = iconChar || null;
    lastPlaceholderRaw = null;
    const message = window.i18n ? window.i18n.t(key, vars) : key;
    renderPlaceholder(message, iconChar);
}

export function refreshPlaceholder() {
    if (lastPlaceholderKey) {
        renderPlaceholder(window.i18n.t(lastPlaceholderKey, lastPlaceholderVars), lastPlaceholderIcon);
    }
}

export function updateTranscriptionView() {
    setActiveTab('transcription');
}

export function updateAnalysisView() {
    setActiveTab('analysis');
}

export function updateSynthesisView() {
    setActiveTab('synthesis');
}

export function updateSpeakersView() {
    setActiveTab('speakers');
}

function handleTabClick(event) {
    const newTab = event.currentTarget.dataset.tab;
    setActiveTab(newTab);
}

export function initResults() {
    // Re-query au moment de l'init pour inclure l'onglet "speakers" ajouté par AXE 4
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(tab => tab.addEventListener('click', handleTabClick));
    if (downloadBtn) downloadBtn.addEventListener('click', downloadActiveResult);
    showPlaceholderKey('results.placeholder.selectFile');
    if (downloadBtn) downloadBtn.disabled = true;
}
