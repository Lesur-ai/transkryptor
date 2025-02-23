const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { encode } = require('gpt-3-encoder');
const path = require('path');
const fs = require('fs');
const Logger = require('./public/js/logger');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));


app.get('/favicon.ico', (req, res) => res.status(204).end());

app.post('/test-keys', async (req, res) => {
    Logger.startSection('Test des clés API');
    const { openaiKey, anthropicKey } = req.body;

    if (!openaiKey || !anthropicKey) {
        Logger.error('Clés API manquantes');
        Logger.endSection('Test des clés API');
        return res.status(400).json({ error: 'Les deux clés API sont requises' });
    }

    try {
        Logger.info('Test de la clé OpenAI...');
        const openaiResponse = await axios.get("https://api.openai.com/v1/models", {
            headers: { "Authorization": `Bearer ${openaiKey}` }
        });
        Logger.success('Test OpenAI réussi');

        Logger.info('Test de la clé Anthropic...');
        const anthropicResponse = await axios.post('https://api.anthropic.com/v1/messages', {
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "Test" }]
        }, {
            headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
        });
        Logger.success('Test Anthropic réussi');

        res.json({ status: 'OK', message: 'Les deux clés API sont valides' });
        Logger.success('Test des clés API terminé avec succès');
    } catch (error) {
        Logger.error('Échec du test des clés API', error);
        const errorMessage = error.response 
            ? `Erreur API (${error.response.status}): ${error.response.statusText}`
            : error.message;
        res.status(400).json({ status: 'Error', message: errorMessage });
    }
    Logger.endSection('Test des clés API');
});

app.post('/analyze', async (req, res) => {
    Logger.startSection('Analyse de texte');
    try {
        const { prompt, apiKey, model, system, messages, max_tokens, temperature } = req.body;

        // Validation des paramètres
        if (!apiKey) {
            Logger.error('Clé API manquante');
            return res.status(400).json({ error: 'Clé API requise' });
        }

        if (!prompt && !messages) {
            Logger.error('Ni prompt ni messages fournis');
            return res.status(400).json({ error: 'Prompt ou messages requis' });
        }

        // Log des paramètres reçus
        Logger.debug({
            hasPrompt: !!prompt,
            hasMessages: !!messages,
            hasSystem: !!system,
            model: model || 'default',
            maxTokens: max_tokens || 'default',
            temperature: temperature || 'default'
        }, 'Paramètres reçus');

        // Préparation de la requête
        const inputContent = prompt || messages[0].content;
        const tokenCount = encode(inputContent).length;
        Logger.info(`Tokens en entrée: ${tokenCount}`);

        const requestBody = messages ? {
            model: model || "claude-3-5-sonnet-20241022",
            max_tokens: max_tokens || 8192,
            temperature: temperature || 0.7,
            system,
            messages
        } : {
            model: "claude-3-5-sonnet-20241022",
            system: "You must ALWAYS provide COMPLETE and NORMAL responses. NEVER give concise or summarized answers. Your role is to develop each point thoroughly and extensively. You must NEVER stop mid-response or suggest continuing later. Complete answers are mandatory, partial or concise responses are forbidden.",
            max_tokens: 8192,
            temperature: 0.7,
            messages: [{ role: "user", content: prompt }]
        };

        // Appel API
        Logger.api.request('/v1/messages', requestBody);
        const response = await axios.post('https://api.anthropic.com/v1/messages', requestBody, {
            headers: {
                "x-api-key": apiKey.trim(),
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }
        });

        // Traitement de la réponse
        const responseTokenCount = encode(response.data.content[0].text).length;
        Logger.api.response(response.data, {
            input: tokenCount,
            output: responseTokenCount,
            ratio: ((responseTokenCount / 8192) * 100).toFixed(2)
        });

        res.json({ ...response.data, tokenCount, responseTokenCount });
        Logger.success('Analyse terminée avec succès');
    } catch (error) {
        Logger.error('Erreur lors de l\'analyse', error);
        res.status(500).json({
            error: error.message,
            details: error.response?.data
        });
    }
    Logger.endSection('Analyse de texte');
});

app.get('/', (req, res) => {
    Logger.startSection('Servir index.html');
    const indexPath = path.join(__dirname, 'public', 'index.html');

    if (!fs.existsSync(indexPath)) {
        Logger.error(`Fichier non trouvé: ${indexPath}`);
        return res.status(404).send('Fichier index.html non trouvé');
    }

    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) {
            Logger.error('Erreur de lecture du fichier', err);
            return res.status(500).send('Erreur serveur lors de la lecture du fichier');
        }

        const host = req.get('host').split(':')[0];
        const scriptToInject = `<script>
            const SERVER_HOST = "${host}";
            const SERVER_PORT = ${PORT};
            const API_URL = "http://${host}:${PORT}";
        </script>`;

        const modifiedHtml = data.replace('</head>', `${scriptToInject}</head>`);

        if (modifiedHtml.includes(scriptToInject)) {
            Logger.success('Injection des informations serveur réussie');
        } else {
            Logger.warn('Échec de l\'injection des informations serveur');
        }

        res.send(modifiedHtml);
        Logger.endSection('Servir index.html');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    Logger.success(`Serveur démarré sur le port ${PORT}`);
});
