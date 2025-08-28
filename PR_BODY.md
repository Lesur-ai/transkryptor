Cette Pull Request intègre plusieurs correctifs critiques pour améliorer la stabilité, la performance et la sécurité de l'application `Transkryptor`, en se basant sur les leçons apprises lors des déploiements précédents.

### Problèmes Corrigés

1.  **Crash Serveur (OOM Killer) :**
    *   **Cause :** Le stockage des fichiers audio uploadés en mémoire (`multer.memoryStorage`) provoquait des crashs sur les fichiers volumineux.
    *   **Solution :** Remplacement par `multer.diskStorage` pour stocker les fichiers temporairement sur le disque, évitant ainsi la saturation de la mémoire.

2.  **Gel du Navigateur :**
    *   **Cause :** Une boucle de traitement synchrone et inefficace dans la fonction `audioBufferToWav` bloquait le thread principal du navigateur.
    *   **Solution :** La fonction a été rendue asynchrone et son algorithme a été optimisé pour traiter les données par blocs, tout en cédant régulièrement le contrôle au navigateur via `requestAnimationFrame`.

3.  **Échec de Transcription des Fichiers Stéréo :**
    *   **Cause :** L'API de transcription externe n'accepte que les flux audio en mono. L'application ne convertissait pas les fichiers stéréo, provoquant des erreurs `400 Bad Request`.
    *   **Solution :** La logique de traitement audio a été modifiée pour forcer la conversion de tous les fichiers en **mono (1 canal)** avant de les envoyer à l'API.

4.  **Fuite d'Informations Sensibles :**
    *   **Cause :** Des logs de débogage dans la console du navigateur affichaient l'état complet de l'application, y compris les clés API.
    *   **Solution :** Les logs ont été nettoyés pour supprimer ou masquer toutes les informations sensibles.

### Améliorations

*   **Robustesse Accrue :** L'application est maintenant capable de gérer une plus grande variété de formats de fichiers audio et est plus résiliente aux erreurs.
*   **Performance Améliorée :** L'optimisation du traitement audio réduit la charge sur le navigateur.
*   **Sécurité Renforcée :** Plus aucune information sensible n'est exposée côté client.
*   **Documentation Mise à Jour :** Les fichiers `readme.md` et `README_EN.md` ont été mis à jour pour refléter la nouvelle version et les améliorations.

Cette PR contribue à rendre `Transkryptor` plus stable et plus professionnel.
