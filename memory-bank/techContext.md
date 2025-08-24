# Technical Context: Transkryptor v4.0.0

## 1. Technologies Utilisées

### 1.1. Backend
- **Langage :** Node.js
- **Framework :** Express.js
- **Dépendances Clés :**
    - `axios` : Pour effectuer les appels HTTP vers les API externes (Cloud Temple, OpenAI, Anthropic).
    - `cors` : Pour gérer les autorisations Cross-Origin Resource Sharing.
    - `dotenv` : Pour gérer les variables d'environnement et sécuriser les clés API.
    - `multer` : Pour gérer les uploads de fichiers (`multipart/form-data`), notamment pour l'envoi des fichiers audio à l'API de transcription.
    - `gpt-3-encoder` : Pour le comptage de tokens, si nécessaire.

### 1.2. Frontend
- **Langages :** HTML5, CSS3, JavaScript (ES6 Modules)
- **Framework :** Aucun. Nous utiliserons du JavaScript "vanilla" (pur) structuré en modules pour garder le projet léger et performant.
- **Librairies :**
    - `axios` (ou `fetch` natif) : Pour la communication avec notre propre backend.

### 1.3. APIs Externes
- **Cloud Temple LLMaaS :**
    - **Endpoint :** `https://api.ai.cloud-temple.com`
    - **Services :** Transcription (`/v1/audio/transcriptions`), Analyse (`/v1/chat/completions`), Lister les modèles (`/v1/models`).
- **OpenAI :**
    - **Services :** Transcription (Whisper).
- **Anthropic :**
    - **Services :** Analyse (Claude).

## 2. Configuration de Développement
- **Gestionnaire de Paquets :** `npm`
- **Serveur de Développement :** `nodemon` pour le redémarrage automatique du serveur lors des modifications.
- **Qualité de Code :**
    - `eslint` : Pour l'analyse statique du code et le respect des conventions.
    - `prettier` : Pour le formatage automatique du code.

## 3. Contraintes Techniques
- **Sécurité des Clés API :** Toutes les clés API doivent être stockées dans un fichier `.env` à la racine du projet et ne jamais être exposées côté client. Le fichier `.gitignore` doit inclure `.env`.
- **Modularité :** Le code, tant frontend que backend, doit être découpé en modules avec des responsabilités uniques. La limite de 500 lignes par fichier doit être respectée.
- **Performance :** Le frontend doit rester léger. Éviter les librairies lourdes non essentielles. Les appels API doivent être asynchrones et non bloquants.
- **Compatibilité Navigateur :** L'application doit être compatible avec les dernières versions des navigateurs modernes (Chrome, Firefox, Safari, Edge).
