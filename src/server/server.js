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
let APP_VERSION = '6.0.0';
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

    // Helper : appelle Whisper Cloud Temple. Le stream est recréé à chaque appel
    // pour permettre un fallback de response_format (verbose_json → json) sans
    // "stream consumed" error sur le 2e essai.
    const callWhisper = (format) => {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path), file.originalname);
        formData.append('response_format', format);
        if (language && typeof language === 'string' && language.trim()) {
            formData.append('language', language.trim());
        }
        return axios.post('https://api.ai.cloud-temple.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}`
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
    };

    try {
        // verbose_json est le format OpenAI/Whisper standard qui inclut segments + language.
        // La doc Cloud Temple ne le mentionne pas explicitement mais ne l'interdit pas
        // (seuls text/srt/vtt sont marqués comme non supportés). Fallback gracieux sur json.
        let response;
        try {
            response = await callWhisper('verbose_json');
        } catch (firstErr) {
            const status = firstErr.response ? firstErr.response.status : null;
            if (status && status >= 400 && status < 500) {
                Logger.info(clientId, `[WARN] Whisper verbose_json rejeté (HTTP ${status}), fallback sur json`);
                response = await callWhisper('json');
            } else {
                throw firstErr;
            }
        }

        if (!response.data || !Array.isArray(response.data.segments) || response.data.segments.length === 0) {
            Logger.info(clientId, `[WARN] Whisper a renvoyé une réponse SANS segments — la diarization (si activée) n'aura pas de timestamps.`);
        }

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
    const { model, text, chunkIndex, totalChunks, textPreview, clientId, targetLanguage } = req.body;
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

    // Si targetLanguage est demandé (et différent de FR par défaut), on préfixe
    // une instruction de langue. Le prompt d'analyse (en FR) reste tel quel —
    // le LLM comprend les règles en FR et produit la sortie corrigée dans la
    // langue cible. Cohérence UX : tout l'output (transcription/analyse/synthèse)
    // est dans la même langue choisie par l'utilisateur.
    let userContent = text;
    const code = (targetLanguage || '').trim().toLowerCase();
    if (code && code !== 'fr') {
        const langName = LANGUAGE_NAMES_EN[code] || code;
        const instruction = `IMPORTANT: Reply entirely in ${langName} (ISO code: ${code}). Do not use any other language. The instructions below are in French, but your output MUST be in ${langName}.\n\n`;
        userContent = `${instruction}${text}`;
    }

    try {
        Logger.info(clientId, `Analyse avec Cloud Temple (modèle: ${model}${code ? `, langue: ${code}` : ''})...`);
        const response = await axios.post('https://api.ai.cloud-temple.com/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: userContent }],
            max_tokens: 16384,
            // Désactive le mode "thinking" sur les modèles reasoning type qwen3.6 :
            // sans ça, la réponse arrive dans message.reasoning (pas .content) et
            // notre code ne la lit pas. Paramètre ignoré silencieusement par les
            // autres modèles (Mistral, Gemma, Qwen non-thinking).
            enable_thinking: false
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

    // Priorité d'application :
    //   - customPrompt (AXE 3) si fourni → prime sur les prompts par défaut serveur
    //   - sinon buildSynthesisPrompt(targetLanguage) (AXE 2) → FR/EN traduits
    // Quand customPrompt ET targetLanguage sont fournis, on préfixe une instruction
    // de langue pour ne pas court-circuiter l'AXE 2 (les presets côté client sont en FR).
    let fullPrompt;
    const hasCustomPrompt = typeof customPrompt === 'string' && customPrompt.trim().length > 0;
    if (hasCustomPrompt) {
        if (customPrompt.trim().length > MAX_CUSTOM_PROMPT_LENGTH) {
            return res.status(400).json({
                error: `Le prompt personnalisé dépasse la limite de ${MAX_CUSTOM_PROMPT_LENGTH} caractères.`
            });
        }
        const code = (targetLanguage || '').trim().toLowerCase();
        if (code && code !== 'fr') {
            const langName = LANGUAGE_NAMES_EN[code] || code;
            const instruction = `IMPORTANT: Reply entirely in ${langName} (ISO code: ${code}). Do not use any other language.\n\n`;
            fullPrompt = `${instruction}${customPrompt}\n\n${text}`;
        } else {
            fullPrompt = `${customPrompt}\n\n${text}`;
        }
    } else {
        fullPrompt = buildSynthesisPrompt(targetLanguage, text);
    }

    try {
        Logger.info(clientId, `Synthèse avec Cloud Temple (modèle: ${model})...`);
        const response = await axios.post('https://api.ai.cloud-temple.com/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: fullPrompt }],
            max_tokens: 8192,
            enable_thinking: false
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

// --- Diarization LLM-based (AXE 4 — v6.0) ---
//
// Note importante : cette diarization NE LIT PAS l'audio.
// Elle envoie le texte transcrit + ses segments Whisper à un LLM Cloud Temple
// qui infère qui parle quand par analyse purement textuelle. Qualité variable.
function buildDiarizationPrompt(text, segments, speakerCount) {
    const safeSegments = Array.isArray(segments) ? segments : [];
    const segmentsBlock = safeSegments.length > 0
        ? safeSegments.map((s, idx) => {
            const id = (s && s.id !== undefined) ? s.id : idx;
            const content = (s && typeof s.text === 'string') ? s.text.trim() : '';
            return `[${id}] ${content}`;
        }).join('\n')
        : `[0] ${String(text || '').trim()}`;

    const speakerLine = (speakerCount && speakerCount > 0)
        ? `Nombre de locuteurs attendu : ${speakerCount}.`
        : `Nombre de locuteurs attendu : inconnu (à déterminer).`;

    return [
        "Tu es un expert en analyse de conversations.",
        "Voici la transcription d'un échange audio découpée en segments numérotés.",
        "Identifie qui parle dans chaque segment et regroupe les tours de parole consécutifs d'un même locuteur.",
        speakerLine,
        "",
        "Réponds UNIQUEMENT avec un JSON valide STRICT, sans texte autour, sans bloc Markdown, sans commentaire :",
        '{"turns": [{"speaker": "Speaker 1", "segmentIds": [0,1,2]}, ...]}',
        "",
        "Règles :",
        "- Les noms de locuteurs doivent être de la forme \"Speaker 1\", \"Speaker 2\", etc.",
        "- segmentIds liste les IDs numériques des segments du tour, dans l'ordre.",
        "- Chaque segment doit être assigné à un (et un seul) tour de parole.",
        "- Conserve l'ordre chronologique des tours.",
        "- N'inclus PAS le texte des segments dans ta réponse — le serveur le reconstruit à partir des IDs.",
        "",
        "Segments :",
        segmentsBlock,
    ].join('\n');
}

function extractJsonFromLlmContent(content) {
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    // Strip markdown fences if present
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
    try {
        return JSON.parse(candidate);
    } catch (_) {
        // Try to grab the first {...} block
        const braceStart = candidate.indexOf('{');
        const braceEnd = candidate.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd > braceStart) {
            try {
                return JSON.parse(candidate.slice(braceStart, braceEnd + 1));
            } catch (_) {
                return null;
            }
        }
        return null;
    }
}

function buildTurnsWithTimestamps(turns, segments) {
    // Stocke chaque segment sous son ID NUMÉRIQUE (le LLM peut renvoyer 0 ou "0",
    // on uniformise) pour rendre buildTurnsWithTimestamps robuste aux deux formats.
    const segMap = new Map();
    (segments || []).forEach((s, idx) => {
        const rawId = (s && s.id !== undefined) ? s.id : idx;
        const numericId = Number(rawId);
        if (!Number.isNaN(numericId)) segMap.set(numericId, s);
    });

    return (turns || []).map((turn, turnIdx) => {
        const rawSegIds = Array.isArray(turn.segmentIds) ? turn.segmentIds : [];
        let startTime = null;
        let endTime = null;
        const textParts = [];
        // On collecte UNIQUEMENT les segmentIds réellement valides (présents dans
        // segMap). Cela garantit la cohérence avec computeCoveredCount du
        // handler /api/diarize : ce qui est dans tour.segmentIds est ce qui est
        // compté en couverture. Les IDs hallucinés/invalides sont ignorés des deux côtés.
        const validSegIds = [];

        rawSegIds.forEach(sid => {
            const numericSid = typeof sid === 'number' ? sid : Number(sid);
            if (Number.isNaN(numericSid)) return;
            const seg = segMap.get(numericSid);
            if (!seg) return;
            validSegIds.push(numericSid);
            const segStart = (typeof seg.start === 'number') ? seg.start : null;
            const segEnd = (typeof seg.end === 'number') ? seg.end : null;
            if (segStart !== null && (startTime === null || segStart < startTime)) startTime = segStart;
            if (segEnd !== null && (endTime === null || segEnd > endTime)) endTime = segEnd;
            if (typeof seg.text === 'string' && seg.text.trim()) {
                textParts.push(seg.text.trim());
            }
        });

        // Reconstruction du texte côté serveur depuis les segments Whisper.
        // Évite de demander au LLM de réécrire le texte — économise ~10× sur l'output.
        // Backward-compat : si le LLM renvoie quand même turn.text non vide, on le respecte.
        const reconstructedText = textParts.join(' ');
        const turnText = (typeof turn.text === 'string' && turn.text.trim())
            ? turn.text
            : reconstructedText;

        return {
            speaker: turn.speaker || `Speaker ${turnIdx + 1}`,
            segmentIds: validSegIds,
            text: turnText,
            startTime,
            endTime,
        };
    });
}

/**
 * POST /api/diarize — endpoint Server-Sent Events.
 *
 * Streame les tours de parole au fur et à mesure que le LLM Cloud Temple les
 * génère, plutôt que d'attendre la réponse complète. L'utilisateur voit
 * apparaître les locuteurs un par un (latence perçue réduite, retour visuel
 * continu — comme ChatGPT).
 *
 * Events émis vers le client (format SSE) :
 *   - "start"    : {segments, model}                 — début du traitement
 *   - "turn"     : {speaker, segmentIds, text, startTime, endTime} — un tour parsé
 *   - "complete" : {diarization, turns, durationMs}  — tout est terminé
 *   - "error"    : {message, details?}               — échec
 */
app.post('/api/diarize', async (req, res) => {
    const { model, text, segments, speakerCount, clientId } = req.body;
    const startTime = Date.now();

    if (!model || !clientId || (typeof text !== 'string' && !Array.isArray(segments))) {
        return res.status(400).json({ error: 'Les paramètres "model", "text" (ou "segments") et "clientId" sont requis' });
    }
    if (!hasConfiguredModelAllowlist()) {
        return res.status(500).json({ error: 'CLOUD_TEMPLE_ALLOWED_MODELS doit être défini dans .env' });
    }
    if (!isAllowedModel(model)) {
        return res.status(400).json({ error: `Le modèle "${model}" n'est pas autorisé par Transkryptor.` });
    }

    const safeSpeakerCount = (typeof speakerCount === 'number' && speakerCount > 0) ? speakerCount : null;
    const basePrompt = buildDiarizationPrompt(text || '', segments || [], safeSpeakerCount);

    // Set des IDs numériques de segments RÉELLEMENT envoyés à Whisper (miroir
    // exact de la logique de buildTurnsWithTimestamps). Sert de filtre anti-
    // hallucination : un LLM qui inventerait des IDs hors-corpus (ex. [42, 999,
    // 1234] alors qu'on a 100 segments) ne pourra pas gonfler artificiellement
    // la couverture. Les NaN (id non parsable) sont exclus.
    const safeSegments = Array.isArray(segments) ? segments : [];
    const expectedIds = new Set();
    safeSegments.forEach((s, idx) => {
        const rawId = (s && s.id !== undefined) ? s.id : idx;
        const numericId = Number(rawId);
        if (!Number.isNaN(numericId)) expectedIds.add(numericId);
    });

    // Ouvre une connexion SSE vers le client
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const sendEvent = (eventName, data) => {
        try {
            res.write(`event: ${eventName}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (_) { /* socket fermé côté client */ }
    };

    // Heartbeat dans les logs serveur (panneau visible en bas de la page client)
    const heartbeat = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        Logger.info(clientId, `[DIARIZATION] Stream en cours... ${elapsed}s écoulés.`);
    }, 10000);

    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(heartbeat);
        try { res.end(); } catch (_) {}
    };

    sendEvent('start', { segments: (segments || []).length, model });
    Logger.info(clientId, `Diarization LLM-based en streaming (modèle: ${model})... ${(segments || []).length} segments.`);

    try {
        const llmRes = await axios.post('https://api.ai.cloud-temple.com/v1/chat/completions', {
            model,
            messages: [{ role: 'user', content: basePrompt }],
            max_tokens: 16384,
            stream: true,
            enable_thinking: false,
        }, {
            headers: { 'Authorization': `Bearer ${process.env.CLOUD_TEMPLE_API_KEY}` },
            responseType: 'stream',
        });

        let sseBuffer = '';      // buffer des events SSE entrants ("data: {...}\n\n")
        let llmAccum = '';       // accumulateur du contenu LLM (concat des delta.content)
        // Notre prompt impose ce format strict — la regex reconstruit les tours au fil de l'eau.
        const TURN_RE = /\{\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*"segmentIds"\s*:\s*\[([\d,\s]+)\]\s*\}/g;
        let regexLastIndex = 0;
        const emitted = [];

        const tryExtractTurns = () => {
            TURN_RE.lastIndex = regexLastIndex;
            let m;
            while ((m = TURN_RE.exec(llmAccum)) !== null) {
                const speaker = m[1];
                const segmentIds = m[2].split(',')
                    .map(s => parseInt(s.trim(), 10))
                    .filter(n => !isNaN(n));
                const enriched = buildTurnsWithTimestamps([{ speaker, segmentIds }], segments || [])[0];
                emitted.push(enriched);
                sendEvent('turn', enriched);
                regexLastIndex = TURN_RE.lastIndex;
            }
        };

        llmRes.data.on('data', (chunk) => {
            sseBuffer += chunk.toString('utf-8');
            let nlIdx;
            while ((nlIdx = sseBuffer.indexOf('\n\n')) !== -1) {
                const event = sseBuffer.slice(0, nlIdx);
                sseBuffer = sseBuffer.slice(nlIdx + 2);
                const dataLines = event.split('\n').filter(l => l.startsWith('data: '));
                for (const dl of dataLines) {
                    const payload = dl.slice(6).trim();
                    if (!payload || payload === '[DONE]') continue;
                    try {
                        const obj = JSON.parse(payload);
                        const delta = obj.choices && obj.choices[0] && obj.choices[0].delta;
                        if (delta && typeof delta.content === 'string') {
                            llmAccum += delta.content;
                        }
                    } catch (_) { /* skip chunk SSE malformé */ }
                }
            }
            tryExtractTurns();
        });

        llmRes.data.on('end', () => {
            const totalSegments = (segments || []).length;

            // Helper : nombre de segments uniques couverts par les tours
            // collectés. On INTERSECTE avec expectedIds : un ID renvoyé par
            // le LLM n'est compté que s'il existe dans les segments Whisper
            // réellement envoyés. Cela neutralise les hallucinations
            // (LLM qui renvoie des IDs absurdes hors corpus) qui sinon
            // gonfleraient artificiellement le ratio de couverture.
            const computeCoveredCount = () => {
                const covered = new Set();
                emitted.forEach(t => (t.segmentIds || []).forEach(id => {
                    const n = Number(id);
                    if (!Number.isNaN(n) && expectedIds.has(n)) covered.add(n);
                }));
                return covered.size;
            };

            // Étape 1 : si aucun tour n'a été capté en streaming OU si la
            // couverture est insuffisante (<90%), tenter une réconciliation
            // via un parsing global de l'accumulateur LLM. La regex de
            // streaming peut rater des tours dont les segmentIds contiennent
            // des espaces atypiques ou des formats inattendus ; le parser
            // global est plus permissif.
            const RECONCILE_THRESHOLD = 0.9;
            const needsReconcile = totalSegments > 0
                && (emitted.length === 0 || (computeCoveredCount() / totalSegments) < RECONCILE_THRESHOLD);

            if (needsReconcile) {
                const parsed = extractJsonFromLlmContent(llmAccum);
                if (parsed && Array.isArray(parsed.turns)) {
                    const finalAll = buildTurnsWithTimestamps(parsed.turns, segments || []);
                    // Émettre uniquement les tours qui n'ont PAS déjà été streamés.
                    // Identifiant déduplicateur : speaker + segmentIds triés en CSV.
                    const seenKey = new Set(emitted.map(t =>
                        `${t.speaker}::${[...(t.segmentIds || [])].map(Number).sort((a, b) => a - b).join(',')}`
                    ));
                    finalAll.forEach(t => {
                        const key = `${t.speaker}::${[...(t.segmentIds || [])].map(Number).sort((a, b) => a - b).join(',')}`;
                        if (!seenKey.has(key)) {
                            emitted.push(t);
                            sendEvent('turn', t);
                            seenKey.add(key);
                        }
                    });
                }
            }

            const duration = Date.now() - startTime;
            const coveredCount = computeCoveredCount();
            const coveragePct = totalSegments > 0 ? Math.round((coveredCount / totalSegments) * 100) : 100;
            const coverage = { coveredSegments: coveredCount, totalSegments, percentage: coveragePct };

            const HARD_FAIL_THRESHOLD = 50; // pourcentage en dessous duquel on considère l'échec
            if (emitted.length === 0 || (totalSegments > 0 && coveragePct < HARD_FAIL_THRESHOLD)) {
                const raw = llmAccum;
                const preview = raw.length > 700
                    ? `${raw.slice(0, 300)}\n...[TRONQUÉ ${raw.length} chars]...\n${raw.slice(-300)}`
                    : raw;
                Logger.error(clientId, `Diarization : couverture insuffisante (${emitted.length} tours, ${coveragePct}% des ${totalSegments} segments couverts, modèle: ${model}, ${raw.length} chars). Aperçu :\n${preview}`, null);
                Logger.logOperation(clientId, 'DIARIZATION', { model, coverage: coveragePct }, 'ERROR', duration);
                sendEvent('error', {
                    message: emitted.length === 0
                        ? 'La diarization a échoué : aucun tour identifiable. Essayez un modèle plus puissant.'
                        : `Diarization incomplète : seuls ${coveragePct}% des ${totalSegments} segments ont été identifiés. Essayez un modèle plus puissant ou un audio plus court.`,
                    coverage
                });
            } else {
                // 50% ≤ couverture ≤ 100% : on émet 'complete' avec coverage{}.
                // Le client peut afficher un bandeau warning si percentage < 100
                // (cas 50%-99%) mais on ne bloque pas le résultat car il reste
                // exploitable.
                sendEvent('complete', { diarization: emitted, turns: emitted.length, durationMs: duration, coverage });
                Logger.logOperation(clientId, 'DIARIZATION', { model, turns: emitted.length, coverage: coveragePct }, 'SUCCESS', duration);
                if (coveragePct < 100) {
                    Logger.info(clientId, `[DIARIZATION] [PARTIAL] Couverture incomplète : ${emitted.length} tours, ${coveredCount}/${totalSegments} segments couverts (${coveragePct}%) en ${(duration / 1000).toFixed(1)}s. Résultat tout de même renvoyé (>= ${HARD_FAIL_THRESHOLD}% du seuil dur).`);
                } else {
                    Logger.success(clientId, `Diarization OK (${emitted.length} tours, 100% des ${totalSegments} segments, ${(duration / 1000).toFixed(1)}s).`);
                }
            }
            cleanup();
        });

        llmRes.data.on('error', (err) => {
            Logger.error(clientId, `Erreur stream LLM diarization`, err);
            Logger.logOperation(clientId, 'DIARIZATION', { model }, 'ERROR', Date.now() - startTime);
            sendEvent('error', { message: err.message || 'Erreur stream LLM' });
            cleanup();
        });

        // Coupure côté client : on relâche le stream Cloud Temple
        req.on('close', () => {
            if (!cleanedUp) {
                Logger.info(clientId, '[DIARIZATION] Client a coupé la connexion, abandon.');
                try { llmRes.data.destroy(); } catch (_) {}
                cleanup();
            }
        });

    } catch (error) {
        Logger.logOperation(clientId, 'DIARIZATION', { model }, 'ERROR', Date.now() - startTime);
        Logger.error(clientId, `Erreur diarization (init stream)`, error);
        sendEvent('error', {
            message: 'Erreur interne lors du démarrage de la diarization.',
            details: error.response ? JSON.stringify(error.response.data || {}) : error.message
        });
        cleanup();
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
