export function formatMarkdownQuestions(markdown) {
    // Diviser en blocs de questions
    const blocks = markdown.split(/(?=### Question \d+)/);
    
    return blocks.map(block => {
        if (!block.trim()) return '';
        
        // Extraire les parties
        const lines = block.split('\n').filter(line => line.trim());
        const questionMatch = lines[0].match(/### Question (\d+)/);
        if (!questionMatch) return block; // Retourner le bloc tel quel si pas de numéro
        
        const questionNum = questionMatch[1];
        let question = '', reponse = '', application = '';
        
        lines.forEach(line => {
            if (line.startsWith('Question :')) {
                question = line.replace('Question :', '').trim();
            } else if (line.startsWith('Réponse :')) {
                reponse = line.replace('Réponse :', '').trim();
            } else if (line.startsWith('Application :')) {
                application = line.replace('Application :', '').trim();
            }
        });
        
        // Construire le HTML avec les classes CSS
        return `<div class="question-block">
  <h3>Question ${questionNum}</h3>
  <div class="question">${question}</div>
  <div class="reponse">${reponse}</div>
  <div class="application">${application}</div>
</div>`;
    }).join('\n\n');
}
