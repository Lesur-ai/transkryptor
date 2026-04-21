/**
 * @file results.js
 * @description Module pour gérer l'affichage des résultats.
 * Transkryptor v5 — Design Cloud Temple dark theme.
 */

import { getState } from '../state.js';
import { downloadActiveResult } from '../download.js';

const tabs = document.querySelectorAll('.tab');
const contentContainer = document.getElementById('tab-content-container');
const downloadBtn = document.getElementById('download-btn');

let activeTab = 'transcription';

function renderActiveTabContent() {
    const state = getState();
    const content = state.results[activeTab];

    if (content) {
        if (activeTab === 'transcription') {
            contentContainer.innerHTML = `<p>${content.replace(/\n/g, '<br>')}</p>`;
        } else {
            contentContainer.innerHTML = marked.parse(content);
        }
        if (downloadBtn) downloadBtn.disabled = false;
    } else {
        showPlaceholder(`Aucun contenu pour l'onglet "${activeTab}".`);
    }
}

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

export function showPlaceholder(message) {
    contentContainer.innerHTML = `<div class="placeholder">${message}</div>`;
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

function handleTabClick(event) {
    const newTab = event.currentTarget.dataset.tab;
    setActiveTab(newTab);
}

export function initResults() {
    tabs.forEach(tab => tab.addEventListener('click', handleTabClick));
    if (downloadBtn) downloadBtn.addEventListener('click', downloadActiveResult);
    showPlaceholder('Sélectionnez un fichier audio pour commencer.');
    if (downloadBtn) downloadBtn.disabled = true;
}
