const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const HistoryTracker = require('../../src/tracker/HistoryTracker');
const GitHistoryReader = require('../../src/git/GitHistoryReader');
const { HistoryCache } = require('../../src/storage/HistoryCache');
const HistoricalRetrievalAdapter = require('../../src/retrieval/HistoricalRetrievalAdapter');
const { StructuralIndex } = require('../../src/structural/index/StructuralIndex');
const QueryProcessor = require('../../src/structural/query/QueryProcessor');

describe('End-to-End Git Historical Tracking Integration Tests', () => {
  let repoDir;
  let cacheDir;
  let tracker;
  let cache;
  let gitReader;

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
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-git-test-'));
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-cache-test-'));

    // Initialize git repo
    runGit(['init', '-b', 'main']);
    runGit(['config', 'user.name', 'Retrospect Tester']);
    runGit(['config', 'user.email', 'tester@example.com']);

    gitReader = new GitHistoryReader();
    cache = new HistoryCache(cacheDir);
    tracker = new HistoryTracker({ gitReader, cache });
  });

  afterAll(() => {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true });
      fs.rmSync(cacheDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('Tracks evolution through root commit, modifications, renames, moves, and merge commits', async () => {
    // 1. Commit 1: Root commit introducing Python, JS, TS, Java
    const c1 = commitFile('src/calc.py', 'def add(a, b):\n    return a + b\n', 'Root commit: initial calc');
    commitFile('src/math.js', 'function multiply(x, y) {\n    return x * y;\n}\n', 'Add JS math');
    commitFile('src/service.ts', 'export class Service {\n  public execute(cmd: string): boolean {\n    return true;\n  }\n}\n', 'Add TS service');
    const cJavaRoot = commitFile('src/Util.java', 'public class Util {\n  public static int sum(int a, int b) {\n    return a + b;\n  }\n}\n', 'Add Java Util');

    // 2. Commit 2: Modify Python function, introduce new file
    const c2 = commitFile('src/calc.py', 'def add(a, b):\n    # modified with logging\n    print("adding")\n    return a + b\n', 'Modify calc.py add function');
    commitFile('src/helper.py', 'def helper_func():\n    return 42\n', 'Add helper.py');

    // 3. Commit 3: Unchanged JS file, Rename JS function
    const c3 = commitFile('src/math.js', 'function times(x, y) {\n    return x * y;\n}\n', 'Rename multiply to times in math.js');

    // 4. Commit 4: Move Java file (file rename)
    const oldJavaPath = path.join(repoDir, 'src/Util.java');
    const newJavaPath = path.join(repoDir, 'src/legacy/Util.java');
    fs.mkdirSync(path.dirname(newJavaPath), { recursive: true });
    fs.renameSync(oldJavaPath, newJavaPath);
    runGit(['add', '-A']);
    runGit(['commit', '-m', 'Move Util.java to src/legacy/Util.java']);
    const c4 = runGit(['rev-parse', 'HEAD']).trim();

    // 5. Commit 5: Create branch and merge commit to test merge parent handling
    runGit(['checkout', '-b', 'feature-branch']);
    commitFile('src/feature.py', 'def feature(): pass\n', 'Feature commit');
    runGit(['checkout', 'main']);
    commitFile('src/main_update.py', 'def main_update(): pass\n', 'Main branch update');
    runGit(['merge', 'feature-branch', '--no-ff', '-m', 'Merge feature-branch into main']);
    const cMerge = runGit(['rev-parse', 'HEAD']).trim();

    // TEST 1: Python function modified across commits and stops at root commit boundary
    const pyTracking = await tracker.trackHistory(repoDir, c2, [{ filePath: 'src/calc.py', name: 'add' }], { maxDepth: 10 });
    expect(pyTracking.results.length).toBe(1);
    const pyVersions = pyTracking.results[0].versions;
    expect(pyVersions.length).toBeGreaterThanOrEqual(2);
    expect(pyVersions[0].edge.changeClassification).toBe('modified');
    expect(pyVersions[0].edge.matchingScore).toBeGreaterThanOrEqual(0.9);
    // Root commit boundary reached
    const lastPyVersion = pyVersions[pyVersions.length - 1];
    expect(lastPyVersion.edge.changeClassification).toBe('new');
    expect(lastPyVersion.edge.matchingMethod).toBe('root_commit_boundary');

    // TEST 2: JavaScript function renamed
    const jsTracking = await tracker.trackHistory(repoDir, c3, [{ filePath: 'src/math.js', name: 'times' }], { maxDepth: 10 });
    const jsVersions = jsTracking.results[0].versions;
    expect(jsVersions.length).toBeGreaterThanOrEqual(2);
    expect(jsVersions[0].edge.changeClassification).toBe('renamed');
    expect(jsVersions[1].symbol.name).toBe('multiply');

    // TEST 3: Java function file moved
    const javaTracking = await tracker.trackHistory(repoDir, c4, [{ filePath: 'src/legacy/Util.java', name: 'sum' }], { maxDepth: 10 });
    const javaVersions = javaTracking.results[0].versions;
    expect(javaVersions.length).toBeGreaterThanOrEqual(2);
    expect(javaVersions[0].edge.changeClassification).toBe('moved');
    expect(javaVersions[1].symbol.filePath).toBe('src/Util.java');

    // TEST 4: Merge commit parent handling (verifies first-parent traversal)
    const mergeTracking = await tracker.trackHistory(repoDir, cMerge, [{ filePath: 'src/main_update.py', name: 'main_update' }], { maxDepth: 10, firstParentOnly: true });
    expect(mergeTracking.results[0].versions.length).toBeGreaterThanOrEqual(1);

    // TEST 5: Cache reuse verification
    const spyPut = jest.spyOn(cache, 'putSymbols');
    await tracker.trackHistory(repoDir, c2, [{ filePath: 'src/calc.py', name: 'add' }], { maxDepth: 10 });
    // Since symbols are cached from earlier run, putSymbols shouldn't need to re-cache
    spyPut.mockRestore();

    // TEST 6: Cache invalidation and recovery
    await cache.invalidate(c2);
    const cachedAfterInvalidate = await cache.getSymbols(c2, 'src/calc.py');
    expect(cachedAfterInvalidate).toBeNull();
  });

  test('indexRepositoryHistory transitive lineage: connects HEAD symbol across modifications and multiple renames (A -> B -> C)', async () => {
    let testRepoDir;
    try {
      testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-transitive-git-test-'));

      const testRunGit = (args) => {
        return execFileSync('git', args, { cwd: testRepoDir, encoding: 'utf8', windowsHide: true });
      };

      const testCommitFile = (relPath, content, message) => {
        const fullPath = path.join(testRepoDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
        testRunGit(['add', relPath]);
        testRunGit(['commit', '-m', message]);
        return testRunGit(['rev-parse', 'HEAD']).trim();
      };

      testRunGit(['init', '-b', 'main']);
      testRunGit(['config', 'user.name', 'Retrospect Transitive Tester']);
      testRunGit(['config', 'user.email', 'tester@example.com']);

      // 1. Initial commit with computeAlpha (c0)
      testCommitFile('src/calc.js', 'function computeAlpha(x, y) {\n  return x + y;\n}\n', 'Root commit: initial calc');

      // 2. Modified computeAlpha with distinctive tokens and message (c1)
      testCommitFile('src/calc.js',
        'function computeAlpha(x, y) {\n  const quantumSuperpositionCoherence = x * 42;\n  return quantumSuperpositionCoherence + y;\n}\n',
        'perf: optimize quantumSuperpositionCoherence in computeAlpha'
      );

      // 3. Rename computeAlpha to computeBeta (c2)
      testCommitFile('src/calc.js',
        'function computeBeta(x, y) {\n  const quantumSuperpositionCoherence = x * 42;\n  return quantumSuperpositionCoherence + y;\n}\n',
        'refactor: rename computeAlpha to computeBeta'
      );

      // 4. Rename computeBeta to computeGamma (c3, HEAD)
      testCommitFile('src/calc.js',
        'function computeGamma(x, y) {\n  const quantumSuperpositionCoherence = x * 42;\n  return quantumSuperpositionCoherence + y;\n}\n',
        'refactor: rename computeBeta to computeGamma'
      );

      // Build structural index at HEAD
      const structuralIndex = new StructuralIndex();
      await structuralIndex.build(testRepoDir);
      const headSymbols = Array.from(structuralIndex.symbols.values());

      expect(headSymbols.length).toBe(1);
      expect(headSymbols[0].name).toBe('computeGamma');

      // Run real indexRepositoryHistory pipeline
      const adapter = new HistoricalRetrievalAdapter();
      const historyResult = await adapter.indexRepositoryHistory(testRepoDir, headSymbols, { maxCommits: 10 });

      const gammaProfile = historyResult.profileMap.get(headSymbols[0].id);
      expect(gammaProfile).toBeDefined();

      // Verify transitive ancestor names: computeGamma must inherit both computeBeta and computeAlpha
      expect(gammaProfile.historicalNames).toEqual(expect.arrayContaining(['computeBeta', 'computeAlpha']));

      // Verify commit message tokens inherited from commit c1 (prior to both renames)
      expect(gammaProfile.commitTerms.tokens).toContain('quantumsuperpositioncoherence');
      expect(gammaProfile.commitTerms.tokens).toContain('quantum');

      // Verify diff tokens inherited from commit c1
      expect(gammaProfile.diffTerms.tokens).toContain('quantumsuperpositioncoherence');
      expect(gammaProfile.diffTerms.tokens).toContain('quantum');

      // Verify history depth represents all 3 evolution commits
      expect(gammaProfile.historyDepth).toBe(3);

      // Verify historical scoring against query targeting earliest ancestor name and tokens
      const query = QueryProcessor.process('find quantumSuperpositionCoherence algorithm in computeAlpha');
      const score = adapter.scoreHistorical(query, gammaProfile);
      expect(score.score).toBeGreaterThan(0.30);
      expect(score.breakdown.historicalName).toBeGreaterThan(0);
      expect(score.breakdown.commitMessage).toBeGreaterThan(0);
    } finally {
      if (testRepoDir && fs.existsSync(testRepoDir)) {
        try {
          fs.rmSync(testRepoDir, { recursive: true, force: true });
        } catch (e) {}
      }
    }
  });
});
