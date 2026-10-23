const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const clonesDir = 'D:/clones';
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const HistoricalRetrievalAdapter = require('../src/retrieval/HistoricalRetrievalAdapter');
const { fuseRRFv2 } = require('../src/retrieval/RRFv2');

const diagnosticCases = [
  {
    id: 'DIAG-01',
    repo: 'checkstyle/checkstyle',
    pin: '10a3a0777ced10983ebe6266c998957c10dba8f0',
    query: 'Retrieve the collection of logged style violations and inspection messages',
    target: { file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/AbstractCheck.java', symbol_name: 'AbstractCheck.getViolations' }
  },
  {
    id: 'DIAG-02',
    repo: 'graphhopper/graphhopper',
    pin: 'c7497d1100a4f05ddf5cc630692cbe8046b98114',
    query: 'Mark disconnected network vertices as removed during road network subnetwork preparation',
    target: { file_path: 'core/src/main/java/com/graphhopper/routing/util/PrepareRoutingSubnetworks.java', symbol_name: 'PrepareRoutingSubnetworks.markNodesRemovedIfUnreachable' }
  },
  {
    id: 'DIAG-03',
    repo: 'checkstyle/checkstyle',
    pin: '10a3a0777ced10983ebe6266c998957c10dba8f0',
    query: 'Construct AST block comment node structure from string content or token',
    target: { file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/utils/ParserUtil.java', symbol_name: 'ParserUtil.createBlockCommentNode' }
  },
  {
    id: 'DIAG-04',
    repo: 'google/guava',
    pin: 'db74bd2fdac443223d45e6fc5c66548542be1081',
    query: 'Check that integer index is non-negative and throw appropriate exception',
    target: { file_path: 'guava/src/com/google/common/collect/CollectPreconditions.java', symbol_name: 'CollectPreconditions.checkNonnegative' }
  },
  {
    id: 'DIAG-05',
    repo: 'google/guava',
    pin: 'db74bd2fdac443223d45e6fc5c66548542be1081',
    query: 'Construct an immutable list builder with preallocated capacity',
    target: { file_path: 'guava/src/com/google/common/collect/ImmutableList.java', symbol_name: 'ImmutableList.builder' }
  },
  {
    id: 'DIAG-06',
    repo: 'psf/requests',
    pin: '147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4',
    query: 'Send an HTTP request using an underlying urllib3 connection pool manager with retry logic and SSL verification',
    target: { file_path: 'requests/adapters.py', symbol_name: 'HTTPAdapter.send' }
  },
  {
    id: 'DIAG-07',
    repo: 'undertow-io/undertow',
    pin: 'cf3abec9145bb4660659add41b97866ff6ef9c31',
    query: 'Process and dispatch websocket binary and text frames internally across stream sink channel',
    target: { file_path: 'core/src/main/java/io/undertow/websockets/core/WebSocket07FrameSinkChannel.java', symbol_name: 'WebSocket07FrameSinkChannel.sendInternal' }
  },
  {
    id: 'DIAG-08',
    repo: 'checkstyle/checkstyle',
    pin: '10a3a0777ced10983ebe6266c998957c10dba8f0',
    query: 'Get the line coordinate number for logged violation warning',
    target: { file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/Violation.java', symbol_name: 'Violation.getLineNo' }
  }
];

function isTargetMatch(cand, target) {
  if (!cand || !target) return false;
  const normCandPath = (cand.filePath || '').replace(/\\/g, '/').toLowerCase();
  const normTarget = (target.file_path || '').replace(/\\/g, '/').toLowerCase();
  if (!normCandPath.endsWith(normTarget) && !normTarget.endsWith(normCandPath)) return false;
  const targetName = target.symbol_name || '';
  const targetShort = targetName.split('.').pop();
  const candName = cand.name || '';
  const candQName = cand.qualifiedName || '';
  return candName === targetShort || candName === targetName || candQName.endsWith('.' + targetShort);
}

async function runComparison() {
  const repoCache = new Map();

  for (const c of diagnosticCases) {
    const repoFolder = c.repo.split('/')[1];
    const repoPath = path.join(clonesDir, repoFolder);
    const cacheKey = `${repoPath}::${c.pin}`;

    let snap = repoCache.get(cacheKey);
    if (!snap) {
      execFileSync('git', ['checkout', '--detach', c.pin], { cwd: repoPath, stdio: 'pipe' });
      const structIndex = await indexRepository(repoPath, { forceRebuild: false });
      const allSymbols = Array.from(structIndex.symbols.values());
      const histAdapter = new HistoricalRetrievalAdapter();
      const histRes = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, { maxCommits: 50, startCommit: c.pin });
      snap = {
        structIndex,
        allSymbols,
        histAdapter,
        candidates: allSymbols.map(s => ({ symbol: s, historyProfile: histRes.profileMap.get(s.id) || null }))
      };
      repoCache.set(cacheKey, snap);
    }

    const q = QueryProcessor.process(c.query);
    const retriever = new StructuralRetriever(snap.structIndex);
    const b1_ranked = retriever.rankCandidates(q, snap.allSymbols);
    b1_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    const b2_ranked = snap.histAdapter.rankHistoricalOnly(q, snap.candidates, {}, { enforceCandidateParity: true });
    b2_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    const sMap = new Map();
    b1_ranked.forEach(r => sMap.set(r.symbol.id, r.score));
    const hMap = new Map();
    b2_ranked.forEach(r => hMap.set(r.symbol.id, r.score));

    // B3 Baseline (Static linear)
    const b3_base = snap.candidates.map(cand => {
      const s = sMap.get(cand.symbol.id) || 0;
      const h = hMap.get(cand.symbol.id) || 0;
      const score = parseFloat((0.60 * s + 0.40 * h).toFixed(4));
      return { symbol: cand.symbol, score, s, h };
    });
    b3_base.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    // B3 Candidate-Level Active Normalization
    const b3_cand_norm = snap.candidates.map(cand => {
      const s = sMap.get(cand.symbol.id) || 0;
      const h = hMap.get(cand.symbol.id) || 0;
      let score = 0;
      if (s > 0 && h > 0) score = (0.60 * s + 0.40 * h) / (0.60 + 0.40);
      else if (s > 0) score = s;
      else if (h > 0) score = h;
      return { symbol: cand.symbol, score: parseFloat(score.toFixed(4)), s, h };
    });
    b3_cand_norm.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    // B3 Query-Level Channel Availability Normalization
    const anyS = snap.candidates.some(cand => (sMap.get(cand.symbol.id) || 0) > 0);
    const anyH = snap.candidates.some(cand => (hMap.get(cand.symbol.id) || 0) > 0);
    const b3_query_norm = snap.candidates.map(cand => {
      const s = sMap.get(cand.symbol.id) || 0;
      const h = hMap.get(cand.symbol.id) || 0;
      let score = 0;
      if (anyS && anyH) score = 0.60 * s + 0.40 * h;
      else if (anyS) score = s;
      else if (anyH) score = h;
      return { symbol: cand.symbol, score: parseFloat(score.toFixed(4)), s, h };
    });
    b3_query_norm.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    const findRank = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].score > 0 && isTargetMatch(arr[i].symbol, c.target)) return { rank: i + 1, score: arr[i].score };
      }
      return { rank: null, score: 0 };
    };

    const r_b1 = findRank(b1_ranked);
    const r_b2 = findRank(b2_ranked);
    const r_b3_base = findRank(b3_base);
    const r_b3_cand = findRank(b3_cand_norm);
    const r_b3_query = findRank(b3_query_norm);

    console.log(`${c.id}: B1=${r_b1.rank} (${r_b1.score}) | B2=${r_b2.rank} (${r_b2.score}) | B3_Base=${r_b3_base.rank} (${r_b3_base.score}) | B3_CandNorm=${r_b3_cand.rank} (${r_b3_cand.score}) | B3_QueryNorm=${r_b3_query.rank} (${r_b3_query.score})`);
  }
}

runComparison().catch(console.error);
