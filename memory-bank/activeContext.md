# Active Context: Transkryptor v4.0.0

## 1. Focus Actuel

Le développement initial de la version 4 est terminé. Le focus est maintenant sur la finalisation de la session de travail :
- Mise à jour de la documentation ("Memory Bank").
- Création d'une branche Git `v4` pour versionner le travail accompli.
- Commit de l'ensemble des modifications.

## 2. Prochaines Étapes Immédiates

1.  **Mettre à jour `progress.md`** pour refléter l'état final du projet.
2.  **Créer la branche `v4`** avec `git checkout -b v4`.
3.  **Ajouter tous les fichiers modifiés** avec `git add .`.
4.  **Créer le commit initial** pour la v4.

## 3. Décisions Récentes et Apprentissages Clés

-   **Bug de Transcription Résolu :** Le bug persistant `Error parsing multipart/form-data` a été résolu en implémentant le **rééchantillonnage de l'audio à 24kHz** côté client. Cela réduit la taille des chunks audio et évite de dépasser une limite de taille interne dans la librairie `form-data` utilisée par le serveur proxy.
-   **Logique de Découpage V3 :** La résolution du bug "offset is out of bounds" a nécessité de revenir à la logique de copie manuelle des données audio de la V3, qui s'est avérée plus robuste que l'utilisation de `subarray` avec des indices calculés.
-   **Gestion des Erreurs et Retries :** Une logique de tentatives multiples (5 retries avec délai croissant) a été implémentée côté client. L'interface utilisateur reflète maintenant visuellement les états "en attente", "en cours", "en attente de nouvelle tentative" (orange) et "erreur" (rouge).
-   **Traitement par Lots :** La logique de traitement a été finalisée pour traiter les lots séquentiellement, tout en traitant les chunks à l'intérieur de chaque lot en parallèle, conformément à la logique de la V3.
-   **Importance des Logs :** Le débogage a été grandement facilité par l'ajout de logs détaillés côté serveur et côté client, ainsi que par la diffusion en temps réel des logs serveur vers l'interface.
