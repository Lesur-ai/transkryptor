import { log } from './utils.js';
import { getConfig } from '../state.js';

// Extraction des faits d'un paragraphe
export async function extractFactsFromParagraph(paragraph, anthropicKey, previousFacts = []) {
    // Prendre les 20 derniers faits pour le contexte
    const recentFacts = previousFacts.slice(-20);
    const contextStr = recentFacts.length > 0 ? `\nCONTEXTE RÉCENT (pour t'aider à comprendre la progression) :\n${recentFacts.join('\n')}` : '';

    const config = getConfig();
    const response = await axios.post(config.apiEndpoints.analyze, {
        apiKey: anthropicKey,
        messages: [{
            role: "user",
            content: `Tu es un professeur qui aide les étudiants à réviser. ANALYSE ce paragraphe et EXTRAIT uniquement les points ESSENTIELS à retenir.${contextStr}

TYPES D'ÉLÉMENTS À EXTRAIRE :
1. CONCEPTS FONDAMENTAUX :
   - Définitions clés
   - Principes théoriques importants
   - Notions centrales à maîtriser

2. MÉCANISMES CRUCIAUX :
   - Processus importants
   - Fonctionnements à comprendre
   - Relations causales essentielles

3. EXEMPLES SIGNIFICATIFS :
   - Cas qui illustrent les principes
   - Applications concrètes importantes
   - Situations démontrant les concepts

FORMAT DE SORTIE :
- Un point par ligne
- Commencer par "CONCEPT:", "MÉCANISME:" ou "EXEMPLE:"
- Être précis et pédagogique
- Garder les termes exacts du cours
- Faire des liens avec le contexte récent quand c'est pertinent

PARAGRAPHE À ANALYSER :
${paragraph}`
        }],
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        temperature: 0.3,
        system: `Tu es un professeur expert qui sait identifier les points vraiment importants d'un cours. Tu dois :
- Extraire UNIQUEMENT ce qui est essentiel à la compréhension
- Ignorer les détails accessoires
- Privilégier ce qui sera évalué
- Aider les étudiants à structurer leur pensée`
    });

    return response.data.content[0].text;
}
