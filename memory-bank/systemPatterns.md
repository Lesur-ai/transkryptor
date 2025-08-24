# System Patterns: Transkryptor v4.0.0

## 1. Architecture Générale

L'architecture de Transkryptor v4 repose sur une séparation claire entre le **frontend** (client) et le **backend** (serveur), où le backend agit comme une **passerelle (Gateway)** centralisée et sécurisée vers les services externes.

```mermaid
graph TD
    A[Utilisateur] -->|Navigateur| B(Frontend);
    B -->|Requêtes API| C{Backend (Serveur Node.js)};
    C -->|Appel API Externe| D[API Cloud Temple];
    C -->|Appel API Externe| E[API OpenAI];
    C -->|Appel API Externe| F[API Anthropic];
```

## 2. Modèle de Conception du Backend : API Gateway

Le backend implémentera le modèle de conception **API Gateway**. Son rôle n'est pas de contenir une logique métier complexe, mais de :
1.  **Recevoir** toutes les requêtes du frontend.
2.  **Authentifier** et **valider** ces requêtes.
3.  **Router** la requête vers le bon fournisseur de services externe (Cloud Temple, OpenAI, etc.) en se basant sur les paramètres fournis par le client.
4.  **Adapter** la requête au format attendu par l'API externe (ex: ajouter la clé API, formater le corps de la requête).
5.  **Retourner** la réponse de l'API externe au frontend.

### Endpoints Stratégiques
-   `/api/providers` : Endpoint de configuration qui fournit au frontend la liste des fournisseurs disponibles.
-   `/api/models` : Endpoint dynamique qui interroge le fournisseur sélectionné pour obtenir la liste de ses modèles.
-   `/api/transcribe` : Endpoint unique pour toutes les demandes de transcription. Le corps de la requête spécifiera le fournisseur (`provider: 'cloud-temple'`).
-   `/api/analyze` : Endpoint unique pour toutes les demandes d'analyse. Le corps de la requête spécifiera le fournisseur et le modèle (`provider: 'anthropic'`, `model: 'claude-3-5-sonnet...'`).

## 3. Modèle de Conception du Frontend : Modularité et Gestion d'État Côté Client

Le frontend sera développé en JavaScript "vanilla" mais suivra des principes d'architecture modernes :

### 3.1. Découpage en Modules
Le code sera organisé par fonctionnalité (feature-based) pour une meilleure séparation des préoccupations :
-   `apiService.js` : Un module unique responsable de toute la communication avec notre backend. Il exposera des fonctions simples (ex: `transcribe(file, provider)`, `analyze(text, provider, model)`).
-   `ui/` (dossier) : Un ensemble de modules responsables de la mise à jour du DOM (ex: `ui/progress.js`, `ui/results.js`).
-   `state.js` : Un module pour gérer l'état global de l'application (fournisseur sélectionné, modèle sélectionné, état de la progression, etc.).
-   `main.js` : Le point d'entrée qui orchestre les différents modules.

### 3.2. Flux de Données Unidirectionnel (Inspiré de Redux/Vuex)
Pour éviter la complexité, le flux de données suivra un cycle simple :
1.  **Action Utilisateur** (ex: clic sur "Transcrire") déclenche un appel dans un module UI.
2.  Le module UI appelle une fonction du **`apiService.js`**.
3.  Le **`apiService.js`** envoie la requête au backend.
4.  À la réception de la réponse, le **`apiService.js`** met à jour l'état via le module **`state.js`**.
5.  La mise à jour de l'état déclenche une mise à jour de l'interface via les **modules UI**.

Ce modèle garantit que l'état de l'application reste prévisible et facile à déboguer.
