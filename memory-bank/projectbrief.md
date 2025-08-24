# Project Brief: Transkryptor v4.0.0

## 1. Mission du Projet

Faire évoluer Transkryptor vers une plateforme d'analyse et de transcription multi-fournisseurs, sécurisée et moderne. La version 4 doit offrir une flexibilité accrue à l'utilisateur en intégrant la plateforme LLMaaS de Cloud Temple (SecNumCloud) tout en conservant l'accès à OpenAI et Anthropic. L'objectif est de devenir un outil de référence, tant par ses fonctionnalités que par son expérience utilisateur.

## 2. Objectifs Principaux

### 2.1. Intégration Multi-Fournisseurs
- **Intégrer Cloud Temple LLMaaS :** Permettre la transcription audio (Whisper) et l'analyse de texte via l'API de Cloud Temple.
- **Conserver les fournisseurs existants :** Maintenir le support pour OpenAI (transcription) et Anthropic (analyse).
- **Flexibilité pour l'utilisateur :** L'utilisateur doit pouvoir choisir facilement le fournisseur de services (Cloud Temple, OpenAI, Anthropic) et le modèle d'analyse souhaité.

### 2.2. Refonte de l'Architecture Backend
- **Centralisation des Appels API :** Toutes les communications avec les API externes doivent être gérées exclusivement par le backend (serveur Node.js). Le frontend ne communiquera plus qu'avec notre propre serveur.
- **Sécurité :** Les clés API de tous les fournisseurs doivent être stockées et utilisées de manière sécurisée côté serveur, jamais exposées côté client.
- **Modularité :** L'architecture du serveur doit être modulaire pour faciliter l'ajout de nouveaux fournisseurs à l'avenir.

### 2.3. Refonte de l'Interface Utilisateur (UI/UX)
- **Modernisation :** Remplacer l'interface actuelle par un design moderne, épuré, et responsive, en suivant les meilleures pratiques "à l'état de l'art".
- **Expérience Utilisateur (UX) :** Simplifier le parcours utilisateur, de la configuration à l'exportation des résultats. L'interface doit être intuitive et guider l'utilisateur à chaque étape.
- **Feedback Amélioré :** Fournir un retour visuel clair et en temps réel sur la progression des tâches (transcription, analyse, etc.).

## 3. Périmètre Fonctionnel

- **Sélection du Fournisseur :** L'utilisateur peut choisir son fournisseur de services via un menu déroulant.
- **Sélection du Modèle :** La liste des modèles d'analyse se met à jour dynamiquement en fonction du fournisseur sélectionné.
- **Transcription :** L'utilisateur peut soumettre un fichier audio (M4A, MP3, WAV) pour transcription.
- **Analyse :** L'utilisateur peut lancer une analyse sur le texte transcrit.
- **Synthèse :** L'utilisateur peut générer une synthèse à partir de l'analyse.
- **Gestion des Clés :** L'utilisateur peut toujours fournir ses propres clés OpenAI et Anthropic, mais une clé par défaut sera utilisée pour Cloud Temple.
- **Exportation :** L'utilisateur peut télécharger les résultats (transcription, analyse, synthèse).

## 4. Contraintes Techniques
- **Code Propre et Documenté :** Le code doit être clair, commenté et suivre des conventions de style.
- **Modularité :** Les fichiers ne doivent pas dépasser 500 lignes pour garantir la lisibilité et la maintenabilité.
- **Backend :** Node.js / Express.js.
- **Frontend :** HTML5, CSS3, JavaScript Vanilla (structuré de manière modulaire).
