# Transkryptor v6.0.0

Transkryptor est une application web de transcription, d'analyse et de synthèse audio basée exclusivement sur Cloud Temple LLMaaS. La v6.0 ajoute l'interface FR/EN, la transcription et la synthèse multilingues, les prompts de synthèse configurables et une détection optionnelle des participants par analyse LLM.

![Capture d'écran de Transkryptor](images/screenshoot.png)

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Nouveautés v6.0](#nouveautes-v60)
- [Fonctionnalités](#fonctionnalites)
- [Architecture](#architecture)
- [Prérequis](#prerequis)
- [Installation locale](#installation-locale)
- [Configuration](#configuration)
- [Lancement avec Docker](#lancement-avec-docker)
- [Utilisation](#utilisation)
- [API serveur](#api-serveur)
- [Structure du projet](#structure-du-projet)
- [Sécurité et conformité](#securite-et-conformite)
- [Limites connues](#limites-connues)
- [Release et validation](#release-et-validation)
- [Licence](#licence)

## Vue d'ensemble

Transkryptor sert de démonstrateur technique pour l'intégration de Cloud Temple LLMaaS dans un contexte souverain et SecNumCloud. Le navigateur gère l'expérience utilisateur et le prétraitement audio, tandis que le serveur Node.js joue le rôle d'API Gateway : il centralise la clé Cloud Temple, applique une liste blanche de modèles et relaie les appels de transcription, d'analyse, de synthèse et de diarisation textuelle.

Le produit vise un flux simple : déposer un fichier audio, suivre la transcription par morceaux, obtenir une analyse structurée, générer une synthèse exploitable et, si besoin, afficher les échanges par locuteur.

## Nouveautés v6.0

- Interface utilisateur bilingue français / anglais avec sélection persistée.
- Transcription multilingue avec aide de langue optionnelle envoyée à Whisper Cloud Temple.
- Synthèse dans une langue cible distincte de la langue audio.
- Cinq presets de synthèse : synthèse exécutive, compte-rendu de réunion, actions et décisions, verbatim corrigé, analyse thématique.
- Mode prompt personnalisé avec limite serveur à 8000 caractères.
- Détection optionnelle des participants par LLM, avec affichage en streaming, onglet Locuteurs, renommage local des speakers et export texte.
- Protection de qualité sur la diarisation : filtrage des IDs de segments invalides, calcul de couverture, erreur sous 50% de couverture et avertissement client entre 50% et 99%.
- Version applicative alignée sur `6.0.0` dans `VERSION`, `package.json` et `/api/version`.

## Fonctionnalités

### Transcription audio

- Formats acceptés côté interface : MP3, WAV, M4A.
- Découpage audio en chunks de 30 secondes avec léger chevauchement.
- Traitement en lots parallèles côté navigateur.
- Rééchantillonnage en mono 24 kHz avant envoi.
- Appel Cloud Temple `/v1/audio/transcriptions`.
- Récupération des segments Whisper quand `verbose_json` est accepté, avec fallback sur `json`.

### Analyse et synthèse

- Analyse sémantique des textes transcrits via Cloud Temple Chat Completions.
- Modèle sélectionné dans une allowlist serveur stricte.
- Budgets de génération : 16384 tokens pour l'analyse, 8192 pour la synthèse.
- Synthèse exécutive ou synthèse guidée par preset.
- Sortie de synthèse en français, anglais ou autre langue cible supportée.

### Langues

- UI : français et anglais.
- Langue audio : auto-détection ou hint parmi les principales langues ISO 639-1 proposées dans l'interface.
- Langue de synthèse : identique à la transcription par défaut, ou choix explicite.
- Badge de langue détectée quand Whisper retourne une langue exploitable.

### Détection des participants

La diarisation v6.0 est volontairement textuelle : Transkryptor n'analyse pas les empreintes vocales. Il transmet la transcription et les segments horodatés à un LLM Cloud Temple, qui infère les tours de parole à partir du contenu.

Fonctions disponibles :

- activation par toggle, désactivée par défaut ;
- nombre attendu de locuteurs optionnel ;
- streaming des tours de parole pendant la génération ;
- onglet Locuteurs dédié ;
- affichage inline dans l'onglet Transcription ;
- renommage des locuteurs persisté dans `localStorage` par fichier ;
- export de l'onglet Locuteurs.

### Observabilité

- Logs serveur en temps réel via Server-Sent Events.
- Grille de progression par chunk.
- Statistiques de traitement : progression, vitesse, taille traitée, temps écoulé et temps moyen.
- Graphique de performance côté client.

## Architecture

```text
Navigateur
  ├─ SPA vanilla JavaScript
  ├─ Décodage audio Web Audio API
  ├─ Découpage en chunks WAV mono 24 kHz
  ├─ UI i18n, progression, résultats, exports
  └─ Appels HTTP/SSE vers le backend

Serveur Node.js / Express
  ├─ Sert les assets statiques
  ├─ Stocke les uploads temporaires sur disque
  ├─ Lit VERSION et .env
  ├─ Applique CLOUD_TEMPLE_ALLOWED_MODELS
  ├─ Proxy Cloud Temple LLMaaS
  └─ Diffuse logs et diarisation en SSE

Cloud Temple LLMaaS
  ├─ /v1/models
  ├─ /v1/audio/transcriptions
  └─ /v1/chat/completions
```

Le frontend ne reçoit jamais la clé Cloud Temple. Toutes les requêtes externes passent par le serveur Express.

## Prérequis

- Node.js 20 LTS recommandé.
- npm compatible avec `package-lock.json` v3.
- Une clé API Cloud Temple LLMaaS.
- Un navigateur moderne avec Web Audio API.
- Accès réseau serveur vers `https://api.ai.cloud-temple.com`.
- Accès réseau navigateur vers le CDN Chart.js et Marked, utilisés par l'interface actuelle.

## Installation locale

```bash
git clone https://github.com/Lesur-ai/transkryptor.git
cd transkryptor
npm ci
cp .env.example .env
```

Éditez ensuite `.env`, puis lancez :

```bash
npm start
```

L'application est disponible par défaut sur :

```text
http://localhost:3000
```

Le mode développement utilise le script suivant si `nodemon` est installé dans l'environnement :

```bash
npm run dev
```

## Configuration

Le fichier `.env` est obligatoire pour utiliser Cloud Temple.

| Variable | Obligatoire | Valeur par défaut | Rôle |
| --- | --- | --- | --- |
| `PORT` | Non | `3000` | Port HTTP du serveur Express. |
| `CLOUD_TEMPLE_API_KEY` | Oui | Aucune | Clé API Cloud Temple LLMaaS, utilisée uniquement côté serveur. |
| `CLOUD_TEMPLE_ALLOWED_MODELS` | Oui | Aucune | Liste exacte des modèles proposés dans l'UI et acceptés par `/api/analyze`, `/api/synthesize` et `/api/diarize`. |

Exemple :

```env
PORT=3000
CLOUD_TEMPLE_API_KEY=votre_cle_api_cloud_temple
CLOUD_TEMPLE_ALLOWED_MODELS=qwen3.5:397b,qwen3.6:35b-a3b,qwen3:235b,gemma4:31b,mistral-small3.2:24b,mistral-small4:119b
```

L'ordre de `CLOUD_TEMPLE_ALLOWED_MODELS` définit l'ordre d'affichage et le modèle sélectionné en priorité. Le serveur résout aussi les alias retournés par l'API Cloud Temple, mais rejette toute demande qui ne correspond pas à la liste configurée.

## Lancement avec Docker

```bash
cp .env.example .env
docker compose up --build
```

Le service écoute sur `http://localhost:3000`.

Pour nommer explicitement l'image de release :

```bash
APP_VERSION=6.0.0 docker compose build
```

Le conteneur utilise l'utilisateur `node`, conserve les uploads temporaires dans `src/server/uploads`, puis les supprime après traitement.

## Utilisation

1. Choisir la langue de l'interface.
2. Sélectionner un modèle Cloud Temple autorisé.
3. Déposer un fichier audio MP3, WAV ou M4A.
4. Choisir la langue audio, ou laisser l'auto-détection.
5. Choisir la langue de synthèse.
6. Activer la détection des participants si le contenu s'y prête.
7. Lancer le traitement et suivre les chunks, statistiques et logs serveur.
8. Lire les onglets Transcription, Analyse, Synthèse et Locuteurs.
9. Ajuster le preset de synthèse ou saisir un prompt personnalisé.
10. Télécharger le résultat de l'onglet actif.

## API serveur

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/version` | Retourne la version lue depuis `VERSION`. |
| `GET` | `/api/models?clientId=...` | Récupère les modèles Cloud Temple et applique l'allowlist serveur. |
| `GET` | `/api/logs?clientId=...` | Ouvre le flux SSE des logs serveur pour un client. |
| `POST` | `/api/transcribe` | Reçoit un chunk audio et le relaie à Cloud Temple Whisper. |
| `POST` | `/api/analyze` | Analyse un bloc de texte avec un modèle autorisé. |
| `POST` | `/api/synthesize` | Génère une synthèse à partir de l'analyse. |
| `POST` | `/api/diarize` | Streame la détection textuelle des locuteurs via SSE. |

Les endpoints d'analyse, de synthèse et de diarisation refusent les modèles absents de `CLOUD_TEMPLE_ALLOWED_MODELS`.

## Structure du projet

```text
transkryptor/
├── src/
│   ├── client/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── i18n/
│   │   │   ├── en.json
│   │   │   └── fr.json
│   │   ├── img/
│   │   │   └── logo-cloudtemple.svg
│   │   ├── js/
│   │   │   ├── ui/
│   │   │   │   ├── chart.js
│   │   │   │   ├── progress.js
│   │   │   │   ├── results.js
│   │   │   │   └── stats.js
│   │   │   ├── analysisProcessor.js
│   │   │   ├── apiService.js
│   │   │   ├── audioProcessor.js
│   │   │   ├── audioUtils.js
│   │   │   ├── download.js
│   │   │   ├── i18n.js
│   │   │   ├── main.js
│   │   │   ├── prompts.js
│   │   │   └── state.js
│   │   └── index.html
│   └── server/
│       ├── logger.js
│       ├── server.js
│       └── uploads/
├── docs/
├── images/
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── VERSION
├── changelog.md
├── package.json
├── package-lock.json
├── readme.md
└── README_EN.md
```

## Sécurité et conformité

- Cloud Temple est le seul fournisseur externe utilisé par la v6.0.
- La clé API reste côté serveur, dans `.env`.
- Le frontend ne permet plus de saisir de clés OpenAI ou Anthropic.
- Les modèles utilisables sont contrôlés par une allowlist serveur.
- Les fichiers uploadés sont stockés temporairement sur disque et supprimés après traitement.
- Les logs évitent d'exposer les secrets.
- La conformité SecNumCloud dépend de l'usage effectif des services Cloud Temple qualifiés et de l'environnement de déploiement.

## Limites connues

- La diarisation est une inférence textuelle par LLM, pas une diarisation audio biométrique. Elle fonctionne mieux sur les interviews, questions/réponses et conversations structurées que sur les discussions très fluides.
- Les timestamps des locuteurs dépendent de la disponibilité des segments Whisper. Si `verbose_json` n'est pas accepté et que le fallback `json` est utilisé, la diarisation peut perdre les repères temporels.
- Les presets de prompt sont rédigés en français ; le serveur ajoute une instruction de langue quand une sortie non française est demandée.
- Chart.js et Marked sont chargés depuis CDN dans `src/client/index.html`.
- Les très longs fichiers peuvent consommer beaucoup de mémoire côté navigateur pendant le décodage et la conversion WAV.
- Le projet ne dispose pas encore d'une suite automatisée complète ; la validation release repose sur des checks statiques, le démarrage serveur et des tests fonctionnels manuels avec une clé Cloud Temple.

## Release et validation

La v6.0.0 est documentée dans :

- `VERSION`
- `package.json`
- `package-lock.json`
- `changelog.md`
- `docs/releases/v6.0.0.md`

Commandes de validation recommandées avant publication :

```bash
node --check src/server/server.js
node --check src/client/js/main.js
node --check src/client/js/apiService.js
node --check src/client/js/audioProcessor.js
node --check src/client/js/analysisProcessor.js
node --check src/client/js/download.js
node --check src/client/js/i18n.js
node --check src/client/js/prompts.js
node --check src/client/js/state.js
node --check src/client/js/ui/chart.js
node --check src/client/js/ui/results.js
node --check src/client/js/ui/stats.js
npm audit
npm start
```

Tests manuels recommandés :

- ouverture de `/api/version` et vérification de `6.0.0` ;
- chargement de l'UI en français et en anglais ;
- récupération des modèles depuis Cloud Temple ;
- transcription d'un audio court ;
- synthèse avec chaque preset majeur ;
- synthèse dans une langue différente ;
- diarisation activée sur un audio multi-locuteurs ;
- téléchargement des onglets Transcription, Analyse, Synthèse et Locuteurs.

## Licence

Ce dépôt est distribué sous licence GPL-3.0. Voir `LICENSE.txt`.
