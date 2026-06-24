require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FormData = require('form-data');
const Logger = require('./logger');

const app = express();

// --- Lecture de la version depuis le fichier VERSION ---
let APP_VERSION = '5.4.0';
try {
    APP_VERSION = fs.readFileSync(path.join(__dirname, '../../VERSION'), 'utf-8').trim();
} catch (e) {
    console.warn('Fichier VERSION non trouvé, utilisation de la version par défaut.');
}

// --- Whitelist exacte des modèles autorisés depuis .env (ordre = priorité d'affichage) ---
function parseAllowedModels(value) {
    const seen = new Set();

    return (value || '')
        .split(',')
        .map(model => model.trim())
        .filter(Boolean)
        .filter(model => {
            const key = normalizeModelId(model);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function normalizeModelId(modelId) {
    return String(modelId || '').trim().toLowerCase();
}

const ALLOWED_MODELS = parseAllowedModels(process.env.CLOUD_TEMPLE_ALLOWED_MODELS);
const ALLOWED_MODEL_INDEX = new Map(ALLOWED_MODELS.map((model, index) => [normalizeModelId(model), index]));

if (ALLOWED_MODELS.length === 0) {
    console.warn('CLOUD_TEMPLE_ALLOWED_MODELS non défini : aucun modèle ne sera proposé.');
}

function hasConfiguredModelAllowlist() {
    return ALLOWED_MODELS.length > 0;
}

function isAllowedModel(modelId) {
    return ALLOWED_MODEL_INDEX.has(normalizeModelId(modelId));
}

function hasModelIdentifier(model, modelId) {
    const expected = normalizeModelId(modelId);
    const identifiers = [model.id, ...(model.aliases || [])].map(normalizeModelId);
    return identifiers.includes(expected);
}

function findPublishedModel(allowedModelId, allModels) {
    return allModels.find(model => hasModelIdentifier(model, allowedModelId));
}

// --- Logique pour le streaming des logs (Server-Sent Events) ---
const clients = new Map();

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    next();
});

// Endpoint pour les logs temps réel (SSE)
app.get('/api/logs', (req, res) => {
    const { clientId } = req.query;
    if (!clientId) {
        return res.status(400).send('clientId manquant.');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    clients.set(clientId, res);
    Logger.info(clientId, `Client connecté pour les logs.`);

    req.on('close', () => {
        clients.delete(clientId);
        Logger.info('server', `Client ${clientId} déconnecté.`);
    });
});

function sendLogToClient(clientId, logMessage) {
    const client = clients.get(clientId);
    if (client) {
        client.write(`data: ${JSON.stringify(logMessage)}\n\n`);
    }
}

Logger.setBroadcastFunction(sendLogToClient);

// Configuration de Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../client')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// --- API Endpoints ---

// Version de l'application
app.get('/api/version', (req, res) => {
    res.json({ version: APP_VERSION });
});

// Modèles disponibles (Cloud Temple uniquement)
app.get('/api/models', async (req, res) => {
    const { clientId } = req.query;

    if (!clientId) {
        return res.status(400).json({ error: 'Le paramètre "clientId" est requis' });
    }

    if (!hasConfiguredModelAllowlist()) {
        return res.status(500).json({ error: 'CLOUD_TEMPLE_ALLOWED_MODELS doit être défini dans .env' });
    }

    try {
        Logger.info(clientId, 'Récupération des modèles depuis Cloud Temple SecNumCloud...');
        const response = await axios.get('https://api.ai.cloud-temple.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}`
            }
        });

        const allModels = response.data.data.map(model => ({
            id: model.id,
            name: model.id,
            aliases: model.aliases
        }));

        // Whitelist stricte : respecter l'ordre .env et accepter les alias publiés par l'API
        const allowedModels = ALLOWED_MODELS
            .map(allowedModelId => {
                const publishedModel = findPublishedModel(allowedModelId, allModels);
                if (!publishedModel) return null;

                return {
                    id: allowedModelId,
                    name: allowedModelId,
                    aliases: publishedModel.aliases,
                    sourceId: publishedModel.id,
                };
            })
            .filter(Boolean);

        Logger.success(clientId, `${allowedModels.length} modèles autorisés (${allModels.length} total sur Cloud Temple)`);
        res.json(allowedModels);
    } catch (error) {
        Logger.error(clientId, `Erreur lors de la récupération des modèles`, error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Transcription audio (Cloud Temple Whisper uniquement)
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    const { clientId, originalFileName, originalFileType, originalFileSize, language } = req.body;
    const chunkIndex = req.body.chunkIndex ? parseInt(req.body.chunkIndex, 10) : undefined;
    const totalChunks = req.body.totalChunks ? parseInt(req.body.totalChunks, 10) : undefined;
    const file = req.file;
    const startTime = Date.now();

    if (file && chunkIndex === 0) {
        Logger.logConnection(clientId, {
            ip: req.ip,
            fileInfo: {
                name: originalFileName || file.originalname,
                sizeMb: (originalFileSize / (1024 * 1024)).toFixed(2),
                type: originalFileType || file.mimetype,
            },
        });
    }

    if (!file || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "file" et "clientId" sont requis' });
    }

    try {
        const fileStream = fs.createReadStream(file.path);
        const formData = new FormData();
        formData.append('file', fileStream, file.originalname);
        formData.append('response_format', 'json');
        if (language && typeof language === 'string' && language.trim()) {
            formData.append('language', language.trim());
        }

        const response = await axios.post('https://api.ai.cloud-temple.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}`
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'TRANSCRIPTION', { chunkIndex, totalChunks }, 'SUCCESS', duration);
        res.json({ ...response.data, _serverDuration: duration });

    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'TRANSCRIPTION', { chunkIndex, totalChunks }, 'ERROR', duration);
        Logger.error(clientId, `Erreur transcription chunk ${chunkIndex}`, error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur lors de la transcription',
            details: error.response ? error.response.data : error.message
        });
    } finally {
        if (file && file.path) {
            fs.unlink(file.path, (err) => {
                if (err) Logger.error('server', `Erreur suppression fichier temporaire ${file.path}`, err);
            });
        }
    }
});

// Analyse de texte (Cloud Temple uniquement)
app.post('/api/analyze', async (req, res) => {
    const { model, text, chunkIndex, totalChunks, textPreview, clientId } = req.body;
    const startTime = Date.now();

    if (!model || !text || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "model", "text" et "clientId" sont requis' });
    }

    if (!hasConfiguredModelAllowlist()) {
        return res.status(500).json({ error: 'CLOUD_TEMPLE_ALLOWED_MODELS doit être défini dans .env' });
    }

    if (!isAllowedModel(model)) {
        return res.status(400).json({ error: `Le modèle "${model}" n'est pas autorisé par Transkryptor.` });
    }

    try {
        Logger.info(clientId, `Analyse avec Cloud Temple (modèle: ${model})...`);
        const response = await axios.post('https://api.ai.cloud-temple.com/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: text }],
            max_tokens: 16384
        }, {
            headers: { 'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}` }
        });

        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'ANALYSE', { chunkIndex, totalChunks, textPreview }, 'SUCCESS', duration);
        Logger.success(clientId, 'Analyse Cloud Temple réussie');
        res.json(response.data);

    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'ANALYSE', { chunkIndex, totalChunks, textPreview }, 'ERROR', duration);
        Logger.error(clientId, `Erreur lors de l'analyse`, error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur lors de l\'analyse',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Synthèse de texte (Cloud Temple uniquement)
const SYNTHESIS_PROMPT_FR = `
À partir de l'analyse fournie ci-dessous, rédige une synthèse exécutive claire, concise et professionnelle. La synthèse doit être structurée pour une compréhension rapide et une prise de décision efficace.

**Format attendu :**

**1. Résumé Exécutif :**
   - Un paragraphe de 3 à 5 phrases maximum qui résume l'essentiel de l'analyse. Quelle est l'information la plus critique à retenir ?

**2. Points Clés :**
   - Une liste à puces (3 à 5 points) qui met en évidence les découvertes, conclusions ou thèmes les plus importants de l'analyse. Chaque point doit être une phrase courte et percutante.

**3. Actions Recommandées / Prochaines Étapes :**
   - Une liste à puces (2 à 3 points) de suggestions concrètes ou de questions à explorer basées sur l'analyse. Que devrait-on faire avec cette information ?

---
**Analyse à synthétiser :**
`;

const SYNTHESIS_PROMPT_EN = `
From the analysis provided below, write a clear, concise and professional executive summary. The summary must be structured for rapid comprehension and efficient decision-making.

**Expected format:**

**1. Executive Summary:**
   - A paragraph of 3 to 5 sentences maximum that summarizes the essence of the analysis. What is the most critical piece of information to remember?

**2. Key Points:**
   - A bullet list (3 to 5 points) that highlights the most important findings, conclusions or themes from the analysis. Each point must be a short and impactful sentence.

**3. Recommended Actions / Next Steps:**
   - A bullet list (2 to 3 points) of concrete suggestions or questions to explore based on the analysis. What should be done with this information?

---
**Analysis to summarize:**
`;

// Mapping ISO 639-1 → nom de langue en anglais (pour instruction LLM "Reply in {lang}").
const LANGUAGE_NAMES_EN = {
    fr: 'French',
    en: 'English',
    es: 'Spanish',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    pl: 'Polish',
    ru: 'Russian',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
    tr: 'Turkish',
};

function buildSynthesisPrompt(targetLanguage, text) {
    const code = (targetLanguage || '').trim().toLowerCase();
    if (!code) {
        return `${SYNTHESIS_PROMPT_FR}\n\n${text}`;
    }
    if (code === 'fr') {
        return `${SYNTHESIS_PROMPT_FR}\n\n${text}`;
    }
    if (code === 'en') {
        return `${SYNTHESIS_PROMPT_EN}\n\n${text}`;
    }
    const langName = LANGUAGE_NAMES_EN[code] || code;
    const instruction = `IMPORTANT: Reply entirely in ${langName} (ISO code: ${code}). Do not use any other language.\n\n`;
    return `${instruction}${SYNTHESIS_PROMPT_EN}\n\n${text}`;
}

const MAX_CUSTOM_PROMPT_LENGTH = 8000;

app.post('/api/synthesize', async (req, res) => {
    const { model, text, clientId, customPrompt, targetLanguage } = req.body;
    const startTime = Date.now();

    if (!model || !text || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "model", "text" et "clientId" sont requis' });
    }

    if (!hasConfiguredModelAllowlist()) {
        return res.status(500).json({ error: 'CLOUD_TEMPLE_ALLOWED_MODELS doit être défini dans .env' });
    }

    if (!isAllowedModel(model)) {
        return res.status(400).json({ error: `Le modèle "${model}" n'est pas autorisé par Transkryptor.` });
    }

    // Priorité : customPrompt (AXE 3) > buildSynthesisPrompt(targetLanguage) (AXE 2)
    let fullPrompt;
    if (typeof customPrompt === 'string' && customPrompt.trim().length > 0) {
        if (customPrompt.trim().length > MAX_CUSTOM_PROMPT_LENGTH) {
            return res.status(400).json({
                error: `Le prompt personnalisé dépasse la limite de ${MAX_CUSTOM_PROMPT_LENGTH} caractères.`
            });
        }
        fullPrompt = `${customPrompt}\n\n${text}`;
    } else {
        fullPrompt = buildSynthesisPrompt(targetLanguage, text);
    }

    try {
        Logger.info(clientId, `Synthèse avec Cloud Temple (modèle: ${model})...`);
        const response = await axios.post('https://api.ai.cloud-temple.com/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: fullPrompt }],
            max_tokens: 8192
        }, {
            headers: { 'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}` }
        });

        const synthesisText = response.data.choices[0].message.content;
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'SYNTHESE', { model, targetLanguage: targetLanguage || 'fr' }, 'SUCCESS', duration);
        Logger.success(clientId, `Synthèse Cloud Temple réussie (langue: ${targetLanguage || 'fr'})`);
        res.json({ synthesis: synthesisText });

    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'SYNTHESE', { model, targetLanguage: targetLanguage || 'fr' }, 'ERROR', duration);
        Logger.error(clientId, `Erreur lors de la synthèse`, error);
        res.status(500).json({
            error: 'Erreur interne du serveur lors de la synthèse',
            details: error.response ? error.response.data : error.message
        });
    }
});

// --- Servir l'application Frontend ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    Logger.success('server', `Transkryptor v${APP_VERSION} démarré sur le port ${PORT}`);
});
