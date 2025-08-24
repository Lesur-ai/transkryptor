# Product Context: Transkryptor v4.0.0

## 1. Problème à Résoudre

La version précédente de Transkryptor (v3) a validé le besoin d'un outil simple pour la transcription et l'analyse de contenu audio. Cependant, elle présente plusieurs limitations qui freinent son adoption et son évolution :

1.  **Dépendance à des Fournisseurs Spécifiques :** L'application est étroitement liée aux API d'OpenAI et d'Anthropic, ce qui limite le choix de l'utilisateur et pose des questions de souveraineté des données pour certains cas d'usage (ex: données sensibles).
2.  **Architecture Rigide :** La logique métier est partiellement éclatée entre le frontend et le backend, rendant l'ajout de nouveaux fournisseurs complexe et posant des risques de sécurité (exposition potentielle de clés API).
3.  **Expérience Utilisateur Datée :** L'interface n'est pas optimisée, manque de modernité et n'est pas entièrement intuitive, ce qui peut dégrader l'expérience et la confiance de l'utilisateur.
4.  **Manque de Flexibilité :** L'utilisateur ne peut pas choisir son modèle d'analyse, ce qui limite la pertinence des résultats en fonction du contexte (ex: analyse juridique vs. analyse marketing).

## 2. Solution Proposée : Transkryptor v4

La version 4 vise à transformer Transkryptor en une **plateforme agnostique et moderne**.

### 2.1. Comment ça doit fonctionner ?

L'utilisateur doit vivre une expérience fluide et transparente :

1.  **Configuration Initiale :** L'utilisateur arrive sur une interface épurée. Il peut choisir immédiatement son fournisseur de services (Cloud Temple, OpenAI, Anthropic). S'il choisit Cloud Temple, une clé par défaut est utilisée. Pour les autres, il peut renseigner sa propre clé.
2.  **Sélection du Modèle :** En fonction du fournisseur, une liste de modèles d'analyse pertinents lui est proposée.
3.  **Processus de Traitement :** L'utilisateur soumet son fichier audio. Une barre de progression claire et des indicateurs visuels lui montrent en temps réel où en est le processus (téléchargement, transcription, analyse).
4.  **Consultation des Résultats :** Les résultats (transcription, analyse, synthèse) sont présentés de manière claire et distincte.
5.  **Exportation :** L'utilisateur peut télécharger l'ensemble des résultats en un clic.

### 2.2. Expérience Utilisateur Cible

-   **Simplicité :** "Moins, c'est plus". L'interface doit être minimaliste et ne présenter que les informations et actions nécessaires à chaque étape.
-   **Confiance :** L'utilisateur doit se sentir en contrôle. Le choix du fournisseur, la gestion transparente des clés et le feedback en temps réel sont essentiels pour bâtir cette confiance.
-   **Professionnalisme :** Le design doit être moderne et "corporate-ready", inspirant la fiabilité et la robustesse.
-   **Rapidité :** L'interface doit être réactive et le traitement backend optimisé pour réduire l'attente.
