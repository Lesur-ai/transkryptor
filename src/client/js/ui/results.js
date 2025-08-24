/**
 * @file results.js
 * @description Module pour gérer l'affichage des résultats dans l'interface.
 */

import { getState } from '../state.js';
import { downloadActiveResult } from '../download.js';

// --- DOM Elements ---
const tabs = document.querySelectorAll('.tab');
const contentContainer = document.getElementById('tab-content-container');
const downloadBtn = document.getElementById('download-btn');

let activeTab = 'transcription'; // Onglet actif par défaut

/**
 * Met à jour le contenu affiché en fonction de l'onglet actif et de l'état global.
 */
function renderActiveTabContent() {
    const state = getState();
    const content = state.results[activeTab];

    if (content) {
        const htmlContent = content.replace(/\n/g, '<br>');
        contentContainer.innerHTML = `<p>${htmlContent}</p>`;
        downloadBtn.disabled = false;
    } else {
        showPlaceholder(`Aucun contenu pour l'onglet "${activeTab}".`);
    }
}

/**
 * Active un onglet spécifique et met à jour le contenu.
 * @param {string} tabName - Le nom de l'onglet à activer ('transcription', 'analysis', 'synthesis').
 */
export function setActiveTab(tabName) {
    activeTab = tabName;
    tabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderActiveTabContent();
}

/**
 * Affiche un message de chargement ou d'attente.
 * @param {string} message - Le message à afficher.
 */
export function showPlaceholder(message) {
    contentContainer.innerHTML = `<div class="placeholder">${message}</div>`;
}

/**
 * Met à jour la vue lorsqu'une nouvelle transcription est disponible.
 */
export function updateTranscriptionView() {
    // Affiche la transcription dans l'onglet 'transcription'
    setActiveTab('transcription');
}

/**
 * Met à jour la vue lorsqu'une nouvelle analyse est disponible.
 */
export function updateAnalysisView() {
    // Passe à l'onglet 'analysis' et l'affiche
    setActiveTab('analysis');
}

/**
 * Gère le clic sur un onglet.
 * @param {Event} event 
 */
function handleTabClick(event) {
    const newTab = event.currentTarget.dataset.tab;
    setActiveTab(newTab);
}

/**
 * Initialise le module des résultats.
 */
export function initResults() {
    tabs.forEach(tab => tab.addEventListener('click', handleTabClick));
    downloadBtn.addEventListener('click', downloadActiveResult);
    showPlaceholder('Sélectionnez un fichier pour commencer.');
    downloadBtn.disabled = true;
}
