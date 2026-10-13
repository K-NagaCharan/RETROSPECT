const fs = require('fs');
const path = require('path');
const os = require('os');
const { StructuralIndex } = require('../../src/structural/index/StructuralIndex');
const { StructuralRetriever } = require('../../src/structural/retrieval/StructuralRetriever');
const ContextBuilder = require('../../src/structural/context/ContextBuilder');

describe('Structural Retriever & Context Builder Unit Tests', () => {
  let tempDir;
  let index;
  let retriever;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-retr-test-'));
    fs.mkdirSync(path.join(tempDir, 'src/auth'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src/media'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, 'src/auth/service.py'), `
def authenticateUser(username, password):
    """Authenticate user credentials against database."""
    return verifyHash(password)

def verifyHash(token):
    """Verify cryptographic password hash."""
    return True
`);

    fs.writeFileSync(path.join(tempDir, 'src/media/image.ts'), `
/**
 * Validates uploaded image dimensions and formats.
 */
export function validateImageUpload(fileBuffer: Buffer): boolean {
  return fileBuffer.length > 0;
}

// Generic name with misleading docstring
export function process(data: any): any {
  return data;
}
`);

    index = new StructuralIndex();
    await index.build(tempDir);
    retriever = new StructuralRetriever(index);
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('prioritizes exact symbol name match at Rank 1', async () => {
    const res = await retriever.search('authenticateUser');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].name).toBe('authenticateUser');
    expect(res.results[0].scoreBreakdown.exactScore).toBeGreaterThanOrEqual(0.9);
    expect(res.results[0].matchReasons.some(r => r.includes('Exact'))).toBe(true);
  });

  test('retrieves based on functional natural-language description using docstrings and path', async () => {
    const res = await retriever.search('Find code that validates uploaded image files');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].name).toBe('validateImageUpload');
    expect(res.results[0].scoreBreakdown.docstringScore).toBeGreaterThan(0);
    expect(res.results[0].scoreBreakdown.pathScore).toBeGreaterThan(0);
  });

  test('returns zero results for completely irrelevant/absent queries (no-result behavior)', async () => {
    const res = await retriever.search('Where is quantum entanglement key distribution controller?');
    expect(res.results.length).toBe(0);
    expect(res.returnedCount).toBe(0);
  });

  test('boosts related symbols via call-graph relationships', async () => {
    const res = await retriever.search('authenticateUser');
    const returnedNames = res.results.map(r => r.name);
    // verifyHash is called by authenticateUser and should be captured in related symbols or returned
    expect(returnedNames).toContain('authenticateUser');
    const topResult = res.results[0];
    expect(topResult.relatedSymbols.callees.some(c => c.name === 'verifyHash')).toBe(true);
  });

  test('enforces token budget and avoids partial/broken code blocks', () => {
    const candidates = [
      {
        symbol: { id: '1', name: 'func1', symbolType: 'function', filePath: 'a.py', range: { startLine: 1, endLine: 5 }, source: 'def func1():\n    return 1\n' },
        score: 0.9,
        scoreBreakdown: {},
        matchReasons: []
      },
      {
        symbol: { id: '2', name: 'func2', symbolType: 'function', filePath: 'b.py', range: { startLine: 1, endLine: 5 }, source: 'def func2():\n    return 2\n' },
        score: 0.8,
        scoreBreakdown: {},
        matchReasons: []
      }
    ];

    // Tight budget allowing only 1 function
    const context = ContextBuilder.buildContext(candidates, { maxResults: 5, tokenBudget: 45 });
    expect(context.results.length).toBe(1);
    expect(context.results[0].name).toBe('func1');
    expect(context.budget.budgetExceeded).toBe(true);
    expect(context.omittedCount).toBe(1);
  });

  test('produces deterministic output across identical queries', async () => {
    const res1 = await retriever.search('validateImageUpload');
    const res2 = await retriever.search('validateImageUpload');

    expect(res1.results.length).toBe(res2.results.length);
    expect(res1.results[0].symbolId).toBe(res2.results[0].symbolId);
    expect(res1.results[0].score).toBe(res2.results[0].score);
  });
});
