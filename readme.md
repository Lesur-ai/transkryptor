# Transkryptor v4.0.0

![Screenshot](images/screenshoot.png)

## Table des matières
- [Transkryptor v4.0.0](#transkryptor-v400)
  - [Table des matières](#table-des-matières)
  - [Introduction](#introduction)
  - [Fonctionnalités Clés](#fonctionnalités-clés)
  - [Architecture](#architecture)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Utilisation](#utilisation)
  - [Structure des Fichiers](#structure-des-fichiers)
  - [Feuille de route](#feuille-de-route)
  - [Licence](#licence)

## Introduction

Transkryptor v4 est une refonte complète de l'application, la transformant en une plateforme moderne, sécurisée et multi-fournisseurs pour la transcription, l'analyse et la synthèse de contenu audio. L'objectif principal de cette version est d'offrir une flexibilité maximale à l'utilisateur tout en garantissant une expérience utilisateur intuitive et réactive.

L'application intègre désormais la plateforme LLMaaS de Cloud Temple (qualifiée SecNumCloud) aux côtés des fournisseurs historiques OpenAI et Anthropic.

## Fonctionnalités Clés

- **Multi-Fournisseurs** : Choisissez entre l'écosystème Cloud Temple (transcription et analyse) ou la combinaison OpenAI (transcription) + Anthropic (analyse).
- **Interface Moderne** : Une interface utilisateur entièrement repensée, épurée, et "responsive".
- **Backend Sécurisé** : Toutes les clés API et les appels externes sont gérés par un serveur backend Node.js, agissant comme une passerelle sécurisée. Aucune clé n'est exposée côté client.
- **Suivi en Temps Réel** : Visualisez la progression du traitement en temps réel avec une grille de statut pour chaque morceau de fichier, des statistiques détaillées (vitesse, temps écoulé, etc.) et les logs du serveur.
- **Transcription par Morceaux** : Les fichiers audio sont découpés, transcrits en parallèle et réassemblés, avec une gestion robuste des erreurs et des tentatives multiples.
- **Analyse Intelligente** : Le texte transcrit est découpé en lots cohérents et analysé en parallèle.
- **Synthèse Exécutive** : Générez une synthèse structurée (résumé, points clés, actions) à partir de l'analyse en un clic.
- **Persistance des Clés** : Les clés API pour OpenAI et Anthropic sont sauvegardées localement dans votre navigateur pour ne pas avoir à les ressaisir.
- **Validation des Clés** : Les clés API sont testées avant de lancer un traitement coûteux.

## Architecture

La v4 adopte une architecture client-serveur claire :
- **Frontend** : Une application monopage (SPA) en JavaScript "vanilla" (pur) et modulaire. Elle gère l'interface utilisateur et communique uniquement avec son propre backend.
- **Backend** : Un serveur Node.js/Express qui sert de passerelle API (`API Gateway`). Il reçoit les requêtes du frontend, les enrichit avec les clés API stockées de manière sécurisée, et les relaie vers les fournisseurs externes appropriés (Cloud Temple, OpenAI, Anthropic).

## Installation

1.  **Prérequis** : Assurez-vous d'avoir [Node.js](https://nodejs.org/) (version 18.x ou supérieure) installé.

2.  **Cloner le dépôt** :
    ```bash
    git clone https://github.com/chrlesur/transkryptor.git
    cd transkryptor
    ```

3.  **Installer les dépendances** :
    ```bash
    npm install
    ```

4.  **Lancer l'application** :
    ```bash
    npm start
    ```

5.  Ouvrez votre navigateur et accédez à `http://localhost:3000`.

## Configuration

1.  **Créer un fichier `.env`** à la racine du projet en copiant le modèle `.env.example`.
2.  **Renseigner les clés API** dans ce fichier `.env` :
    -   `CLOUD_TEMPLE_API_KEY` : Votre clé pour l'API Cloud Temple (utilisée par défaut pour cet écosystème).
    -   `OPENAI_API_KEY` (Optionnel) : Une clé par défaut si vous ne souhaitez pas que les utilisateurs fournissent la leur.
    -   `ANTHROPIC_API_KEY` (Optionnel) : Idem pour Anthropic.

## Utilisation

1.  **Choisissez votre écosystème** : "Cloud Temple" ou "OpenAI + Anthropic".
2.  **Configurez** :
    -   Pour Cloud Temple, sélectionnez le modèle d'analyse souhaité.
    -   Pour OpenAI/Anthropic, entrez vos clés API personnelles (elles seront sauvegardées dans votre navigateur).
3.  **Sélectionnez un fichier audio** (.mp3, .wav, .m4a).
4.  **Cliquez sur "Lancer le Traitement"**.
5.  **Suivez la progression** en temps réel. Les résultats de la transcription et de l'analyse apparaîtront au fur et à mesure.
6.  Une fois l'analyse terminée, le bouton **"Lancer la Synthèse"** devient actif. Vous pouvez, si vous le souhaitez, changer de modèle avant de lancer la synthèse.
7.  **Téléchargez** vos résultats à tout moment.

## Structure des Fichiers

Le projet est maintenant organisé dans un dossier `src/` avec une séparation claire entre le client et le serveur.

```
transkryptor/
├── src/
│   ├── client/
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── ui/         # Modules de gestion de l'interface
│   │   │   ├── analysisProcessor.js
│   │   │   ├── apiService.js
│   │   │   ├── audioProcessor.js
│   │   │   ├── main.js     # Point d'entrée principal
│   │   │   └── ...
│   │   └── index.html
│   └── server/
│       ├── logger.js
│       └── server.js       # Serveur Express
├── .env
├── package.json
└── readme.md
```

## Feuille de route

-   Ajout de nouveaux fournisseurs de services.
-   Mise en place d'un système d'authentification utilisateur pour gérer les projets.
-   Support de plus de formats audio/vidéo.

## Licence

GPL 3.0
