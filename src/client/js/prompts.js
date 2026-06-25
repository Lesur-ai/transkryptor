/**
 * @file prompts.js
 * @description Presets de prompts de synthèse pour Transkryptor.
 * Cinq presets prédéfinis + un mode "custom" géré dans l'UI.
 * Transkryptor v5.3 — Cloud Temple SecNumCloud uniquement.
 */

const executive = `
À partir de l'analyse fournie ci-dessous, rédige une synthèse exécutive claire, concise et professionnelle. La synthèse doit être structurée pour une compréhension rapide et une prise de décision efficace.

**Format attendu :**

**1. Résumé Exécutif :**
   - Un paragraphe de 3 à 5 phrases maximum qui résume l'essentiel de l'analyse. Quelle est l'information la plus critique à retenir ?

**2. Points Clés :**
   - Une liste à puces (3 à 5 points) qui met en évidence les découvertes, conclusions ou thèmes les plus importants de l'analyse. Chaque point doit être une phrase courte et percutante.

**3. Actions Recommandées / Prochaines Étapes :**
   - Une liste à puces (2 à 3 points) de suggestions concrètes ou de questions à explorer basées sur l'analyse. Que devrait-on faire avec cette information ?

---
**Analyse à synthétiser :**
`;

const meeting = `
À partir du texte fourni ci-dessous, rédige un compte-rendu de réunion structuré, factuel et exploitable. Le compte-rendu doit pouvoir être diffusé aux participants sans relecture supplémentaire.

**Format attendu :**

**1. Contexte de la réunion :**
   - Objet principal de la réunion (1 à 2 phrases).
   - Participants identifiables s'ils apparaissent dans le texte (sinon, omettre).

**2. Ordre du jour traité :**
   - Liste à puces des sujets effectivement abordés, dans leur ordre d'apparition.

**3. Échanges et points discutés :**
   - Pour chaque sujet : un court paragraphe rappelant les positions, arguments et éléments factuels échangés.
   - Conserver les chiffres, dates, noms propres et références mentionnés.

**4. Décisions prises :**
   - Liste à puces des décisions actées pendant la réunion. Mentionner le décideur si identifiable.

**5. Actions et responsables :**
   - Liste à puces au format : "Action — Responsable — Échéance (si mentionnée)".
   - Ne pas inventer de responsable ou d'échéance s'ils ne figurent pas dans le texte.

**6. Points en suspens :**
   - Liste à puces des sujets reportés, à clarifier ou nécessitant une décision ultérieure.

Ton neutre et professionnel. Ne pas commenter, ne pas interpréter au-delà du texte.

---
**Texte à synthétiser :**
`;

const actions = `
À partir du texte fourni ci-dessous, extrais et organise uniquement les actions, décisions et engagements opérationnels mentionnés. L'objectif est de produire une feuille de route exploitable immédiatement.

**Format attendu :**

**1. Décisions actées :**
   - Liste à puces. Une décision = une ligne. Format : "Décision — Contexte bref (si nécessaire)".
   - N'inclure que des décisions explicitement prises, pas des intentions ou hypothèses.

**2. Actions à mener :**
   - Liste à puces au format : "[Priorité] Action — Responsable — Échéance".
   - Priorité : Haute / Moyenne / Basse (estimée d'après l'urgence ou l'insistance dans le texte).
   - Responsable et échéance uniquement s'ils sont mentionnés ; sinon, indiquer "Non précisé".

**3. Engagements pris par les locuteurs :**
   - Liste à puces des promesses ou engagements personnels exprimés ("je vais faire X", "nous nous engageons à Y").

**4. Points bloquants identifiés :**
   - Liste à puces des obstacles, dépendances ou prérequis évoqués qui pourraient retarder les actions.

**5. Questions ouvertes nécessitant une réponse :**
   - Liste à puces des questions posées qui n'ont pas reçu de réponse claire dans le texte.

Ne pas inclure de résumé général, ni d'analyse de fond. Ne pas inventer d'élément absent du texte.

---
**Texte à analyser :**
`;

const verbatim = `
À partir du texte fourni ci-dessous, produis un verbatim corrigé. L'objectif est de restituer fidèlement le contenu en améliorant uniquement la lisibilité, sans transformation rédactionnelle.

**Règles strictes :**

- Conserver l'ordre du discours, les enchaînements et la progression des idées.
- Conserver les expressions personnelles, le niveau de langue et les tournures propres aux locuteurs.
- Supprimer uniquement : marqueurs d'hésitation ("euh", "ben", "hum"), faux départs, répétitions involontaires.
- Corriger les fautes manifestes de grammaire et d'orthographe sans réécrire les phrases.
- Ajuster la ponctuation pour faciliter la lecture (paragraphes, virgules, points).
- Conserver tous les chiffres, dates, noms propres, citations et exemples sans modification.
- Ne pas résumer, ne pas reformuler, ne pas synthétiser.
- Ne pas commenter ni introduire d'analyse.

**Format attendu :**

- Texte en paragraphes cohérents, séparés par des sauts de ligne.
- Si plusieurs locuteurs sont identifiables, conserver leur attribution si elle figure déjà dans le texte source.
- Aucune introduction, aucun titre, aucune conclusion : uniquement le verbatim corrigé.

---
**Texte à corriger :**
`;

const thematic = `
À partir du texte fourni ci-dessous, produis une analyse thématique structurée. L'objectif est de dégager les grands axes de contenu et de les organiser de manière analytique.

**Format attendu :**

**1. Vue d'ensemble :**
   - Un paragraphe court (3 à 4 phrases) présentant la nature du contenu et les principaux thèmes identifiés.

**2. Thèmes principaux :**
   - Pour chaque thème majeur identifié (entre 3 et 6 thèmes selon la richesse du texte) :
     - **Titre du thème** (formulation synthétique).
     - **Description** : 2 à 4 phrases expliquant ce que recouvre ce thème dans le texte.
     - **Éléments saillants** : liste à puces des points concrets, exemples, chiffres ou citations qui illustrent ce thème.
     - **Tonalité ou angle** : une phrase indiquant comment le sujet est abordé (factuel, critique, prospectif, etc.).

**3. Thèmes secondaires :**
   - Liste à puces des thèmes mineurs ou évoqués brièvement, avec une phrase de description pour chacun.

**4. Liens et tensions entre thèmes :**
   - Court paragraphe (2 à 4 phrases) qui met en évidence les articulations, complémentarités ou contradictions entre les thèmes principaux.

**5. Éléments transversaux :**
   - Liste à puces des notions, références ou personnes qui apparaissent dans plusieurs thèmes.

Ton neutre et analytique. Conserver la fidélité au texte source : ne pas extrapoler au-delà de ce qui est exprimé.

---
**Texte à analyser :**
`;

export const SYNTHESIS_PROMPTS = {
    executive,
    meeting,
    actions,
    verbatim,
    thematic,
};

export const DEFAULT_PRESET = 'executive';

export const PRESET_IDS = ['executive', 'meeting', 'actions', 'verbatim', 'thematic', 'custom'];

export function getPresetPrompt(presetId) {
    if (presetId === 'custom') return '';
    return SYNTHESIS_PROMPTS[presetId] || SYNTHESIS_PROMPTS[DEFAULT_PRESET];
}
