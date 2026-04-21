/**
 * @file logger.js
 * @description Logger basé sur Winston pour le serveur, avec diffusion en temps réel (SSE) et Syslog.
 */

const winston = require('winston');
const { Syslog } = require('winston-syslog');
const chalk = require('chalk');

// --- Configuration Winston ---

// Niveaux standards compatibles avec Syslog
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        silly: 6
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        verbose: 'cyan',
        debug: 'blue',
        silly: 'white'
    }
};

winston.addColors(customLevels.colors);

// Formatter personnalisé pour la console
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(info => {
        const { timestamp, level, message, clientId, isConnectionLog, ...meta } = info;
        
        // Format spécial pour les logs de connexion
        if (isConnectionLog) {
            const idStr = chalk.cyan(clientId);
            return `${chalk.gray(timestamp)} | ${idStr} | ${message}`;
        }

        // Format standard pour les autres logs
        const idStr = clientId === 'server' 
            ? chalk.yellow(clientId.padEnd(6, ' ')) 
            : chalk.magenta((clientId || '------').substring(0, 6));
        
        const levelStr = winston.format.colorize().colorize(level, `${level.toUpperCase()}`);
        
        return `${chalk.gray(timestamp)} | ${levelStr.padEnd(18, ' ')} | ${idStr} | ${message}`;
    })
);

const logger = winston.createLogger({
    levels: customLevels.levels,
    transports: [
        new winston.transports.Console({
            level: 'info',
            format: consoleFormat
        }),
        new Syslog({
            level: 'info',
            host: 'localhost',
            port: 514,
            protocol: 'udp',
            app_name: 'Transkryptor',
            format: winston.format.combine(
                winston.format.splat(),
                winston.format.json()
            )
        })
    ]
});

// --- Logique de diffusion SSE ---

let broadcast = () => {};

function setBroadcastFunction(broadcastFunction) {
    broadcast = broadcastFunction;
}

// --- Fonctions de log exportées ---

function getTimestamp() {
    return new Date().toLocaleTimeString('fr-FR');
}

function logOperation(clientId, type, details, status, durationMs) {
    const level = status === 'SUCCESS' ? 'info' : 'error';
    const statusStr = status === 'SUCCESS' ? 'Succès' : 'Échec';
    let detailsStr = details.chunkIndex !== undefined
        ? `Chunk ${String(details.chunkIndex + 1).padStart(3, ' ')}/${String(details.totalChunks).padEnd(3, ' ')}`
        : '';
    
    if (type === 'ANALYSE' && details.textPreview) {
        const preview = details.textPreview.replace(/\s+/g, ' ').trim();
        const tokenCount = preview.split(' ').length;
        const excerpt = preview.length > 60 ? `${preview.slice(0, 30)}...${preview.slice(-30)}` : preview;
        detailsStr += ` (${tokenCount} tokens) "${excerpt}"`;
    }

    const message = `${type.padEnd(13, ' ')} | ${detailsStr} | ${statusStr} (${(durationMs / 1000).toFixed(1)}s)`;
    logger.log(level, message, { clientId });

    const clientMessage = `${getTimestamp()} | ${type.padEnd(13, ' ')} | ${detailsStr} | ${status} (${(durationMs / 1000).toFixed(1)}s)`;
    broadcast(clientId, clientMessage);
}

function logConnection(clientId, details) {
    const ipStr = details.ip;
    const fileInfoStr = details.fileInfo
        ? `${details.fileInfo.name} (${details.fileInfo.sizeMb}MB, ${details.fileInfo.type})`
        : 'N/A';
    const message = `CONNEXION | IP: ${ipStr} | Fichier: ${fileInfoStr}`;
    // On log au niveau 'info' pour la compatibilité, mais avec un flag pour le formatage
    logger.info(message, { clientId, isConnectionLog: true });
}

function info(clientId, message) {
    logger.info(message, { clientId });
    broadcast(clientId, `${getTimestamp()} | INFO    | ${message}`);
}

function success(clientId, message) {
    logger.info(message, { clientId });
    broadcast(clientId, `${getTimestamp()} | SUCCESS | ${message}`);
}

function error(clientId, message, err) {
    const errorMessage = err ? `${message} - ${err.message}` : message;
    logger.error(errorMessage, { clientId, errorDetails: err });
    broadcast(clientId, `${getTimestamp()} | ERROR   | ${message}`);
}

module.exports = {
    setBroadcastFunction,
    logOperation,
    logConnection,
    info,
    success,
    error,
};
