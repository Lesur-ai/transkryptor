const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { encode } = require('gpt-3-encoder');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substr(0, 19);
}

function log(message) {
    console.log(`[${getTimestamp()}] ${message}`);
}


app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // Répond avec un statut "No Content"
});

app.post('/test-keys', async (req, res) => {
    const { openaiKey, anthropicKey } = req.body;

    if (!openaiKey || !anthropicKey) {
        log('Erreur: Clés API manquantes');
        return res.status(400).json({ error: 'Les deux clés API sont requises' });
    }

    try {
        log('Test des clés API en cours...');

        // Test de la clé OpenAI
        const openaiResponse = await axios.get("https://api.openai.com/v1/models", {
            headers: { "Authorization": `Bearer ${openaiKey}` }
        });
        log('Test de la clé OpenAI réussi');

        // Test de la clé Anthropic
        const anthropicResponse = await axios.post('https://api.anthropic.com/v1/messages', {
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1,
            messages: [{ role: "user", content: "Test" }]
        }, {
            headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
        });
        log('Test de la clé Anthropic réussi');

        res.json({ status: 'OK', message: 'Les deux clés API sont valides' });
        log('Test des clés API terminé avec succès');
    } catch (error) {
        log('Erreur lors du test des clés API: ' + error.message);
        let errorMessage = 'Une ou plusieurs clés API sont invalides';
        if (error.response) {
            errorMessage += ` (${error.response.status}: ${error.response.statusText})`;
            log('Détails de l\'erreur: ' + JSON.stringify(error.response.data));
        }
        res.status(400).json({
            status: 'Error',
            message: errorMessage,
            error: error.message
        });
    }
});

app.post('/analyze', async (req, res) => {
    try {
        const { prompt, apiKey } = req.body;

        if (!prompt || !apiKey) {
            log('Erreur: Prompt ou clé API manquant');
            return res.status(400).json({ error: 'Prompt et clé API sont requis' });
        }

        const tokenCount = encode(prompt).length;
        log(`Requête d'analyse reçue. Nombre de tokens: ${tokenCount}`);

        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 8000,
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: {
                "x-api-key": apiKey.trim(),
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }
        });

        const responseTokenCount = encode(response.data.content[0].text).length;
        log(`Réponse reçue de l'API Anthropic. Nombre de tokens de la réponse: ${responseTokenCount}`);
        res.json({ ...response.data, tokenCount, responseTokenCount });
    } catch (error) {
        log('Erreur lors de l\'analyse: ' + error.message);
        if (error.response) {
            log('Détails de l\'erreur: ' + JSON.stringify(error.response.data));
        }
        res.status(500).json({
            error: error.message,
            details: error.response ? error.response.data : null
        });
    }
});

// Route pour servir index.html avec le port et l'hôte injectés
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');

    if (!fs.existsSync(indexPath)) {
        log(`Erreur: Le fichier ${indexPath} n'existe pas.`);
        return res.status(404).send('Fichier index.html non trouvé');
    }

    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) {
            log(`Erreur lors de la lecture de index.html: ${err}`);
            return res.status(500).send('Erreur serveur lors de la lecture du fichier');
        }

        const host = req.get('host').split(':')[0]; // Récupère le nom d'hôte sans le port
        const scriptToInject = `<script>
            const SERVER_HOST = "${host}";
            const SERVER_PORT = ${PORT};
            const API_URL = "http://${host}:${PORT}";
        </script>`;

        const modifiedHtml = data.replace('</head>', `${scriptToInject}</head>`);

        if (modifiedHtml.includes(scriptToInject)) {
            log('Injection des informations serveur réussie');
        } else {
            log('Attention: L\'injection des informations serveur a échoué');
        }

        res.send(modifiedHtml);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    log(`Serveur démarré sur le port ${PORT}`);
});
