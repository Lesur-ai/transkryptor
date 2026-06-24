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

// État interne pour le rendu incrémental du streaming de diarization.
// Évite de reconstruire tout le DOM à chaque tick (sinon les cartes refont
// leur animation fade-in à chaque seconde → effet de clignotement).
let streamingState = {
    statusEl: null,        // <strong> contenant le texte "X tours identifié(s) — Ys écoulées"
    cardsContainer: null,  // <div class="speakers-list-streaming"> où sont appendées les cartes
    renderedTurnsCount: 0, // nombre de cartes déjà appendées
};

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
        'diarization.processingWithTimer': `Identification des locuteurs en cours… (${vars ? vars.time : ''})`,
        'diarization.streamingProgress': `${vars ? vars.count : 0} tour(s) identifié(s) — ${vars ? vars.time : ''} écoulées`,
        'diarization.processingHint': 'Cela peut prendre 30 secondes à 2 minutes selon la longueur de la transcription.',
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
    // Cas particulier : streaming en cours. On NE veut PAS afficher le mode
    // final (avec inputs de renommage + bouton download actif) tant que la
    // diarization n'est pas terminée. On reset l'état interne du streaming
    // pour que le prochain tick recrée la structure progressive avec les tours
    // déjà arrivés ; en attendant, on affiche un placeholder minimal.
    if (state.processingState === 'diarizing') {
        streamingState.statusEl = null;
        streamingState.cardsContainer = null;
        streamingState.renderedTurnsCount = 0;
        showPlaceholderKey('diarization.processing');
        if (downloadBtn) downloadBtn.disabled = true;
        return;
    }

    const turns = state.results.diarization;
    if (!Array.isArray(turns) || turns.length === 0) {
        showPlaceholderKey('diarization.disabled.message');
        if (downloadBtn) downloadBtn.disabled = true;
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

function formatElapsed(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const mins = Math.floor(s / 60);
    const remSec = s % 60;
    return mins > 0 ? `${mins}m ${String(remSec).padStart(2, '0')}s` : `${remSec}s`;
}

/**
 * Rend un placeholder animé pour la diarization avec timer + hint sur la durée.
 * Appelé à chaque tick (1s) pour mettre à jour le compteur. Désactive le bouton
 * de téléchargement pendant l'opération.
 */
export function showDiarizationProgress(elapsedSec) {
    const processing = tr('diarization.processingWithTimer', { time: formatElapsed(elapsedSec) });
    const hint = tr('diarization.processingHint');
    contentContainer.innerHTML = `
        <div class="placeholder diarization-progress">
            <span class="diarization-spinner" aria-hidden="true">🔍</span>
            <div class="diarization-progress-text">
                <strong>${escapeHtml(processing)}</strong>
                <p class="diarization-progress-hint">${escapeHtml(hint)}</p>
            </div>
        </div>
    `;
    lastPlaceholderKey = null;
    lastPlaceholderVars = null;
    lastPlaceholderIcon = null;
    lastPlaceholderRaw = null;
    if (downloadBtn) downloadBtn.disabled = true;
}

function buildSpeakerCard(turn, idx, speakerNames) {
    const start = formatTimestamp(turn.startTime);
    const end = formatTimestamp(turn.endTime);
    const speakerId = turn.speaker || `Speaker ${idx + 1}`;
    const displayName = resolveSpeakerName(speakerId, speakerNames || {});
    const timestamp = tr('speakers.timestamp', { start, end });

    const card = document.createElement('div');
    card.className = 'speaker-card speaker-card-streaming';
    card.innerHTML = `
        <div class="speaker-card-header">
            <strong class="speaker-card-name">${escapeHtml(displayName)}</strong>
            <span class="speaker-card-time">${escapeHtml(timestamp)}</span>
        </div>
        <div class="speaker-card-body">${escapeHtml(turn.text || '').replace(/\n/g, '<br>')}</div>
    `;
    return card;
}

/**
 * Variante streaming : affiche le placeholder de progression EN HAUT avec un
 * compteur de tours identifiés en temps réel, et la liste des tours déjà parsés
 * EN DESSOUS au fur et à mesure qu'ils arrivent du serveur SSE.
 *
 * IMPORTANT : rendu INCRÉMENTAL pour éviter le clignotement à chaque tick.
 * On reconstruit la structure DOM uniquement si elle n'existe pas (1er appel
 * ou retour sur l'onglet après navigation), sinon on update juste le compteur
 * et on append les nouvelles cartes. L'animation fade-in joue ainsi une seule
 * fois par carte (à son arrivée), pas à chaque seconde.
 */
export function showDiarizationStreamingProgress(elapsedSec, turnsSoFar, speakerNames) {
    // Guard : ne JAMAIS muter contentContainer si l'utilisateur a basculé vers
    // un autre onglet (Transcription / Analyse / Synthèse) — sinon le tick
    // suivant écraserait le contenu de l'onglet actif. À son retour sur
    // 'speakers', setActiveTab → renderActiveTabContent → renderSpeakersView
    // affichera l'état courant (state.results.diarization, qui est tenu à jour
    // par main.js via accumulatedTurns à chaque event 'turn').
    if (activeTab !== 'speakers') return;

    const timeStr = formatElapsed(elapsedSec);
    const turns = Array.isArray(turnsSoFar) ? turnsSoFar : [];
    const turnsCount = turns.length;
    const statusText = tr('diarization.streamingProgress', { time: timeStr, count: turnsCount });

    // Vérifie si la structure DOM streaming est toujours en place.
    // Si le contentContainer a été remplacé (switch d'onglet, etc.), on recrée.
    const structureAlive = streamingState.statusEl
        && streamingState.cardsContainer
        && contentContainer.contains(streamingState.statusEl)
        && contentContainer.contains(streamingState.cardsContainer);

    if (!structureAlive) {
        const hint = tr('diarization.processingHint');
        contentContainer.innerHTML = `
            <div class="placeholder diarization-progress diarization-streaming">
                <span class="diarization-spinner" aria-hidden="true">🔍</span>
                <div class="diarization-progress-text">
                    <strong class="diarization-progress-status">${escapeHtml(statusText)}</strong>
                    <p class="diarization-progress-hint">${escapeHtml(hint)}</p>
                </div>
            </div>
            <div class="speakers-list speakers-list-streaming"></div>
        `;
        streamingState.statusEl = contentContainer.querySelector('.diarization-progress-status');
        streamingState.cardsContainer = contentContainer.querySelector('.speakers-list-streaming');
        streamingState.renderedTurnsCount = 0;

        lastPlaceholderKey = null;
        lastPlaceholderVars = null;
        lastPlaceholderIcon = null;
        lastPlaceholderRaw = null;
        if (downloadBtn) downloadBtn.disabled = true;

        // Append toutes les cartes déjà connues (cas du retour sur l'onglet)
        const names = speakerNames || {};
        turns.forEach((turn, idx) => {
            streamingState.cardsContainer.appendChild(buildSpeakerCard(turn, idx, names));
        });
        streamingState.renderedTurnsCount = turnsCount;
        return;
    }

    // Structure intacte : update minimal en place
    streamingState.statusEl.textContent = statusText;

    // Append uniquement les nouvelles cartes (au-delà de ce qui est déjà rendu)
    if (turnsCount > streamingState.renderedTurnsCount) {
        const names = speakerNames || {};
        for (let idx = streamingState.renderedTurnsCount; idx < turnsCount; idx++) {
            streamingState.cardsContainer.appendChild(buildSpeakerCard(turns[idx], idx, names));
        }
        streamingState.renderedTurnsCount = turnsCount;
    }
}

/**
 * Réinitialise l'état du rendu streaming. À appeler quand on bascule
 * définitivement sur la vue speakers finale (fin du stream) ou en cas
 * de nouvelle session de diarization.
 */
export function resetDiarizationStreamingState() {
    streamingState.statusEl = null;
    streamingState.cardsContainer = null;
    streamingState.renderedTurnsCount = 0;
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
