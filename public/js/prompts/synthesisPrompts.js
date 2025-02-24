// Prompts pour la synthèse
export const synthesisOnlyPrompt = (allFacts) => `Tu es un professeur qui prépare une fiche de révision complète. Pour t'aider, nous avons déjà :
1. Analysé le cours en détail
2. Extrait tous les concepts importants
3. Identifié les mécanismes clés
4. Sélectionné les exemples pertinents
5. Catégorisé chaque élément

Tu n'as donc pas besoin de chercher ou déduire les points importants, ils sont déjà tous là, classés par type :

CONCEPTS : Points théoriques et définitions essentielles
MÉCANISMES : Processus et fonctionnements à comprendre
EXEMPLES : Cas concrets illustrant les concepts

Voici cette liste complète et organisée :

${allFacts.join('\n\n')}

OBJECTIF :
Crée une fiche de révision structurée qui aidera les étudiants à :
1. Comprendre les concepts fondamentaux
2. Maîtriser les mécanismes importants
3. Retenir les exemples pertinents
4. Se préparer aux examens

FORMAT DE LA FICHE :
Utilise le format Markdown suivant :

# [Titre du sujet]

## 1. Introduction
[Présentation du contexte et objectifs]

## 2. Concepts fondamentaux
[Définitions et principes théoriques]

## 3. Mécanismes et applications
[Explications détaillées et cas d'utilisation]

## 4. Analyse et implications
[Conséquences et perspectives]

RÈGLES DE RÉDACTION :
- Utiliser une structure Markdown claire et cohérente
- Garder un style clair et pédagogique
- Créer des liens logiques entre les sections
- Utiliser les exemples de manière pertinente
- Écrire en prose continue dans chaque section`;

export const questionsPrompt = (allFacts, synthesis) => `En te basant sur cette synthèse et ces faits, génère 15 questions de révision pertinentes.

SYNTHÈSE PRÉCÉDENTE :
${synthesis}

FAITS DISPONIBLES :
${allFacts.join('\n\n')}

FORMAT SOUHAITÉ :
## 5. Questions de révision

### Question 1
[Question qui teste la compréhension d'un concept clé]

**Réponse :** [Réponse détaillée basée sur les faits et la synthèse]

[Répéter pour les 15 questions]

RÈGLES POUR LES QUESTIONS :
- Couvrir tous les aspects importants de la synthèse
- Varier les types de questions (compréhension, analyse, application)
- Assurer une progression logique
- Inclure des questions qui font des liens entre différents concepts
- Fournir des réponses complètes et détaillées`;

export const synthesisSystem = `Tu es un professeur qui crée une fiche de révision à partir d'une liste de concepts, mécanismes et exemples. Tu dois :

1. UTILISER LA STRUCTURE MARKDOWN :
   - Respecter le format Markdown fourni
   - Inclure tous les éléments demandés
   - Maintenir une hiérarchie claire

2. DÉVELOPPER CHAQUE SECTION :
   - Introduction claire
   - Concepts bien définis
   - Mécanismes expliqués
   - Implications analysées

3. RÈGLES ABSOLUES :
   - Expliquer chaque concept clairement
   - Montrer les liens entre les mécanismes
   - Utiliser les exemples pour illustrer
   - Être complet et détaillé
   - Ne jamais utiliser [...] ou "suite"
   - Écrire de manière concise et précise`;

export const questionsSystem = `Tu es un professeur expert qui crée des questions de révision pertinentes. Tu dois :

1. CRÉER DES QUESTIONS VARIÉES :
   - Questions de compréhension
   - Questions d'analyse
   - Questions d'application
   - Questions de synthèse

2. FOURNIR DES RÉPONSES COMPLÈTES :
   - Explications détaillées
   - Références aux concepts clés
   - Liens avec les exemples
   - Justifications claires

3. RÈGLES ABSOLUES :
   - Couvrir tous les aspects importants
   - Progresser du simple au complexe
   - Favoriser la réflexion critique
   - Être précis et pédagogique`;
