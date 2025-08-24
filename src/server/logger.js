/**
 * @file logger.js
 * @description Logger amélioré pour le serveur, avec diffusion en temps réel (SSE).
 */

const chalk = require('chalk');

let broadcast = () => {}; // Fonction de broadcast vide par défaut

/**
 * Définit la fonction à appeler pour diffuser les logs aux clients.
 * @param {Function} broadcastFunction
 */
function setBroadcastFunction(broadcastFunction) {
    broadcast = broadcastFunction;
}

function getTimestamp() {
    return new Date().toLocaleTimeString('fr-FR');
}

/**
 * Affiche un log de statut pour une opération sur un chunk.
 * @param {'TRANSCRIPTION' | 'ANALYSE'} type - Le type d'opération.
 * @param {object} details - Les détails de l'opération.
 * @param {'SUCCESS' | 'ERROR'} status - Le statut final.
 * @param {number} durationMs - La durée de l'opération en millisecondes.
 */
function logOperation(type, details, status, durationMs) {
    const time = chalk.gray(getTimestamp());
    const typeStr = chalk.blue.bold(type.padEnd(13, ' '));
    let detailsStr = details.chunkIndex !== undefined
        ? `Chunk ${String(details.chunkIndex + 1).padStart(3, ' ')}/${String(details.totalChunks).padEnd(3, ' ')}`
        : '';
    
    if (type === 'ANALYSE' && details.textPreview) {
        const preview = details.textPreview.replace(/\s+/g, ' ').trim();
        const tokenCount = preview.split(' ').length;
        const excerpt = preview.length > 60 ? `${preview.slice(0, 30)}...${preview.slice(-30)}` : preview;
        detailsStr += ` (${tokenCount} tokens) "${excerpt}"`;
    }

    const statusStr = status === 'SUCCESS'
        ? chalk.green('Succès')
        : chalk.red.bold('Échec ');

    const durationStr = chalk.gray(`(${(durationMs / 1000).toFixed(1)}s)`);

    const consoleMessage = `${time} | ${typeStr} | ${detailsStr} | ${statusStr} ${durationStr}`;
    console.log(consoleMessage);

    // Diffuse une version sans couleurs aux clients
    const clientMessage = `${getTimestamp()} | ${type.padEnd(13, ' ')} | ${detailsStr} | ${status} (${(durationMs / 1000).toFixed(1)}s)`;
    broadcast(clientMessage);
}

function info(message) {
    const logMessage = `${chalk.gray(getTimestamp())} | ${chalk.cyan('INFO')}    | ${message}`;
    console.log(logMessage);
    broadcast(`${getTimestamp()} | INFO    | ${message}`);
}

function success(message) {
    const logMessage = `${chalk.gray(getTimestamp())} | ${chalk.green('SUCCESS')} | ${message}`;
    console.log(logMessage);
    broadcast(`${getTimestamp()} | SUCCESS | ${message}`);
}

function error(message, err) {
    const logMessage = `${chalk.gray(getTimestamp())} | ${chalk.red.bold('ERROR')}   | ${message}`;
    console.error(logMessage);
    broadcast(`${getTimestamp()} | ERROR   | ${message}`);
    if (err) {
        const errorDetails = err.response ? err.response.data : { message: err.message };
        console.error(chalk.gray(JSON.stringify(errorDetails, null, 2)));
    }
}

module.exports = {
    setBroadcastFunction,
    logOperation,
    info,
    success,
    error,
};
