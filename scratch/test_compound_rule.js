const QueryProcessor = require('../src/structural/query/QueryProcessor');

// Proposed additions to test
const PREFIXES = ['non', 'multi', 'sub', 'pre', 'post', 'un', 'auto', 'cross', 'read'];

function decomposeCompound(word) {
  if (!word || typeof word !== 'string' || word.length < 6) return [];
  const lower = word.toLowerCase();
  for (const p of PREFIXES) {
    if (lower.startsWith(p)) {
      const rem = lower.slice(p.length);
      if (rem.length >= 4) {
        return [p, rem];
      }
    }
  }
  return [];
}

const testWords = [
  'checkNonnegative',
  'nonnegative',
  'non-negative',
  'multithread',
  'multipart',
  'subnetwork',
  'preallocated',
  'readonly',
  // Negative test cases (should NOT split):
  'unit',
  'uncle',
  'notice',
  'none',
  'stone',
  'post'
];

console.log('Testing compound decomposition:');
for (const w of testWords) {
  const parts = decomposeCompound(w);
  console.log(`  ${w} -> [${parts.join(', ')}]`);
}
