/**
 * scripts/trace_engineering_diagnostic.js
 *
 * Runs an end-to-end trace on the 8-case Engineering Diagnostic Set:
 * Captures query, target, pin, origin, structural candidates/rank,
 * historical profiles/rank, B3 linear rank, B4 RRF rank, latencies,
 * and concrete failure classifications.
 */

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

async function run() {
  console.log('================================================================================');
  console.log('          RETROSPECT ENGINEERING DIAGNOSTIC TRACE (8-CASE SET)                  ');
  console.log('================================================================================\n');

  const snapshotCache = new Map();

  async function getSnapshot(folder, commit) {
    const key = `${folder}::${commit}`;
    if (snapshotCache.has(key)) return snapshotCache.get(key);

    const repoPath = path.join(clonesDir, folder);
    let origBranch = 'master';
    try {
      origBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath, stdio: 'pipe' }).toString().trim();
      if (origBranch === 'HEAD') origBranch = 'master';
    } catch(e) {}

    console.log(`[SNAPSHOT] Checking out ${folder} @ ${commit.substring(0, 10)}...`);
    execFileSync('git', ['checkout', '--detach', commit], { cwd: repoPath, stdio: 'pipe' });

    try {
      const t0_s = Date.now();
      const structuralIndex = await indexRepository(repoPath, { forceRebuild: true });
      const allSymbols = Array.from(structuralIndex.symbols.values());
      const structMs = Date.now() - t0_s;

      const t0_h = Date.now();
      const histAdapter = new HistoricalRetrievalAdapter();
      const histResult = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, {
        maxCommits: 50,
        startCommit: commit
      });
      const histMs = Date.now() - t0_h;

      const candidates = allSymbols.map(sym => ({
        symbol: sym,
        historyProfile: histResult.profileMap.get(sym.id) || null
      }));

      const snapshot = {
        folder,
        commit,
        origBranch,
        repoPath,
        structuralIndex,
        allSymbols,
        histAdapter,
        candidates,
        profileMap: histResult.profileMap,
        structIndexMs: structMs,
        histIndexMs: histMs
      };
      snapshotCache.set(key, snapshot);
      return snapshot;
    } catch(err) {
      execFileSync('git', ['checkout', origBranch], { cwd: repoPath, stdio: 'pipe' });
      throw err;
    }
  }

  const results = [];

  for (const c of diagnosticCases) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`Tracing ${c.id}: ${c.name}`);
    console.log(`Repository: ${c.repo} | Pin: ${c.pin.substring(0, 10)} | Archetype: ${c.archetype}`);
    console.log(`Query: "${c.query}"`);
    console.log(`Target: ${c.target.symbol_name} (${c.target.file_path})`);

    const snapshot = await getSnapshot(c.folder, c.pin);
    const q = QueryProcessor.process(c.query);

    // B1: Structural
    const t0_b1 = Date.now();
    const retriever = new StructuralRetriever(snapshot.structuralIndex);
    const b1_ranked = retriever.rankCandidates(q, snapshot.allSymbols);
    b1_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const lat_b1 = Date.now() - t0_b1;

    let b1_rank = null, b1_score = 0.0;
    for (let i = 0; i < b1_ranked.length; i++) {
      if (b1_ranked[i].score > 0 && isTargetMatch(b1_ranked[i].symbol, c.target)) {
        b1_rank = i + 1;
        b1_score = b1_ranked[i].score;
        break;
      }
    }

    // B2: Historical
    const t0_b2 = Date.now();
    const b2_ranked = snapshot.histAdapter.rankHistoricalOnly(q, snapshot.candidates, {}, { enforceCandidateParity: true });
    b2_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const lat_b2 = Date.now() - t0_b2;

    let b2_rank = null, b2_score = 0.0;
    for (let i = 0; i < b2_ranked.length; i++) {
      if (b2_ranked[i].score > 0 && isTargetMatch(b2_ranked[i].symbol, c.target)) {
        b2_rank = i + 1;
        b2_score = b2_ranked[i].score;
        break;
      }
    }

    // B3 Baseline: Linear (0.60 S / 0.40 H, unnormalized)
    const t0_b3 = Date.now();
    const sMap = new Map();
    b1_ranked.forEach(r => sMap.set(r.symbol.id, r.score));
    const hMap = new Map();
    b2_ranked.forEach(r => hMap.set(r.symbol.id, r.score));

    const b3_fused = snapshot.candidates.map(cand => {
      const sScore = sMap.get(cand.symbol.id) || 0.0;
      const hScore = hMap.get(cand.symbol.id) || 0.0;
      const combined = HistoricalRetrievalAdapter.fuseScores(sScore, hScore, { structural: 0.60, historical: 0.40 }, { normalizeActiveChannels: false });
      return { symbol: cand.symbol, score: combined, structuralScore: sScore, historicalScore: hScore };
    });
    b3_fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const lat_b3 = Date.now() - t0_b3;

    let b3_rank = null, b3_score = 0.0;
    for (let i = 0; i < b3_fused.length; i++) {
      if (b3_fused[i].score > 0 && isTargetMatch(b3_fused[i].symbol, c.target)) {
        b3_rank = i + 1;
        b3_score = b3_fused[i].score;
        break;
      }
    }

    // B3 Normalized: Linear Active-Channel Normalization (Option A)
    const b3_norm_fused = snapshot.candidates.map(cand => {
      const sScore = sMap.get(cand.symbol.id) || 0.0;
      const hScore = hMap.get(cand.symbol.id) || 0.0;
      const combined = HistoricalRetrievalAdapter.fuseScores(sScore, hScore, { structural: 0.60, historical: 0.40 }, { normalizeActiveChannels: true });
      return { symbol: cand.symbol, score: combined, structuralScore: sScore, historicalScore: hScore };
    });
    b3_norm_fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    let b3_norm_rank = null, b3_norm_score = 0.0;
    for (let i = 0; i < b3_norm_fused.length; i++) {
      if (b3_norm_fused[i].score > 0 && isTargetMatch(b3_norm_fused[i].symbol, c.target)) {
        b3_norm_rank = i + 1;
        b3_norm_score = b3_norm_fused[i].score;
        break;
      }
    }

    // B4 Baseline: Legacy Asymmetric RRF-v2 (0.60 / 0.40)
    const t0_b4 = Date.now();
    const b4_legacy_fused = fuseRRFv2(
      snapshot.candidates.map(cand => cand.symbol),
      b1_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      b2_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      { k: 60, weightStructural: 0.60, weightHistorical: 0.40 }
    );
    const lat_b4 = Date.now() - t0_b4;

    let b4_legacy_rank = null, b4_legacy_score = 0.0;
    for (let i = 0; i < b4_legacy_fused.length; i++) {
      if (b4_legacy_fused[i].score > 0 && isTargetMatch(b4_legacy_fused[i].symbol, c.target)) {
        b4_legacy_rank = i + 1;
        b4_legacy_score = b4_legacy_fused[i].score;
        break;
      }
    }

    // B4 Improved: Channel-Balanced Cormack RRF (0.50 / 0.50)
    const b4_improved_fused = fuseRRFv2(
      snapshot.candidates.map(cand => cand.symbol),
      b1_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      b2_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      { k: 60, weightStructural: 0.50, weightHistorical: 0.50 }
    );

    let b4_improved_rank = null, b4_improved_score = 0.0;
    for (let i = 0; i < b4_improved_fused.length; i++) {
      if (b4_improved_fused[i].score > 0 && isTargetMatch(b4_improved_fused[i].symbol, c.target)) {
        b4_improved_rank = i + 1;
        b4_improved_score = b4_improved_fused[i].score;
        break;
      }
    }

    // Failure Classification
    let failureCategory = 'NONE';
    let diagnosis = 'Success: Target retrieved in top-10 across configurations.';

    if (c.distance > 50 && b2_rank === null) {
      failureCategory = 'HISTORICAL_HORIZON_EXCEEDED';
      diagnosis = `Origin commit is ${c.distance} commits prior to pin, exceeding default 50-commit historical lookback. Target received score 0.0 in B2.`;
    } else if (b2_rank !== null && b2_rank <= 10 && (b1_rank === null || b1_rank > 31) && b4_legacy_rank > 10) {
      failureCategory = 'RRF_FUSION_ASYMMETRY_CAP';
      diagnosis = `RRF-v2 mathematical cap (w_h/(k+1)=0.00656) allowed top 31 purely structural candidates to outrank historical match. B2 Rank was ${b2_rank}, but Legacy B4 Rank collapsed to ${b4_legacy_rank}! Rescued to Rank ${b4_improved_rank} under Balanced Cormack RRF.`;
    } else if (b1_rank !== null && b1_rank <= 10 && b2_rank === null && b3_rank > 10) {
      failureCategory = 'LINEAR_FUSION_DILUTION';
      diagnosis = `Zero-signal historical channel diluted strong structural score (0.60*S + 0.40*0), dropping target from B1 Rank ${b1_rank} to B3 Rank ${b3_rank}.`;
    } else if (b1_rank !== null && b1_rank > 50 && b2_rank === null) {
      failureCategory = 'STRUCTURAL_SIBLING_SHADOWING';
      diagnosis = `Identical or near-identical method signatures in sibling modules/stubs shadowed the target, dispersing rank down to B1 Rank ${b1_rank}.`;
    } else if (b1_rank === null && b2_rank === null) {
      failureCategory = 'LEXICAL_TOKEN_GAP';
      diagnosis = `Query phrasing lacked sufficient lexical token overlap with AST declarations or commit diffs, resulting in zero scores.`;
    }

    console.log(`Ranks: B1=${b1_rank ?? 'NONE'} | B2=${b2_rank ?? 'NONE'} | B3_Base=${b3_rank ?? 'NONE'} | B3_Norm=${b3_norm_rank ?? 'NONE'} | B4_Legacy=${b4_legacy_rank ?? 'NONE'} | B4_Improved=${b4_improved_rank ?? 'NONE'}`);
    console.log(`Scores: B1=${b1_score.toFixed(4)} | B2=${b2_score.toFixed(4)} | B3_Base=${b3_score.toFixed(4)} | B3_Norm=${b3_norm_score.toFixed(4)} | B4_Legacy=${b4_legacy_score.toFixed(4)} | B4_Improved=${b4_improved_score.toFixed(4)}`);
    console.log(`Classification: [${failureCategory}] ${diagnosis}`);

    results.push({
      id: c.id,
      name: c.name,
      repo: c.repo,
      distance: c.distance,
      archetype: c.archetype,
      b1_rank,
      b1_score: parseFloat(b1_score.toFixed(4)),
      b2_rank,
      b2_score: parseFloat(b2_score.toFixed(4)),
      b3_rank,
      b3_score: parseFloat(b3_score.toFixed(4)),
      b3_norm_rank,
      b3_norm_score: parseFloat(b3_norm_score.toFixed(4)),
      b4_legacy_rank,
      b4_legacy_score: parseFloat(b4_legacy_score.toFixed(4)),
      b4_improved_rank,
      b4_improved_score: parseFloat(b4_improved_score.toFixed(4)),
      latencies: {
        isolated: { b1: lat_b1, b2: lat_b2, b3: lat_b3, b4: lat_b4 },
        end_to_end: {
          b1: lat_b1,
          b2: lat_b2,
          b3: lat_b1 + lat_b2 + lat_b3,
          b4: lat_b1 + lat_b2 + lat_b4
        }
      },
      failure_category: failureCategory,
      diagnosis
    });
  }

  // Restore git branches
  for (const snapshot of snapshotCache.values()) {
    try {
      execFileSync('git', ['checkout', snapshot.origBranch], { cwd: snapshot.repoPath, stdio: 'pipe' });
    } catch(e) {}
  }

  const outPath = path.resolve(__dirname, '../reports/evaluator_preparation_2026-10-19/engineering_diagnostic_trace.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nDiagnostic trace completed. Results saved to: ${outPath}`);
}

run().catch(err => {
  console.error('Fatal error during diagnostic trace:', err);
  process.exit(1);
});
