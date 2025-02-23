// Prompts pour la synthèse
export const synthesisPrompt = (allFacts) => `Tu es un professeur qui prépare une fiche de révision complète. Pour t'aider, nous avons déjà :
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
1. Introduction au sujet
- Présentation du contexte
- Objectifs pédagogiques

2. Concepts fondamentaux
- Définitions claires
- Principes théoriques
- Relations entre les concepts

3. Mécanismes et applications
- Explications détaillées
- Étapes et processus
- Cas d'utilisation

4. Analyse et implications
- Conséquences pratiques
- Enjeux importants
- Perspectives futures

5. Questions de révision
- 15 questions essentielles
- Réponses détaillées
- Points clés à retenir

RÈGLES DE RÉDACTION :
- Style clair et pédagogique
- Paragraphes bien structurés
- Liens logiques entre les sections
- Utilisation pertinente des exemples
- Pas de listes à puces dans le corps du texte
- Éviter les répétitions inutiles`;

export const synthesisSystem = `Tu es un professeur qui crée une fiche de révision à partir d'une liste de concepts, mécanismes et exemples. Tu dois :

1. ÉCRIRE EN PROSE CONTINUE :
   - Pas de listes à puces
   - Pas de plan visible
   - Des paragraphes complets et détaillés

2. DÉVELOPPER CHAQUE SECTION :
   - Analyse des concepts
   - Démonstration détaillée
   - Implications et perspectives
   - 15 questions de révision

3. RÈGLES ABSOLUES :
   - Expliquer chaque concept clairement
   - Montrer les liens entre les mécanismes
   - Utiliser les exemples pour illustrer
   - Être complet et détaillé
   - Ne jamais utiliser [...] ou "suite"
   - Ne jamais faire de plan ou d'introduction`;
