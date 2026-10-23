const fs = require('fs');

const content = fs.readFileSync('reports/evaluator_preparation_2026-10-19/case_level_validation.csv', 'utf8');
const lines = content.trim().split('\n');
console.log('Total audited cases in CSV:', lines.length - 1);

const verdicts = {};
const bySplit = {};
const byLang = {};

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  // Parse CSV line respecting quotes
  const cols = [];
  let inQuotes = false;
  let current = '';
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') {
      if (inQuotes && line[j + 1] === '"') {
        current += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);

  const lang = cols[2];
  const split = cols[4];
  const verdict = cols[21];

  verdicts[verdict] = (verdicts[verdict] || 0) + 1;
  bySplit[split] = bySplit[split] || {};
  bySplit[split][verdict] = (bySplit[split][verdict] || 0) + 1;
  byLang[lang] = byLang[lang] || {};
  byLang[lang][verdict] = (byLang[lang][verdict] || 0) + 1;
}

console.log('\n--- Overall Verdicts Breakdown ---');
console.table(verdicts);

console.log('\n--- Verdicts by Split ---');
console.table(bySplit);

console.log('\n--- Verdicts by Language ---');
console.table(byLang);
