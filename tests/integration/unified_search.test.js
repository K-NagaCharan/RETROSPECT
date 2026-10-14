const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const retrospect = require('../../src');

describe('Unified Search API Integration Tests', () => {
  let testRepoDir;

  const runGit = (args) => {
    return execFileSync('git', args, { cwd: testRepoDir, encoding: 'utf8', windowsHide: true });
  };

  const commitFile = (relPath, content, message) => {
    const fullPath = path.join(testRepoDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    runGit(['add', relPath]);
    runGit(['commit', '-m', message]);
    return runGit(['rev-parse', 'HEAD']).trim();
  };

  beforeAll(() => {
    testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-unified-search-test-'));

    runGit(['init', '-b', 'main']);
    runGit(['config', 'user.name', 'Retrospect Unified Search Tester']);
    runGit(['config', 'user.email', 'search-tester@example.com']);

    // Commit 1: Initial implementation of parseXml
    commitFile('src/xml.js',
      'function parseXml(xmlString) {\n  return xmlString.trim();\n}\n',
      'Root commit: initial parseXml implementation'
    );

    // Commit 2: Modified parseXml with security guard
    commitFile('src/xml.js',
      'function parseXml(xmlString) {\n  const entityExpansionGuardLimit = 1000;\n  if (xmlString.length > entityExpansionGuardLimit) throw new Error("limit");\n  return xmlString.trim();\n}\n',
      'perf: add entityExpansionGuardLimit against XML entity expansion attacks'
    );

    // Commit 3: Rename parseXml -> parseXmlDocument
    commitFile('src/xml.js',
      'function parseXmlDocument(xmlString) {\n  const entityExpansionGuardLimit = 1000;\n  if (xmlString.length > entityExpansionGuardLimit) throw new Error("limit");\n  return xmlString.trim();\n}\n',
      'refactor: rename parseXml to parseXmlDocument'
    );

    // Commit 4: Rename parseXmlDocument -> parseDocument
    commitFile('src/xml.js',
      'function parseDocument(xmlString) {\n  const entityExpansionGuardLimit = 1000;\n  if (xmlString.length > entityExpansionGuardLimit) throw new Error("limit");\n  return xmlString.trim();\n}\n',
      'refactor: rename parseXmlDocument to parseDocument for v2 release'
    );

    // Commit 5: Add a brand new function formatDocument with no prior renames
    commitFile('src/xml.js',
      'function parseDocument(xmlString) {\n  const entityExpansionGuardLimit = 1000;\n  if (xmlString.length > entityExpansionGuardLimit) throw new Error("limit");\n  return xmlString.trim();\n}\n\nfunction formatDocument(doc) {\n  return "<doc>" + doc + "</doc>";\n}\n',
      'feat: add formatDocument helper'
    );

    // Uncommitted file on disk: symbol has zero Git history
    const uncommittedFile = path.join(testRepoDir, 'src/uncommitted.js');
    fs.writeFileSync(
      uncommittedFile,
      'function uncommittedHelper(data) {\n  return data.toUpperCase();\n}\n',
      'utf8'
    );
  });

  afterAll(() => {
    retrospect.clearHistoryCache();
    if (testRepoDir && fs.existsSync(testRepoDir)) {
      try {
        fs.rmSync(testRepoDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  test('Public API signature: retrospect.search accepts repository path, query string, and settings', async () => {
    expect(typeof retrospect.search).toBe('function');
    expect(typeof retrospect.searchRepository).toBe('function');
    expect(retrospect.UnifiedSearch).toBeDefined();

    const response = await retrospect.search(testRepoDir, 'document', { limit: 5 });
    expect(response).toBeDefined();
    expect(response.query).toBe('document');
    expect(Array.isArray(response.results)).toBe(true);
    expect(response.totalCandidates).toBe(3);
    expect(response.returnedCount).toBe(3);
  });

  test('Historical Query: retrieves current symbol parseDocument via query targeting original predecessor name parseXml', async () => {
    // Structural search alone would not rank parseDocument high for 'parseXml' because the current name is 'parseDocument'
    const response = await retrospect.search(testRepoDir, 'find parseXml parser function', {
      strategy: 'linear',
      limit: 10
    });

    expect(response.results.length).toBeGreaterThan(0);
    const topResult = response.results[0];

    // The top retrieved symbol must be the current HEAD symbol parseDocument
    expect(topResult.symbol.name).toBe('parseDocument');
    expect(topResult.rank).toBe(1);

    // Structural score vs historical score
    expect(topResult.historicalScore).toBeGreaterThan(0.35);
    expect(topResult.score).toBeGreaterThan(0.20);

    // Lineage evidence must contain all ancestor names and messages
    expect(topResult.lineageEvidence.historicalNames).toEqual(expect.arrayContaining(['parseXmlDocument', 'parseXml']));
    expect(topResult.lineageEvidence.commitMessage).toContain('entityExpansionGuardLimit');
    expect(topResult.lineageEvidence.historyDepth).toBe(3);
  });

  test('Cold Symbol: handles symbol with no prior history cleanly using structural evidence', async () => {
    // uncommittedHelper exists only in current codebase with zero Git history
    const response = await retrospect.search(testRepoDir, 'uncommittedHelper data transform', {
      strategy: 'linear',
      limit: 10
    });

    expect(response.results.length).toBeGreaterThan(0);
    const topResult = response.results[0];

    expect(topResult.symbol.name).toBe('uncommittedHelper');
    expect(topResult.rank).toBe(1);

    // Structural evidence is strong, historical evidence is strictly 0.0
    expect(topResult.structuralScore).toBeGreaterThan(0.30);
    expect(topResult.historicalScore).toBe(0.0);
    expect(topResult.lineageEvidence.historyDepth).toBe(0);
    expect(topResult.lineageEvidence.historicalNames).toHaveLength(0);

    // Fused linear score is exactly 0.60 * structuralScore
    expect(topResult.score).toBeCloseTo(0.60 * topResult.structuralScore, 2);
  });

  test('Strategy Selection: supports linear, adaptive, rrf, and residual fusion strategies', async () => {
    const query = 'entityExpansionGuardLimit in parseXml';

    const linearRes = await retrospect.search(testRepoDir, query, { strategy: 'linear' });
    expect(linearRes.strategy).toBe('linear');
    expect(linearRes.results[0].symbol.name).toBe('parseDocument');

    const adaptiveRes = await retrospect.search(testRepoDir, query, { strategy: 'adaptive' });
    expect(adaptiveRes.strategy).toBe('adaptive');
    expect(adaptiveRes.results[0].symbol.name).toBe('parseDocument');

    const rrfRes = await retrospect.search(testRepoDir, query, { strategy: 'rrf' });
    expect(rrfRes.strategy).toBe('rrf');
    expect(rrfRes.results[0].symbol.name).toBe('parseDocument');

    const residualRes = await retrospect.search(testRepoDir, query, { strategy: 'residual' });
    expect(residualRes.strategy).toBe('residual');
    expect(residualRes.results[0].symbol.name).toBe('parseDocument');
  });

  test('Empty query returns empty results cleanly with timing metadata', async () => {
    const emptyRes = await retrospect.search(testRepoDir, '   ');
    expect(emptyRes.results.length).toBe(0);
    expect(emptyRes.totalCandidates).toBe(0);
    expect(emptyRes.timingMs).toBeDefined();
  });
});

describe('RRF Parity and Tied Score Behavior with Phase B Evaluation', () => {
  let rrfRepoDir;

  const runGit = (args) => {
    return execFileSync('git', args, { cwd: rrfRepoDir, encoding: 'utf8', windowsHide: true });
  };

  const commitFile = (relPath, content, message) => {
    const fullPath = path.join(rrfRepoDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    runGit(['add', relPath]);
    runGit(['commit', '-m', message]);
    return runGit(['rev-parse', 'HEAD']).trim();
  };

  beforeAll(() => {
    rrfRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-rrf-parity-test-'));

    runGit(['init', '-b', 'main']);
    runGit(['config', 'user.name', 'Retrospect RRF Tester']);
    runGit(['config', 'user.email', 'rrf-tester@example.com']);

    // Commit 1: Identical function definitions designed to have identical structural scores
    commitFile('src/workers.js',
      'function alphaWorker(payload) {\n  return payload;\n}\n\nfunction betaWorker(payload) {\n  return payload;\n}\n\nfunction gammaWorker(payload) {\n  return payload;\n}\n',
      'feat: add alphaWorker, betaWorker, and gammaWorker'
    );
  });

  afterAll(() => {
    retrospect.clearHistoryCache();
    if (rrfRepoDir && fs.existsSync(rrfRepoDir)) {
      try {
        fs.rmSync(rrfRepoDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });

  test('RRF tied structural scores: deterministic alphabetical tie-breaking and exact score parity with evaluation pipeline', async () => {
    const query = 'payload worker';

    // 1. Direct Phase B evaluation pipeline execution (scripts/evaluate_phase_b_fusion.js)
    const structIndex = new retrospect.StructuralIndex();
    await structIndex.build(rrfRepoDir);
    const allSymbols = Array.from(structIndex.symbols.values());

    const histAdapter = new retrospect.HistoricalRetrievalAdapter();
    const historyResult = await histAdapter.indexRepositoryHistory(rrfRepoDir, allSymbols, {
      maxCommits: 10,
      startCommit: 'HEAD'
    });

    const candidates = allSymbols.map(sym => ({
      symbol: sym,
      historyProfile: historyResult.profileMap.get(sym.id) || null
    }));

    const retriever = new retrospect.StructuralRetriever(structIndex);
    const parsed = retrospect.QueryProcessor.process(query);
    const symbols = candidates.map(c => c.symbol);
    const structRanked = retriever.rankCandidates(parsed, symbols);
    structRanked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    const histRanked = histAdapter.rankHistoricalOnly(parsed, candidates, {}, { enforceCandidateParity: true });

    const sMap = new Map();
    const sRankMap = new Map();
    structRanked.forEach((r, idx) => {
      sMap.set(r.symbol.id, r.score);
      sRankMap.set(r.symbol.id, idx + 1);
    });

    const hMap = new Map();
    const hRankMap = new Map();
    histRanked.forEach((r, idx) => {
      hMap.set(r.symbol.id, r.score);
      hRankMap.set(r.symbol.id, idx + 1);
    });

    const k = 60;
    const directFused = candidates.map(c => {
      const sRank = sRankMap.get(c.symbol.id) || candidates.length;
      const hRank = hRankMap.get(c.symbol.id) || candidates.length;
      const s = sMap.get(c.symbol.id) || 0;
      const h = hMap.get(c.symbol.id) || 0;
      const score = (0.60 / (k + sRank)) + (0.40 / (k + hRank));
      return { symbol: c.symbol, score, s, h };
    });
    directFused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    directFused.forEach((item, idx) => { item.rank = idx + 1; });

    // Verify structural scores are indeed tied across alpha, beta, and gamma
    expect(sMap.get('src/workers.js::alphaWorker')).toBe(sMap.get('src/workers.js::betaWorker'));
    expect(sMap.get('src/workers.js::betaWorker')).toBe(sMap.get('src/workers.js::gammaWorker'));

    // 2. Public Unified Search API execution
    const apiRes = await retrospect.search(rrfRepoDir, query, { strategy: 'rrf', limit: 0, forceReindex: true });

    // 3. Strict assertion of parity
    expect(apiRes.results.length).toBe(directFused.length);
    for (let i = 0; i < directFused.length; i++) {
      const expected = directFused[i];
      const actual = apiRes.results[i];

      expect(actual.symbol.id).toBe(expected.symbol.id);
      expect(actual.rank).toBe(expected.rank);
      expect(actual.structuralScore).toBe(expected.s);
      expect(actual.historicalScore).toBe(expected.h);
      expect(actual.score).toBe(expected.score); // Strict floating-point equality
    }

    // Alphabetical tie-breaking puts alphaWorker < betaWorker < gammaWorker
    expect(apiRes.results[0].symbol.name).toBe('alphaWorker');
    expect(apiRes.results[1].symbol.name).toBe('betaWorker');
    expect(apiRes.results[2].symbol.name).toBe('gammaWorker');
  });

  test('Linear, adaptive, and residual strategies produce exact parity on tied candidates', async () => {
    const query = 'payload worker';

    for (const strategy of ['linear', 'adaptive', 'residual']) {
      const apiRes = await retrospect.search(rrfRepoDir, query, { strategy, limit: 0, forceReindex: true });
      expect(apiRes.strategy).toBe(strategy);
      expect(apiRes.results.length).toBe(3);

      // All 3 have identical score, deterministic tie-breaking ensures alphaWorker < betaWorker < gammaWorker
      expect(apiRes.results[0].symbol.name).toBe('alphaWorker');
      expect(apiRes.results[1].symbol.name).toBe('betaWorker');
      expect(apiRes.results[2].symbol.name).toBe('gammaWorker');

      expect(apiRes.results[0].score).toBe(apiRes.results[1].score);
      expect(apiRes.results[1].score).toBe(apiRes.results[2].score);
    }
  });
});

