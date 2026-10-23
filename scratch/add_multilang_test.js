const fs = require('fs');
const testFile = 'tests/unit/structural_query.test.js';
let content = fs.readFileSync(testFile, 'utf8');

const addition = `
  // --- Multi-Language Generality (Java, Python, JS, TS) ---
  test('processes compound identifiers consistently across Java, Python, JavaScript, and TypeScript', () => {
    // Java: camelCase method with uncapitalized prefix
    const javaSyms = QueryProcessor.splitIdentifiers('checkNonnegative');
    expect(javaSyms.map(s => s.toLowerCase())).toEqual(expect.arrayContaining(['check', 'nonnegative', 'non', 'negative']));

    // Python: snake_case function with uncapitalized prefix
    const pySyms = QueryProcessor.splitIdentifiers('validate_nonnegative_indices');
    expect(pySyms.map(s => s.toLowerCase())).toEqual(expect.arrayContaining(['validate', 'nonnegative', 'non', 'negative', 'indices']));

    // JavaScript: camelCase function / property
    const jsSyms = QueryProcessor.splitIdentifiers('preprocessOptions');
    expect(jsSyms.map(s => s.toLowerCase())).toEqual(expect.arrayContaining(['preprocess', 'pre', 'process', 'options']));

    // TypeScript: PascalCase type / interface / class
    const tsSyms = QueryProcessor.splitIdentifiers('SubnetworkRoutingHandler');
    expect(tsSyms.map(s => s.toLowerCase())).toEqual(expect.arrayContaining(['subnetwork', 'sub', 'network', 'routing', 'handler']));
  });
});
`;

if (!content.includes('// --- Multi-Language Generality')) {
  content = content.replace(/\s*\}\);\s*$/, addition);
  fs.writeFileSync(testFile, content, 'utf8');
  console.log('Added multi-language test to structural_query.test.js');
}
