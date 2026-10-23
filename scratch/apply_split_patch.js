const fs = require('fs');
const filePath = 'src/structural/query/QueryProcessor.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = `      for (const cp of camelParts) {
        if (cp) result.push(cp);
      }`;

const replacement = `      for (const cp of camelParts) {
        if (!cp) continue;
        result.push(cp);

        // Decompose compound prefix if present (e.g. 'nonnegative' -> 'non', 'negative')
        const lower = cp.toLowerCase();
        if (!NON_COMPOUND_WORDS.has(lower)) {
          for (const pfx of COMPOUND_PREFIXES) {
            if (lower.startsWith(pfx) && lower.length >= pfx.length + 4) {
              const base = lower.slice(pfx.length);
              if (!NON_COMPOUND_WORDS.has(base)) {
                result.push(cp.slice(0, pfx.length));
                result.push(cp.slice(pfx.length));
                break;
              }
            }
          }
        }
      }`;

if (!content.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated QueryProcessor.js');
