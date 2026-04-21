# Utiliser une image Node.js officielle comme base
FROM node:20-slim

# Créer le répertoire de l'application
WORKDIR /usr/src/app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances de l'application
# Utiliser les variables de proxy si elles sont fournies
ARG HTTP_PROXY
ARG HTTPS_PROXY
RUN if [ -n "$HTTP_PROXY" ]; then npm config set proxy "$HTTP_PROXY"; fi
RUN if [ -n "$HTTPS_PROXY" ]; then npm config set https-proxy "$HTTPS_PROXY"; fi
RUN npm install

# Copier le reste du code de l'application
COPY . .

# Créer le répertoire pour les uploads et s'assurer que l'utilisateur node en est propriétaire
RUN mkdir -p /usr/src/app/src/server/uploads && chown -R node:node /usr/src/app/src/server/uploads

# L'utilisateur 'node' est fourni par l'image de base, l'utiliser est une bonne pratique
USER node

# Exposer le port sur lequel l'application s'exécute
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["node", "src/server/server.js"]
