# Transkryptor 3.0.0

## Table des matières
- [Transkryptor 3.0.0](#transkryptor-300)
  - [Table des matières](#table-des-matières)
  - [Introduction](#introduction)
  - [Fonctionnalités](#fonctionnalités)
  - [Installation de Node.js](#installation-de-nodejs)
    - [Windows](#windows)
    - [macOS](#macos)
    - [Linux (Ubuntu/Debian)](#linux-ubuntudebian)
    - [Linux (Fedora)](#linux-fedora)
  - [Installation de Transkryptor](#installation-de-transkryptor)
  - [Configuration requise](#configuration-requise)
  - [Configuration](#configuration)
    - [Clés API](#clés-api)
    - [Configuration du serveur](#configuration-du-serveur)
  - [Utilisation](#utilisation)
  - [API](#api)
    - [GET /](#get-)
    - [POST /test-keys](#post-test-keys)
    - [POST /analyze](#post-analyze)
  - [Mises à jour importantes V3](#mises-à-jour-importantes-v3)
  - [Mises à jour importantes V2](#mises-à-jour-importantes-v2)
  - [Architecture technique](#architecture-technique)
    - [Frontend](#frontend)
    - [Backend](#backend)
    - [APIs externes](#apis-externes)
    - [Architecture des fichiers](#architecture-des-fichiers)
  - [Gestion des erreurs et journalisation](#gestion-des-erreurs-et-journalisation)
  - [Considérations de sécurité](#considérations-de-sécurité)
  - [Performances et optimisation](#performances-et-optimisation)
  - [Dépannage](#dépannage)
  - [Contributions et développement](#contributions-et-développement)
  - [Feuille de route](#feuille-de-route)
  - [Licence](#licence)
  - [Crédits](#crédits)

## Introduction

Transkryptor est une application web sophistiquée conçue pour faciliter la transcription de fichiers audio, l'analyse des transcriptions, et la génération de synthèses. En tirant parti des capacités avancées des API OpenAI et Anthropic, Transkryptor offre une solution complète pour le traitement et l'analyse de contenu audio.

## Fonctionnalités

- **Transcription audio**: 
  - Support des fichiers au format M4A
  - Transcription automatique utilisant des modèles de reconnaissance vocale avancés

- **Analyse de transcription**: 
  - Analyse approfondie du contenu transcrit
  - Extraction de concepts clés, de sentiments, et d'autres informations pertinentes

- **Génération de synthèse**: 
  - Création de résumés concis et informatifs basés sur l'analyse

- **Validation des clés API**: 
  - Test des clés API OpenAI et Anthropic pour assurer leur validité

- **Suivi de progression**: 
  - Affichage en temps réel de la progression globale et par lot des opérations

- **Options de téléchargement**: 
  - Possibilité de télécharger les transcriptions, analyses, et synthèses au format texte

## Installation de Node.js

### Windows
1. Téléchargez l'installateur Node.js depuis [nodejs.org](https://nodejs.org/)
2. Lancez l'installateur (.msi) et suivez les instructions
3. Vérifiez l'installation dans PowerShell ou CMD :
```bash
node --version
npm --version
```

### macOS
1. Via Homebrew (recommandé) :
```bash
# Installer Homebrew si nécessaire
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer Node.js
brew install node
```

2. Ou via l'installateur depuis [nodejs.org](https://nodejs.org/)

3. Vérifiez l'installation :
```bash
node --version
npm --version
```

### Linux (Ubuntu/Debian)
```bash
# Ajout du dépôt NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

# Installation de Node.js
sudo apt-get install -y nodejs

# Vérification
node --version
npm --version
```

### Linux (Fedora)
```bash
# Installation de Node.js
sudo dnf install nodejs

# Vérification
node --version
npm --version
```

## Installation de Transkryptor

1. Clonez le dépôt :
```bash
git clone https://github.com/chrlesur/transkryptor.git
cd transkryptor
```

2. Installez les dépendances :
```bash
npm install
```

3. Créez un fichier .env à la racine du projet :
```
PORT=3000
```

4. Lancez l'application :
```bash
node server.js
```

5. Accédez à l'application via : http://localhost:3000

## Configuration requise

- Node.js 18.x ou supérieur
- Navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Connexion Internet stable (pour les API OpenAI et Anthropic)
- 2GB RAM minimum
- Espace disque : 500MB minimum

## Configuration

### Clés API
1. Obtenez une clé API OpenAI sur [https://platform.openai.com](https://platform.openai.com)
2. Obtenez une clé API Anthropic sur [https://www.anthropic.com](https://www.anthropic.com)
3. Entrez ces clés dans l'interface utilisateur de Transkryptor

### Configuration du serveur
Le serveur utilise les variables d'environnement suivantes :
- `PORT`: Le port sur lequel le serveur écoute (par défaut : 3000)

## Utilisation

1. Ouvrez votre navigateur et accédez à `http://localhost:3000`
2. **Configuration des clés API**
   - Entrez vos clés API OpenAI et Anthropic
   - Cliquez sur "Tester les clés API"

3. **Transcription**
   - Sélectionnez un fichier audio M4A
   - Appuyez sur "Transcrire"
   - Suivez la progression

4. **Analyse**
   - Une fois la transcription terminée, cliquez sur "Analyser la transcription"

5. **Synthèse**
   - Après l'analyse, cliquez sur "Synthétiser l'analyse"

6. **Téléchargement**
   - Utilisez les boutons "Télécharger" pour sauvegarder vos résultats

## API

### GET /
Sert la page d'accueil de l'application.

### POST /test-keys
Teste la validité des clés API fournies.

**Payload**:
```json
{
  "openaiKey": "votre-clé-openai",
  "anthropicKey": "votre-clé-anthropic"
}
```

### POST /analyze
Lance l'analyse d'une transcription.

**Payload**:
```json
{
  "prompt": "Votre texte à analyser",
  "apiKey": "votre-clé-anthropic"
}
```

## Mises à jour importantes V3

- Refonte complète du système d'analyse :
  - Traitement par chunks de 500 tokens pour une meilleure précision
  - Parallélisation intelligente préservant l'ordre chronologique
  - Vérification automatique de la qualité du nettoyage
  - Gestion des erreurs avec retries progressifs (20s, 40s, 60s)

- Amélioration du suivi en temps réel :
  - Progression visuelle par LED pour chaque chunk
  - Logs détaillés avec statistiques de tokens
  - Aperçu des 10 premiers mots de chaque chunk
  - Affichage des réductions de tokens en pourcentage

- Nouvelle architecture modulaire :
  ```
  public/js/
  ├── utils/
  │   ├── analysisUtils.js      # Traitement des chunks
  │   ├── progressUtils.js      # Gestion de la progression
  │   └── factExtractor.js      # Extraction des faits
  ├── prompts/
  │   └── synthesisPrompts.js   # Prompts pour Claude
  ├── analysis.js              # Module principal d'analyse
  └── synthesizer.js           # Module de synthèse
  ```

- Améliorations de la qualité :
  - Nettoyage intelligent des répétitions et hésitations
  - Préservation garantie de l'ordre chronologique
  - Validation du ratio de tokens (max 66% de réduction)
  - Détection et correction des anomalies

- Interface utilisateur :
  - Design Google Material modernisé
  - Affichage en temps réel des statistiques
  - Barre de progression globale et par lot
  - Messages d'erreur détaillés et informatifs

## Mises à jour importantes V2

- Interface utilisateur modernisée avec style Google
- Amélioration de l'ergonomie avec layout 50/50
- Intégration de l'API Claude 3.5 Sonnet d'Anthropic en derniere version
- Nouveau système de progression par lots
- Modernisation des prompts d'analyse, ils sont beaucoups plus efficaces.
- Persistances des clefs API

## Architecture technique

### Frontend
- HTML5, CSS3, JavaScript modulaire
- Style Google Material Design
- Architecture en composants

### Backend
- Node.js
- Express.js
- Modules : cors, axios, gpt-3-encoder, path

### APIs externes
- OpenAI Whisper API pour la transcription
- Anthropic API (Claude 3.5 Sonnet) pour l'analyse

### Architecture des fichiers
```
transkryptor/
├── public/
│   ├── css/
│   │   ├── base.css          # Styles de base
│   │   ├── columns.css       # Layout des colonnes
│   │   ├── forms.css         # Styles des formulaires
│   │   └── components.css    # Composants UI (LED, progress...)
│   ├── js/
│   │   ├── utils/
│   │   │   ├── analysisUtils.js     # Traitement des chunks
│   │   │   ├── progressUtils.js     # Gestion de la progression
│   │   │   ├── factExtractor.js     # Extraction des faits
│   │   │   ├── qualityChecker.js    # Vérification qualité
│   │   │   └── downloadHandlers.js   # Gestion des téléchargements
│   │   ├── prompts/
│   │   │   └── synthesisPrompts.js   # Prompts pour Claude
│   │   ├── main.js                  # Point d'entrée
│   │   ├── audio.js                 # Gestion audio
│   │   ├── analysis.js              # Module d'analyse
│   │   ├── synthesizer.js           # Module de synthèse
│   │   ├── config.js                # Configuration
│   │   ├── state.js                 # Gestion d'état
│   │   └── ui.js                    # Interface utilisateur
│   └── index.html
├── server.js
├── package.json
└── .env
```

## Gestion des erreurs et journalisation

Système de logs intégré avec horodatage et niveaux de gravité.
Exemple de log :
```
[2024-03-22 14:30:25] INFO: Test des clés API en cours...
[2024-03-22 14:30:26] SUCCESS: Clés API validées
```

## Considérations de sécurité

- Stockage sécurisé des clés API
- Configuration CORS
- Rate limiting recommandé en production
- Validation des entrées utilisateur

## Performances et optimisation

- Traitement par lots
- Comptage de tokens optimisé
- Mise en cache des ressources statiques

## Dépannage

- Vérifiez que le serveur est en cours d'exécution
- Confirmez l'accès à http://localhost:3000
- Validez les clés API
- Consultez les logs serveur
- Vérifiez la connexion internet

## Contributions et développement

1. Forkez le projet
2. Installez les dépendances de développement :
```bash
npm install --save-dev nodemon eslint prettier
```

3. Lancez en mode développement :
```bash
npm run dev
```

## Feuille de route

- Support multi-formats audio
- Interface React/Vue.js
- Système d'authentification
- Base de données
- Support multilingue
- Optimisation grands fichiers

## Licence

GPL 3.0

## Crédits

Développé par Christophe LESUR
APIs : OpenAI Whisper et Anthropic Claude
