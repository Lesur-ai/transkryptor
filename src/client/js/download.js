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

/**
 * Déclenche le téléchargement du contenu de l'onglet actuellement actif.
 */
export function downloadActiveResult() {
    const state = getState();
    const activeTab = document.querySelector('.tab.active').dataset.tab;
    const content = state.results[activeTab];

    if (!content) {
        alert(window.i18n.t('errors.download.noContent', { activeTab }));
        return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const prefix = window.i18n.t('ui.download.filenamePrefix');
    const filename = activeTab === 'transcription'
        ? `${prefix}_${date}.txt`
        : `${activeTab}_${date}.txt`;

    downloadFile(content, filename);
}
