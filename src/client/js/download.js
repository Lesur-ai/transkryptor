/**
 * @file download.js
 * @description Gère le téléchargement des résultats.
 */

import { getState } from './state.js';

/**
 * Fonction générique pour télécharger du contenu texte dans un fichier.
 * @param {string} content - Le contenu du fichier.
 * @param {string} filename - Le nom du fichier à télécharger.
 * @param {string} [type='text/plain'] - Le type MIME du fichier.
 */
function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Requis pour Firefox
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

function formatSpeakerTimestamp(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--:--';
    const s = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

function serializeDiarization(turns, speakerNames) {
    if (!Array.isArray(turns) || turns.length === 0) return '';
    const names = speakerNames || {};
    return turns.map(turn => {
        const id = turn.speaker || 'Speaker';
        const named = names[id];
        const label = (named && named.trim()) ? `${id} (${named.trim()})` : id;
        const ts = `[${formatSpeakerTimestamp(turn.startTime)} - ${formatSpeakerTimestamp(turn.endTime)}]`;
        const text = (turn.text || '').trim();
        return `${label} ${ts}\n  ${text}`;
    }).join('\n\n');
}

/**
 * Déclenche le téléchargement du contenu de l'onglet actuellement actif.
 */
export function downloadActiveResult() {
    const state = getState();
    const activeTab = document.querySelector('.tab.active').dataset.tab;

    // L'onglet Locuteurs n'a pas de results.speakers — il faut sérialiser la diarization.
    const content = activeTab === 'speakers'
        ? serializeDiarization(state.results.diarization, state.results.speakerNames)
        : state.results[activeTab];

    if (!content) {
        alert(window.i18n.t('errors.download.noContent', { activeTab }));
        return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const prefix = window.i18n.t('ui.download.filenamePrefix');
    let filename;
    if (activeTab === 'transcription') {
        filename = `${prefix}_${date}.txt`;
    } else if (activeTab === 'speakers') {
        filename = `speakers_${date}.txt`;
    } else {
        filename = `${activeTab}_${date}.txt`;
    }

    downloadFile(content, filename);
}
