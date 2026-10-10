const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const HistoricalRetriever = require('../../src/retrieval/HistoricalRetriever');

describe('HistoricalRetriever API Integration Tests', () => {
  let repoDir;
  let retriever;

  function runGit(args) {
    return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8', windowsHide: true });
  }

  function commitFile(relPath, content, message) {
    const fullPath = path.join(repoDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    runGit(['add', relPath]);
    runGit(['commit', '-m', message]);
    return runGit(['rev-parse', 'HEAD']).trim();
  }

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-retriever-test-'));
    runGit(['init', '-b', 'main']);
    runGit(['config', 'user.name', 'Retrospect Retr']);
    runGit(['config', 'user.email', 'retr@example.com']);

    commitFile('src/auth.ts', 'export function login(user: string, pass: string): boolean {\n  return user === "admin";\n}\n', 'Initial login');
    commitFile('src/auth.ts', 'export function login(user: string, pass: string): boolean {\n  // secure check\n  return user === "admin" && pass.length > 5;\n}\n', 'Update login with password check');

    retriever = new HistoricalRetriever();
  });

  afterAll(() => {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('Retrieves structured evidence including diffs, timestamps, and classifications', async () => {
    const result = await retriever.retrieve({
      repoPath: repoDir,
      targetCommit: 'HEAD',
      symbolQueries: [{ filePath: 'src/auth.ts', name: 'login' }],
      historyDepth: 5,
      includeDiffs: true
    });

    expect(result.retrievalMetadata).toBeDefined();
    expect(result.retrievalMetadata.symbolCount).toBe(1);
    expect(result.retrievalMetadata.executionTimeMs).toBeGreaterThan(0);

    expect(result.symbols.length).toBe(1);
    const symEvidence = result.symbols[0];
    expect(symEvidence.found).toBe(true);
    expect(symEvidence.historicalDepth).toBeGreaterThanOrEqual(1);

    const history = symEvidence.history;
    expect(history.length).toBeGreaterThanOrEqual(2);

    const latest = history[0];
    expect(latest.symbolName).toBe('login');
    expect(latest.changeClassification).toBe('modified');
    expect(latest.diff).toContain('+  // secure check');
    expect(latest.timestamp).toBeDefined();
    expect(latest.commitMessage).toContain('Update login with password check');

    const older = history[1];
    expect(older.symbolName).toBe('login');
    expect(older.changeClassification).toBe('new');
  });

  test('Gracefully returns not found when symbol is absent', async () => {
    const result = await retriever.retrieve({
      repoPath: repoDir,
      targetCommit: 'HEAD',
      symbolQueries: [{ filePath: 'src/auth.ts', name: 'nonExistentFunction' }]
    });

    expect(result.symbols.length).toBe(1);
    expect(result.symbols[0].found).toBe(false);
    expect(result.symbols[0].error).toContain('not found');
  });
});
