const fs = require('fs');
const filePath = 'src/structural/query/QueryProcessor.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = `    // Multi-token compound formation for adjacent prefix + word (e.g. 'non' + 'negative' -> 'nonnegative')
    for (let i = 0; i < terms.length - 1; i++) {
      const t1 = terms[i];
      const t2 = terms[i + 1];
      if (COMPOUND_PREFIXES.includes(t1) && t2.length >= 4 && !NON_COMPOUND_WORDS.has(t2)) {
        const compound = t1 + t2;
        if (!terms.includes(compound)) {
          terms.push(compound);
        }
      }
    }`;

const replacement = `    // Multi-token compound formation for adjacent prefix + word in sequential query token stream (e.g. 'non' + 'negative' -> 'nonnegative')
    for (let i = 0; i < allTokens.length - 1; i++) {
      const t1 = allTokens[i];
      const t2 = allTokens[i + 1];
      if (COMPOUND_PREFIXES.includes(t1) && t2.length >= 4 && !NON_COMPOUND_WORDS.has(t2) && !STOPWORDS.has(t2)) {
        const compound = t1 + t2;
        if (!terms.includes(compound)) {
          terms.push(compound);
        }
      }
    }`;

if (!content.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated QueryProcessor.js with allTokens scan');
