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
let APP_VERSION = '5.0.0';
try {
    APP_VERSION = fs.readFileSync(path.join(__dirname, '../../VERSION'), 'utf-8').trim();
} catch (e) {
    console.warn('Fichier VERSION non trouvé, utilisation de la version par défaut.');
}

// --- Whitelist des modèles autorisés (ordre = priorité d'affichage) ---
const ALLOWED_MODELS = [
    'qwen3.5:35b',
    'qwen3.5:27b',
    'qwen3.6',
    'gemma4',
    'gpt-oss:120b',
    'qwen3-2507-gptq:235b',
    'nemotron-3-super',
    'mistral-small3.2',
];

function isAllowedModel(modelId) {
    const lower = modelId.toLowerCase();
    return ALLOWED_MODELS.some(allowed => lower.includes(allowed.toLowerCase()));
}

function getAllowedScore(modelId) {
    const lower = modelId.toLowerCase();
    for (let i = 0; i < ALLOWED_MODELS.length; i++) {
        if (lower.includes(ALLOWED_MODELS[i].toLowerCase())) return i;
    }
    return ALLOWED_MODELS.length;
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

        // Whitelist stricte : ne garder que les modèles autorisés
        const allowedModels = allModels.filter(m => isAllowedModel(m.id));

        // Trier dans l'ordre de la whitelist
        allowedModels.sort((a, b) => {
            return getAllowedScore(a.id) - getAllowedScore(b.id);
        });

        Logger.success(clientId, `${allowedModels.length} modèles autorisés (${allModels.length} total sur Cloud Temple)`);
        res.json(allowedModels);
    } catch (error) {
        Logger.error(clientId, `Erreur lors de la récupération des modèles`, error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Transcription audio (Cloud Temple Whisper uniquement)
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    const { clientId, originalFileName, originalFileType, originalFileSize } = req.body;
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
const SYNTHESIS_PROMPT = `
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

app.post('/api/synthesize', async (req, res) => {
    const { model, text, clientId } = req.body;
    const startTime = Date.now();

    if (!model || !text || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "model", "text" et "clientId" sont requis' });
    }

    const fullPrompt = `${SYNTHESIS_PROMPT}\n\n${text}`;

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
        Logger.logOperation(clientId, 'SYNTHESE', { model }, 'SUCCESS', duration);
        Logger.success(clientId, 'Synthèse Cloud Temple réussie');
        res.json({ synthesis: synthesisText });

    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'SYNTHESE', { model }, 'ERROR', duration);
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
