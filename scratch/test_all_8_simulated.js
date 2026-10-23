const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const clonesDir = 'D:/clones';
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const HistoricalRetrievalAdapter = require('../src/retrieval/HistoricalRetrievalAdapter');
const { fuseRRFv2 } = require('../src/retrieval/RRFv2');

// Test version of QueryProcessor logic
const PREFIXES = ['non', 'multi', 'sub', 'pre', 'post', 'un', 'auto', 'cross', 'read'];
const NON_COMPOUNDS = new Set(['notice', 'nothing', 'uncle', 'under', 'until', 'union', 'unit', 'unique', 'auto', 'read', 'ready', 'real', 'post', 'multi']);

const ACTION_SYNONYMS = {
  'dispatch': 'send',
  'transmit': 'send',
  'retrieve': 'get',
  'fetch': 'get',
  'construct': 'build',
  'create': 'build'
};

function customSplitIdentifiers(token) {
  if (!token) return [];
  const parts = token.split(/[_.\-$]+/);
  const result = [];

  for (const p of parts) {
    if (!p) continue;
    const camelParts = p.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                        .split(/\s+/);
    for (const cp of camelParts) {
      if (!cp) continue;
      result.push(cp);
      const lower = cp.toLowerCase();
      if (!NON_COMPOUNDS.has(lower)) {
        for (const pfx of PREFIXES) {
          if (lower.startsWith(pfx) && lower.length >= pfx.length + 4) {
            const base = lower.slice(pfx.length);
            if (!NON_COMPOUNDS.has(base)) {
              result.push(cp.slice(0, pfx.length));
              result.push(cp.slice(pfx.length));
              break;
            }
          }
        }
      }
    }
  }
  return result;
}

function customProcess(rawQuery) {
  const baseResult = QueryProcessor.process(rawQuery);
  if (baseResult.isEmpty) return baseResult;

  const terms = [...baseResult.terms];

  // 1. Form compound tokens for adjacent prefix + word
  for (let i = 0; i < baseResult.terms.length - 1; i++) {
    const t1 = baseResult.terms[i];
    const t2 = baseResult.terms[i + 1];
    if (PREFIXES.includes(t1) && t2.length >= 4 && !NON_COMPOUNDS.has(t2)) {
      const compound = t1 + t2;
      if (!terms.includes(compound)) {
        terms.push(compound);
      }
    }
  }

  // 2. Add conservative action synonyms
  for (const t of baseResult.terms) {
    if (ACTION_SYNONYMS[t]) {
      const syn = ACTION_SYNONYMS[t];
      if (!terms.includes(syn)) {
        terms.push(syn);
      }
    }
  }

  const stemmedTerms = terms.map(t => QueryProcessor.stem(t));

  return {
    ...baseResult,
    terms,
    stemmedTerms
  };
}

const diagnosticCases = [
  {
    id: 'DIAG-01',
    name: 'Checkstyle getViolations (Rename within horizon; RRF asymmetry test)',
    repo: 'checkstyle/checkstyle',
    folder: 'checkstyle',
    pin: '10a3a0777ced10983ebe6266c998957c10dba8f0',
    origin: 'c4bc16b8d4e9411d3106575cb2fa28f4cc1450de',
    distance: 36,
    archetype: 'Rename within horizon (Historical strong, Structural weak)',
    query: 'Retrieve the collection of logged style violations and inspection messages',
    target: {
      file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/AbstractCheck.java',
      symbol_name: 'AbstractCheck.getViolations',
      short_name: 'getViolations'
    }
  },
  {
    id: 'DIAG-02',
    name: 'Graphhopper markNodesRemovedIfUnreachable (Rename within horizon)',
    repo: 'graphhopper/graphhopper',
    folder: 'graphhopper',
    pin: 'c7497d1100a4f05ddf5cc630692cbe8046b98114',
    origin: '88806c24c77ce9dde2d99ad3ffd4f4e190f06252',
    distance: 40,
    archetype: 'Rename within horizon (Behavioral query, no historical name)',
    query: 'Mark disconnected network vertices as removed during road network subnetwork preparation',
    target: {
      file_path: 'core/src/main/java/com/graphhopper/routing/util/PrepareRoutingSubnetworks.java',
      symbol_name: 'PrepareRoutingSubnetworks.markNodesRemovedIfUnreachable',
      short_name: 'markNodesRemovedIfUnreachable'
    }
  },
  {
    id: 'DIAG-03',
    name: 'Checkstyle createBlockCommentNode (Move Method across classes)',
    repo: 'checkstyle/checkstyle',
    folder: 'checkstyle',
    pin: '10a3a0777ced10983ebe6266c998957c10dba8f0',
    origin: '5051458d99689acf0f87f4ed50610c9e195e0e9f',
    distance: 28,
    archetype: 'Move Method across classes',
    query: 'Construct AST block comment node structure from string content or token',
    target: {
      file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/utils/ParserUtil.java',
      symbol_name: 'ParserUtil.createBlockCommentNode',
      short_name: 'createBlockCommentNode'
    }
  },
  {
    id: 'DIAG-04',
    name: 'Guava checkNonnegative (Destructive Linear Dilution in B3)',
    repo: 'google/guava',
    folder: 'guava',
    pin: 'db74bd2fdac443223d45e6fc5c66548542be1081',
    origin: 'db74bd2fdac443223d45e6fc5c66548542be1081',
    distance: 0,
    archetype: 'Linear Fusion Dilution (Structural strong, Historical zero)',
    query: 'Check that integer index is non-negative and throw appropriate exception',
    target: {
      file_path: 'guava/src/com/google/common/collect/CollectPreconditions.java',
      symbol_name: 'CollectPreconditions.checkNonnegative',
      short_name: 'checkNonnegative'
    }
  },
  {
    id: 'DIAG-05',
    name: 'Guava ImmutableList.builder (Multi-Module Sibling Shadowing in B1)',
    repo: 'google/guava',
    folder: 'guava',
    pin: 'db74bd2fdac443223d45e6fc5c66548542be1081',
    origin: 'db74bd2fdac443223d45e6fc5c66548542be1081',
    distance: 0,
    archetype: 'Structural Sibling Shadowing (Multi-module root vs stubs)',
    query: 'Construct an immutable list builder with preallocated capacity',
    target: {
      file_path: 'guava/src/com/google/common/collect/ImmutableList.java',
      symbol_name: 'ImmutableList.builder',
      short_name: 'builder'
    }
  },
  {
    id: 'DIAG-06',
    name: 'Requests HTTPAdapter.send (Structural & Historical Multi-Signal Agreement)',
    repo: 'psf/requests',
    folder: 'requests',
    pin: '147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4',
    origin: '147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4',
    distance: 0,
    archetype: 'Multi-Signal Concordance (Both channels retrieve target)',
    query: 'Send an HTTP request using an underlying urllib3 connection pool manager with retry logic and SSL verification',
    target: {
      file_path: 'requests/adapters.py',
      symbol_name: 'HTTPAdapter.send',
      short_name: 'send'
    }
  },
  {
    id: 'DIAG-07',
    name: 'Undertow sendInternal (Lexical Token Gap / Shadowing)',
    repo: 'undertow-io/undertow',
    folder: 'undertow',
    pin: 'cf3abec9145bb4660659add41b97866ff6ef9c31',
    origin: 'b612130e66b33bb58c89c8942b2609071c3e390c',
    distance: 40,
    archetype: 'Lexical Token Gap (Behavioral query lacks code keywords)',
    query: 'Process and dispatch websocket binary and text frames internally across stream sink channel',
    target: {
      file_path: 'core/src/main/java/io/undertow/websockets/core/protocol/version07/WebSocket07FrameSinkChannel.java',
      symbol_name: 'WebSocket07FrameSinkChannel.sendInternal',
      short_name: 'sendInternal'
    }
  },
  {
    id: 'DIAG-08',
    name: 'Checkstyle getLineNo (Historical Horizon Exceeded, dist=394)',
    repo: 'checkstyle/checkstyle',
    folder: 'checkstyle',
    pin: '10a3a0777ced10983ebe6266c998957c10dba8f0',
    origin: '9708915b81b2f70b9231f479e0a0d2495bbdf316',
    distance: 394,
    archetype: 'Historical Horizon Exceeded (Origin beyond 50 commits)',
    query: 'Get the line coordinate number for logged violation warning',
    target: {
      file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/Violation.java',
      symbol_name: 'Violation.getLineNo',
      short_name: 'getLineNo'
    }
  }
];

function isTargetMatch(cand, target) {
  if (!cand || !target) return false;
  const normCandPath = (cand.filePath || '').replace(/\\/g, '/').toLowerCase();
  const normTarget = (target.file_path || '').replace(/\\/g, '/').toLowerCase();
  const fileMatch = normCandPath.endsWith(normTarget) || normTarget.endsWith(normCandPath);
  if (!fileMatch) return false;

  const targetName = target.symbol_name || '';
  const targetShort = target.short_name || targetName.split('.').pop();
  const candName = cand.name || '';
  const candQName = cand.qualifiedName || '';

  return candName === targetShort ||
         candName === targetName ||
         (candQName && (candQName === targetName || candQName.endsWith('.' + targetShort)));
}

async function testAll() {
  const snapshotCache = new Map();

  async function getSnapshot(folder, commit) {
    const key = `${folder}::${commit}`;
    if (snapshotCache.has(key)) return snapshotCache.get(key);

    const repoPath = path.join(clonesDir, folder);
    execFileSync('git', ['checkout', '--detach', commit], { cwd: repoPath, stdio: 'pipe' });

    const structuralIndex = await indexRepository(repoPath, { forceRebuild: false });
    const allSymbols = Array.from(structuralIndex.symbols.values());
    const histAdapter = new HistoricalRetrievalAdapter();
    const histResult = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, {
      maxCommits: 50,
      startCommit: commit
    });
    const candidates = allSymbols.map(sym => ({
      symbol: sym,
      historyProfile: histResult.profileMap.get(sym.id) || null
    }));

    const snapshot = { structuralIndex, histAdapter, allSymbols, candidates };
    snapshotCache.set(key, snapshot);
    return snapshot;
  }

  console.log('Comparing BASELINE vs CUSTOM Query Processing on all 8 cases:\n');
  console.log('| Case | Baseline B1 Rank (Score) | Custom B1 Rank (Score) | Baseline B4 Rank | Custom B4 Rank |');
  console.log('|---|---|---|---|---|');

  for (const c of diagnosticCases) {
    const snapshot = await getSnapshot(c.folder, c.pin);
    const retriever = new StructuralRetriever(snapshot.structuralIndex);

    // BASELINE
    const baseQ = QueryProcessor.process(c.query);
    const base_b1 = retriever.rankCandidates(baseQ, snapshot.allSymbols);
    let base_b1_rank = null, base_b1_score = 0.0;
    for (let i = 0; i < base_b1.length; i++) {
      if (base_b1[i].score > 0 && isTargetMatch(base_b1[i].symbol, c.target)) {
        base_b1_rank = i + 1;
        base_b1_score = base_b1[i].score;
        break;
      }
    }
    const base_b2 = snapshot.histAdapter.rankHistoricalOnly(baseQ, snapshot.candidates, {}, { enforceCandidateParity: true });
    const base_b4 = fuseRRFv2(base_b1, base_b2, { topK: 100, k: 60 });
    let base_b4_rank = null;
    for (let i = 0; i < base_b4.length; i++) {
      if (isTargetMatch(base_b4[i].symbol, c.target)) {
        base_b4_rank = i + 1;
        break;
      }
    }

    // CUSTOM
    // Temporarily override QueryProcessor.splitIdentifiers to test effect on structural index/retrieval
    const origSplit = QueryProcessor.splitIdentifiers;
    QueryProcessor.splitIdentifiers = customSplitIdentifiers;

    const customQ = customProcess(c.query);
    const custom_b1 = retriever.rankCandidates(customQ, snapshot.allSymbols);
    let custom_b1_rank = null, custom_b1_score = 0.0;
    for (let i = 0; i < custom_b1.length; i++) {
      if (custom_b1[i].score > 0 && isTargetMatch(custom_b1[i].symbol, c.target)) {
        custom_b1_rank = i + 1;
        custom_b1_score = custom_b1[i].score;
        break;
      }
    }
    const custom_b2 = snapshot.histAdapter.rankHistoricalOnly(customQ, snapshot.candidates, {}, { enforceCandidateParity: true });
    const custom_b4 = fuseRRFv2(custom_b1, custom_b2, { topK: 100, k: 60 });
    let custom_b4_rank = null;
    for (let i = 0; i < custom_b4.length; i++) {
      if (isTargetMatch(custom_b4[i].symbol, c.target)) {
        custom_b4_rank = i + 1;
        break;
      }
    }

    QueryProcessor.splitIdentifiers = origSplit;

    console.log(`| ${c.id} | ${base_b1_rank ?? 'null'} (${base_b1_score.toFixed(4)}) | ${custom_b1_rank ?? 'null'} (${custom_b1_score.toFixed(4)}) | ${base_b4_rank ?? 'null'} | ${custom_b4_rank ?? 'null'} |`);
  }
}

testAll().catch(console.error);
