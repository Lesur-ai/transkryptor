import { log } from './utils.js';
import { getConfig } from '../config.js';
import { initializeBatchProgress, updateChunkStatus } from './progressUtils.js';

function divideFactsIntoGroups(facts) {
    if (!facts || facts.length === 0) {
        return [];
    }

    // Filtrer les faits vides
    const validFacts = facts.filter(fact => fact && fact.trim());
    
    if (validFacts.length === 0) {
        return [];
    }

    // Calculer le nombre optimal de groupes
    const maxGroups = 5;
    const minFactsPerGroup = 2;
    const numGroups = Math.min(maxGroups, Math.floor(validFacts.length / minFactsPerGroup));
    
    if (numGroups === 0) {
        return [validFacts]; // Un seul groupe si pas assez de faits
    }

    const factsPerGroup = Math.ceil(validFacts.length / numGroups);
    const groups = [];
    
    for (let i = 0; i < numGroups; i++) {
        const start = i * factsPerGroup;
        const end = Math.min(start + factsPerGroup, validFacts.length);
        const group = validFacts.slice(start, end);
        if (group.length > 0) {
            groups.push(group);
        }
    }
    
    return groups;
}

function formatQuestions(text, startIndex) {
    try {
        // Essayer de parser comme JSON d'abord
        const data = JSON.parse(text);
        return data.questions.map((q, i) => {
            const num = startIndex + i + 1;
            return `### Question ${num}\n\nQuestion : ${q.question}\nRéponse : ${q.reponse}\nApplication : ${q.application}`;
        }).join('\n\n');
    } catch (error) {
        // Si ce n'est pas du JSON valide, vérifier si c'est une réponse d'erreur
        if (text.includes("Je ne vois pas de faits") || text.length < 100) {
            log(`Lot ignoré (pas de faits valides) : ${text}`);
            return '';
        }
        // Sinon retourner le texte formaté en markdown
        log(`Formatage en markdown du texte brut`);
        return text;
    }
}

async function generateQuestionsForGroup(facts, groupIndex, totalGroups, apiKey) {
    const config = getConfig();
    updateChunkStatus(0, groupIndex, 'processing');

    // Vérifier si le groupe contient des faits valides
    if (!facts || facts.length === 0) {
        log(`Lot ${groupIndex + 1} ignoré : pas de faits`);
        updateChunkStatus(0, groupIndex, 'completed');
        return '';
    }
    
    const prompt = `Tu es un expert en pédagogie. En te basant UNIQUEMENT sur ces faits spécifiques :

${facts.join('\n')}

Génère EXACTEMENT 4 questions/réponses/applications pertinentes.

RÈGLES STRICTES :
- Exactement 4 questions, pas plus, pas moins
- Questions concises et précises
- Réponses claires et directes
- Applications pratiques concrètes
- Pas d'introduction ni de conclusion
- Pas de commentaires ou métadonnées

FORMAT DE SORTIE STRICT :
{
  "questions": [
    {
      "question": "[Question concise]",
      "reponse": "[Réponse claire]",
      "application": "[Application pratique]"
    },
    {
      "question": "[Question concise]",
      "reponse": "[Réponse claire]",
      "application": "[Application pratique]"
    },
    {
      "question": "[Question concise]",
      "reponse": "[Réponse claire]",
      "application": "[Application pratique]"
    },
    {
      "question": "[Question concise]",
      "reponse": "[Réponse claire]",
      "application": "[Application pratique]"
    }
  ]
}`;

    try {
        log(`Génération des questions pour le lot ${groupIndex + 1}/${totalGroups} (${facts.length} faits)`);
        
        const response = await axios.post(config.apiEndpoints.analyze, {
            messages: [{
                role: "user",
                content: prompt
            }],
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 8192,
            temperature: 0.3,
            apiKey
        });

        const questions = response.data.content[0].text.trim();
        updateChunkStatus(0, groupIndex, 'completed');
        return questions;
    } catch (error) {
        updateChunkStatus(0, groupIndex, 'error');
        throw error;
    }
}

export async function generateQuestionBatches(facts, apiKey) {
    const factGroups = divideFactsIntoGroups(facts);
    const totalGroups = factGroups.length;
    
    log(`Génération des questions en ${totalGroups} lots de 4 questions...`);
    
    // Initialiser une seule ligne de progression
    initializeBatchProgress(0, totalGroups);
    
    const batches = [];
    for (let i = 0; i < totalGroups; i++) {
        try {
            const questions = await generateQuestionsForGroup(factGroups[i], i, totalGroups, apiKey);
            const formattedQuestions = formatQuestions(questions, i * 4);
            batches.push(formattedQuestions);
        } catch (error) {
            log(`Erreur lors de la génération du lot ${i + 1}: ${error.message}`);
            throw error;
        }
    }
    
    return batches.join('\n\n');
}
