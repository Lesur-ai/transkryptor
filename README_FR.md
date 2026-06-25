# Transkryptor

> 🇬🇧 [Read in English](./README.md)

![Capture d'écran](images/screenshoot.png)

Plateforme web moderne de transcription, d'analyse et de synthèse audio — construite sur l'API [Cloud Temple LLMaaS](https://www.cloud-temple.com/) qualifiée SecNumCloud.

## Table des matières

- [Points forts](#points-forts)
- [Architecture](#architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Structure du projet](#structure-du-projet)
- [Feuille de route](#feuille-de-route)
- [Licence](#licence)

## Points forts

- **Transcription audio parallélisée** à l'échelle. Les fichiers sont découpés, transcrits en parallèle via Whisper, puis réassemblés. Gère mono/stéréo et les formats courants (MP3, WAV, M4A).
- **Analyse & synthèse**. Le texte transcrit est segmenté en lots sémantiques, analysé en parallèle par un LLM configurable, puis synthétisé sous forme de rapport structuré.
- **Cinq presets de synthèse** prêts à l'emploi — synthèse exécutive, compte-rendu de réunion, actions et décisions, verbatim corrigé, analyse thématique — plus un mode prompt entièrement personnalisé.
- **Diarization** (détection des locuteurs basée LLM). Identifie les tours de parole à partir du texte transcrit, avec indication facultative du nombre de locuteurs, en streaming temps réel.
- **Interface multilingue** : UI en français et en anglais ; plus de 15 langues audio supportées avec auto-détection, et une langue de synthèse indépendante.
- **Observabilité en temps réel** : grille de progression par morceau, graphique de performance, logs serveur en direct via SSE.
- **Backend Cloud Temple LLMaaS** : tous les appels passent par l'API souveraine Cloud Temple qualifiée SecNumCloud. Aucun fournisseur LLM tiers dans le flux de données.
- **Passerelle API sécurisée** : la clé API vit côté serveur dans les variables d'environnement et n'est jamais exposée au navigateur.

## Architecture

Un backend Node.js/Express joue le rôle de passerelle API vers les endpoints Cloud Temple LLMaaS (transcription, chat completions, diarization). Le frontend est une application monopage en JavaScript vanilla servie par le même process Node — pas de bundler, pas de framework.

```
navigateur ──► passerelle Node.js/Express ──► Cloud Temple LLMaaS (Whisper + LLM)
```

## Démarrage rapide

**Prérequis** : [Node.js](https://nodejs.org/) 18 ou supérieur, et une clé API Cloud Temple LLMaaS.

```bash
git clone https://github.com/chrlesur/transkryptor.git
cd transkryptor
npm install
cp .env.example .env
# Éditez .env — renseignez CLOUD_TEMPLE_API_KEY et CLOUD_TEMPLE_ALLOWED_MODELS
npm start
```

Puis ouvrez <http://localhost:3000>.

Pour le développement avec rechargement automatique :

```bash
npm run dev
```

### Docker

```bash
docker compose up --build
```

## Configuration

Toute la configuration vit dans un fichier `.env` à la racine du projet. Copiez `.env.example` et renseignez vos valeurs.

| Variable | Requise | Rôle |
| --- | --- | --- |
| `PORT` | non (défaut `3000`) | Port d'écoute du serveur. |
| `CLOUD_TEMPLE_API_KEY` | **oui** | Token d'accès à l'API Cloud Temple LLMaaS. |
| `CLOUD_TEMPLE_ALLOWED_MODELS` | **oui** | Liste de modèles, séparés par des virgules, exposés dans l'UI. L'ordre est aussi l'ordre d'affichage, et le premier élément est le modèle sélectionné par défaut. |

## Utilisation

1. Choisissez un modèle d'analyse dans la liste déroulante de la sidebar.
2. Déposez ou sélectionnez un fichier audio (`.mp3`, `.wav`, `.m4a`).
3. Optionnel — choisissez une langue audio (ou laissez l'auto-détection) et une langue cible pour la synthèse.
4. Optionnel — activez la détection des participants si l'audio contient plusieurs locuteurs.
5. Cliquez sur **Lancer le Traitement**. La grille de progression par morceau, les statistiques de vitesse et le graphique de performance s'animent au fil du traitement.
6. Une fois l'analyse terminée, **Synthèse** devient disponible. Choisissez un preset (ou personnalisez le prompt dans *Prompts avancés*) et lancez-la.
7. Utilisez **Télécharger** pour sauvegarder le contenu de l'onglet actif au format Markdown.

## Structure du projet

```
transkryptor/
├── src/
│   ├── client/
│   │   ├── css/
│   │   ├── i18n/             # Traductions FR/EN de l'UI
│   │   ├── img/
│   │   ├── js/
│   │   │   ├── ui/           # Modules UI (stats, chart, progress, results)
│   │   │   ├── analysisProcessor.js
│   │   │   ├── apiService.js
│   │   │   ├── audioProcessor.js
│   │   │   ├── main.js
│   │   │   └── …
│   │   └── index.html
│   └── server/
│       ├── logger.js
│       └── server.js
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

## Feuille de route

- Plus de formats audio/vidéo.
- Authentification utilisateur au niveau projet.
- Stockage persistant des sessions et transcriptions.

## Licence

GPL 3.0 — voir [LICENSE.txt](LICENSE.txt).

---

Conçu avec ❤️ par [lesur.ai](https://lesur.ai).
