require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { encode } = require('gpt-3-encoder');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FormData = require('form-data');
const Logger = require('./logger');

const app = express();

// --- Logique pour le streaming des logs (Server-Sent Events) ---
const clients = new Map(); // Stocke les clients connectés pour les logs (clientId -> response)

// Middleware pour ajouter les headers SSE
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    next();
});

// Endpoint auquel le client s'abonne pour recevoir ses logs
app.get('/api/logs', (req, res) => {
    const { clientId } = req.query;
    if (!clientId) {
        return res.status(400).send('clientId manquant.');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    clients.set(clientId, res);
    
    // On envoie juste une confirmation au client, le log de connexion se fera à la transcription.
    Logger.info(clientId, `Client connecté pour les logs.`);

    req.on('close', () => {
        clients.delete(clientId);
        // On utilise le logger pour la cohérence, avec l'ID "server"
        Logger.info('server', `Client ${clientId} déconnecté.`);
    });
});

// Fonction pour envoyer un log à un client spécifique
function sendLogToClient(clientId, logMessage) {
    const client = clients.get(clientId);
    if (client) {
        client.write(`data: ${JSON.stringify(logMessage)}\n\n`);
    }
}

// On passe la fonction de broadcast ciblée au logger
Logger.setBroadcastFunction(sendLogToClient);

// Configuration de Multer pour stocker les fichiers en mémoire
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Le serveur sert maintenant les fichiers statiques depuis le dossier src/client
app.use(express.static(path.join(__dirname, '../client')));


app.get('/favicon.ico', (req, res) => res.status(204).end());

// --- API Gateway Endpoints ---

// Endpoint pour lister les fournisseurs de services disponibles
app.get('/api/providers', (req, res) => {
    const providers = [
        { id: 'cloud-temple', name: 'Cloud Temple' },
        { id: 'openai', name: 'OpenAI' },
        { id: 'anthropic', name: 'Anthropic' }
    ];
    res.json(providers);
});

// Endpoint pour lister les modèles disponibles pour un fournisseur donné
app.get('/api/models', async (req, res) => {
    const { provider, clientId } = req.query;

    if (!provider || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "provider" et "clientId" sont requis' });
    }

    if (!provider) {
        return res.status(400).json({ error: 'Le paramètre "provider" est requis' });
    }

    try {
        let models = [];
        if (provider === 'cloud-temple') {
            Logger.info(clientId, 'Récupération des modèles depuis Cloud Temple...');
            const response = await axios.get('https://api.ai.cloud-temple.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}`
                }
            });
            // Nous ne retournons que les informations utiles au frontend
            models = response.data.data.map(model => ({
                id: model.id,
                name: model.id, // On peut améliorer ça si le nom est dans un autre champ
                aliases: model.aliases
            }));
            Logger.success(clientId, 'Modèles Cloud Temple récupérés');
        } else if (provider === 'openai') {
            // Logique pour OpenAI (à implémenter)
            // Pour l'instant, on retourne une liste statique
            models = [{ id: 'gpt-4o', name: 'GPT-4o' }];
        } else if (provider === 'anthropic') {
            // Logique pour Anthropic (à implémenter)
            // Pour l'instant, on retourne une liste statique
            models = [{ id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' }];
        } else {
            return res.status(400).json({ error: 'Fournisseur non supporté' });
        }
        res.json(models);
    } catch (error) {
        Logger.error(clientId, `Erreur lors de la récupération des modèles pour ${provider}`, error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Endpoint pour la transcription audio
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    const { provider, apiKey, clientId, originalFileName, originalFileType, originalFileSize } = req.body;
    // Correction: Parser les index en nombres entiers
    const chunkIndex = req.body.chunkIndex ? parseInt(req.body.chunkIndex, 10) : undefined;
    const totalChunks = req.body.totalChunks ? parseInt(req.body.totalChunks, 10) : undefined;
    const file = req.file;
    const startTime = Date.now();

    // Log de la connexion entrante (serveur uniquement), une seule fois pour le premier chunk
    if (file && chunkIndex === 0) {
        Logger.logConnection(clientId, {
            ip: req.ip,
            fileInfo: {
                name: originalFileName || file.originalname,
                sizeMb: (originalFileSize / (1024 * 1024)).toFixed(2), // Utilise la taille du fichier original
                type: originalFileType || file.mimetype,
            },
        });
    }

    if (!provider || !file || !clientId) {
        // Pas de log ici car on n'a pas de client à qui l'envoyer
        return res.status(400).json({ error: 'Les paramètres "provider", "file" et "clientId" sont requis' });
    }

    try {
        let transcription;
        if (provider === 'cloud-temple') {
            const formData = new FormData();
            formData.append('file', file.buffer, file.originalname);
            formData.append('response_format', 'json');

            const response = await axios.post('https://api.ai.cloud-temple.com/v1/audio/transcriptions', formData, {
                headers: {
                    ...formData.getHeaders(), // On réintroduit les headers générés par form-data
                    'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}`
                },
                maxContentLength: Infinity, // Ajout pour gérer les gros fichiers
                maxBodyLength: Infinity
            });
            transcription = response.data;
        } else if (provider === 'openai') {
            const formData = new FormData();
            formData.append('file', file.buffer, file.originalname);
            formData.append('model', 'whisper-1');

            const key = apiKey || process.env.OPENAI_API_KEY;
            if (!key) return res.status(400).json({ error: 'Clé API OpenAI manquante' });

            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${key}`
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            transcription = response.data;
        } else {
            return res.status(400).json({ error: 'Fournisseur de transcription non supporté' });
        }
        
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'TRANSCRIPTION', { chunkIndex, totalChunks }, 'SUCCESS', duration);
        // Ajoute la durée de traitement du serveur à la réponse
        res.json({ ...transcription, _serverDuration: duration });

    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'TRANSCRIPTION', { chunkIndex, totalChunks }, 'ERROR', duration);
        Logger.error(clientId, `Erreur transcription chunk ${chunkIndex}`, error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur lors de la transcription',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Endpoint pour l'analyse de texte
app.post('/api/analyze', async (req, res) => {
    const { provider, model, text, apiKey, chunkIndex, totalChunks, textPreview, clientId } = req.body;
    const startTime = Date.now();

    if (!provider || !model || !text || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "provider", "model", "text" et "clientId" sont requis' });
    }

    try {
        let analysis;
        if (provider === 'cloud-temple') {
            Logger.info(clientId, `Analyse avec Cloud Temple (modèle: ${model})...`);
            const response = await axios.post('https://api.ai.cloud-temple.com/v1/chat/completions', {
                model: model,
                messages: [{ role: 'user', content: text }],
                max_tokens: 8192
            }, {
                headers: { 'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}` }
            });
            analysis = response.data;
            Logger.success(clientId, 'Analyse Cloud Temple réussie');
        } else if (provider === 'anthropic') {
            Logger.info(clientId, `Analyse avec Anthropic (modèle: ${model})...`);
            const key = apiKey || process.env.ANTHROPIC_API_KEY;
            if (!key) return res.status(400).json({ error: 'Clé API Anthropic manquante' });

            const response = await axios.post('https://api.anthropic.com/v1/messages', {
                model: model,
                max_tokens: 8192,
                messages: [{ role: "user", content: text }]
            }, {
                headers: {
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                }
            });
            analysis = response.data;
            Logger.success(clientId, 'Analyse Anthropic réussie');
        } else {
            return res.status(400).json({ error: 'Fournisseur d\'analyse non supporté' });
        }
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'ANALYSE', { chunkIndex, totalChunks, textPreview }, 'SUCCESS', duration);
        res.json(analysis);
    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'ANALYSE', { chunkIndex, totalChunks, textPreview }, 'ERROR', duration);
        Logger.error(clientId, `Erreur lors de l'analyse avec ${provider}`, error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur lors de l\'analyse',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Endpoint pour la synthèse de texte
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
    const { provider, model, text, apiKey, clientId } = req.body;
    const startTime = Date.now();

    if (!provider || !model || !text || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "provider", "model", "text" et "clientId" sont requis' });
    }

    const fullPrompt = `${SYNTHESIS_PROMPT}\n\n${text}`;

    try {
        let synthesisText;
        if (provider === 'cloud-temple') {
            Logger.info(clientId, `Synthèse avec Cloud Temple (modèle: ${model})...`);
            const response = await axios.post('https://api.ai.cloud-temple.com/v1/chat/completions', {
                model: model,
                messages: [{ role: 'user', content: fullPrompt }],
                max_tokens: 4096
            }, {
                headers: { 'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}` }
            });
            synthesisText = response.data.choices[0].message.content;
            Logger.success(clientId, 'Synthèse Cloud Temple réussie');

        } else if (provider === 'anthropic') {
            Logger.info(clientId, `Synthèse avec Anthropic (modèle: ${model})...`);
            const key = apiKey || process.env.ANTHROPIC_API_KEY;
            if (!key) return res.status(400).json({ error: 'Clé API Anthropic manquante' });

            const response = await axios.post('https://api.anthropic.com/v1/messages', {
                model: model,
                max_tokens: 4096,
                messages: [{ role: "user", content: fullPrompt }]
            }, {
                headers: {
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                }
            });
            synthesisText = response.data.content[0].text;
            Logger.success(clientId, 'Synthèse Anthropic réussie');
        } else {
            return res.status(400).json({ error: 'Fournisseur de synthèse non supporté' });
        }
        
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'SYNTHESE', { model }, 'SUCCESS', duration);
        res.json({ synthesis: synthesisText });

    } catch (error) {
        const duration = Date.now() - startTime;
        Logger.logOperation(clientId, 'SYNTHESE', { model }, 'ERROR', duration);
        Logger.error(clientId, `Erreur lors de la synthèse avec ${provider}`, error);
        res.status(500).json({ 
            error: 'Erreur interne du serveur lors de la synthèse',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Endpoint pour valider les clés API
app.post('/api/validate-key', async (req, res) => {
    const { provider, apiKey, clientId } = req.body;

    if (!provider || !apiKey || !clientId) {
        return res.status(400).json({ error: 'Les paramètres "provider", "apiKey" et "clientId" sont requis' });
    }

    try {
        if (provider === 'openai') {
            // Appel léger pour valider la clé OpenAI (lister les modèles)
            await axios.get('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
        } else if (provider === 'anthropic') {
            // Appel léger pour valider la clé Anthropic (ping)
            await axios.post('https://api.anthropic.com/v1/messages', {
                model: "claude-3-haiku-20240307", // Modèle rapide et peu coûteux
                max_tokens: 1,
                messages: [{ role: "user", content: "ping" }]
            }, {
                headers: {
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                }
            });
        } else {
            return res.status(400).json({ error: 'Fournisseur non supporté' });
        }
        res.json({ success: true, message: `Clé pour ${provider} valide.` });
    } catch (error) {
        Logger.error(clientId, `Échec de validation de la clé pour ${provider}`, error.response ? error.response.data : error.message);
        res.status(401).json({ success: false, message: `Clé API pour ${provider} invalide.` });
    }
});


// --- Servir l'application Frontend ---

// L'injection de script n'est plus nécessaire car le frontend sera une SPA
// qui connaît déjà l'URL de son API.
// On sert simplement le fichier index.html du nouveau client.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // Pour les logs globaux du serveur, on utilise un ID statique.
    Logger.success('server', `Serveur démarré sur le port ${PORT}`);
});
