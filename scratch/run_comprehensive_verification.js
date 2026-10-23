const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 1. Load Baseline QueryProcessor logic (from HEAD commit)
const baselineQPSource = execFileSync('git', ['show', 'HEAD:src/structural/query/QueryProcessor.js']).toString('utf8');
const baselineModule = { exports: {} };
const baselineFn = new Function('module', 'exports', baselineQPSource);
baselineFn(baselineModule, baselineModule.exports);
const BaselineQueryProcessor = baselineModule.exports;

// 2. Load Modified QueryProcessor (from current working tree)
const ModifiedQueryProcessor = require('../src/structural/query/QueryProcessor');

// 3. Load retrieval modules
const clonesDir = 'D:/clones';
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
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

async function runVerification() {
  console.log('================================================================================');
  console.log('      INDEPENDENT VERIFICATION OF QUERY-PROCESSING EXPERIMENT (8 CASES)         ');
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

    const snapshot = { folder, commit, origBranch, repoPath, structuralIndex, allSymbols, candidates, histAdapter };
    snapshotCache.set(key, snapshot);
    return snapshot;
  }

  function evaluateRun(qp, runName) {
    const runResults = [];

    for (const c of diagnosticCases) {
      const snapshot = snapshotCache.get(`${c.folder}::${c.pin}`);
      const retriever = new StructuralRetriever(snapshot.structuralIndex);
      const q = qp.process(c.query);

      // B1: Structural
      const t0_b1 = Date.now();
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

      // B3 Normalized: Active-Channel Normalized Linear
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

      // B4 Baseline (Legacy Asymmetric RRF-v2: 0.60 / 0.40)
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

      // B4 Improved (Balanced Cormack RRF: 0.50 / 0.50)
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

      runResults.push({
        id: c.id,
        name: c.name,
        repo: c.repo,
        query: c.query,
        target: c.target,
        queryTerms: q.terms,
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
        latencies: { b1: lat_b1, b2: lat_b2, b3: lat_b3, b4: lat_b4 }
      });
    }

    return runResults;
  }

  // Pre-load all 4 repository snapshots
  for (const c of diagnosticCases) {
    await getSnapshot(c.folder, c.pin);
  }

  // Save current modified methods before switching to baseline for Run A
  const savedModifiedProcess = ModifiedQueryProcessor.process;
  const savedModifiedSplit = ModifiedQueryProcessor.splitIdentifiers;

  console.log('\nEvaluating Run A: Baseline Unmodified QueryProcessor (at HEAD)...');
  ModifiedQueryProcessor.process = BaselineQueryProcessor.process;
  ModifiedQueryProcessor.splitIdentifiers = BaselineQueryProcessor.splitIdentifiers;
  const baselineResults = evaluateRun(BaselineQueryProcessor, 'Baseline');

  console.log('Evaluating Run B: Current Modified QueryProcessor (with compound & action rules)...');
  ModifiedQueryProcessor.process = savedModifiedProcess;
  ModifiedQueryProcessor.splitIdentifiers = savedModifiedSplit;
  const modifiedResults = evaluateRun(ModifiedQueryProcessor, 'Modified');

  // Restore git branches
  for (const snapshot of snapshotCache.values()) {
    try {
      execFileSync('git', ['checkout', snapshot.origBranch], { cwd: snapshot.repoPath, stdio: 'pipe' });
    } catch(e) {}
  }

  // Compute metrics with exact denominator = 8
  function computeSummaryMetrics(results, channelKey) {
    const N = results.length; // 8
    let s1 = 0, s5 = 0, s10 = 0, mrr = 0, abstained = 0;

    for (const r of results) {
      const rank = r[channelKey];
      if (rank !== null && rank !== undefined && rank > 0) {
        if (rank <= 1) s1++;
        if (rank <= 5) s5++;
        if (rank <= 10) s10++;
        mrr += 1.0 / rank;
      } else {
        abstained++;
      }
    }

    return {
      N,
      s1: s1 / N,
      s5: s5 / N,
      s10: s10 / N,
      s1_count: s1,
      s5_count: s5,
      s10_count: s10,
      mrr: mrr / N,
      abstained
    };
  }

  const channels = ['b1_rank', 'b2_rank', 'b3_rank', 'b3_norm_rank', 'b4_legacy_rank', 'b4_improved_rank'];
  const summaryComparison = {};

  for (const ch of channels) {
    summaryComparison[ch] = {
      baseline: computeSummaryMetrics(baselineResults, ch),
      modified: computeSummaryMetrics(modifiedResults, ch)
    };
  }

  // Save verification data artifact
  const outDir = path.resolve(__dirname, '../reports/query_processing_verification_2026-10-20');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outData = {
    timestamp: new Date().toISOString(),
    baseline_commit: '17ea399217737f8d5fe2c32c310b69c2f812b84d',
    caseCount: diagnosticCases.length,
    baselineResults,
    modifiedResults,
    summaryComparison
  };

  fs.writeFileSync(path.join(outDir, 'verification_data.json'), JSON.stringify(outData, null, 2), 'utf8');
  console.log(`\nVerification data written to: ${path.join(outDir, 'verification_data.json')}`);

  // Print Case Comparison Table
  console.log('\n================================================================================');
  console.log('             CASE-LEVEL BEFORE VS AFTER RECONSTRUCTION TABLE                    ');
  console.log('================================================================================');
  console.log('| Case ID | Baseline B1 | Modified B1 | Baseline B2 | Modified B2 | Baseline B4 | Modified B4 |');
  console.log('|---|---|---|---|---|---|---|');
  for (let i = 0; i < diagnosticCases.length; i++) {
    const b = baselineResults[i];
    const m = modifiedResults[i];
    console.log(`| ${b.id} | ${b.b1_rank ?? 'null'} (${b.b1_score.toFixed(4)}) | ${m.b1_rank ?? 'null'} (${m.b1_score.toFixed(4)}) | ${b.b2_rank ?? 'null'} (${b.b2_score.toFixed(4)}) | ${m.b2_rank ?? 'null'} (${m.b2_score.toFixed(4)}) | ${b.b4_improved_rank ?? 'null'} (${b.b4_improved_score.toFixed(4)}) | ${m.b4_improved_rank ?? 'null'} (${m.b4_improved_score.toFixed(4)}) |`);
  }

  // Print Aggregate Metrics Table
  console.log('\n================================================================================');
  console.log('               AGGREGATE METRICS RECONSTRUCTION TABLE (N=8)                     ');
  console.log('================================================================================');
  console.log('| Channel | Metric | Baseline (Run A) | Modified (Run B) | Absolute Diff | Relative Diff |');
  console.log('|---|---|---|---|---|---|');

  for (const ch of channels) {
    const base = summaryComparison[ch].baseline;
    const mod = summaryComparison[ch].modified;
    const chName = ch.replace('_rank', '').toUpperCase();

    const mrrDiff = mod.mrr - base.mrr;
    const mrrRel = base.mrr > 0 ? ((mrrDiff / base.mrr) * 100).toFixed(1) + '%' : 'N/A';
    console.log(`| ${chName} | MRR | ${base.mrr.toFixed(4)} | ${mod.mrr.toFixed(4)} | ${mrrDiff >= 0 ? '+' : ''}${mrrDiff.toFixed(4)} | ${mrrRel} |`);
    console.log(`| ${chName} | Success@1 | ${base.s1.toFixed(3)} (${base.s1_count}/${base.N}) | ${mod.s1.toFixed(3)} (${mod.s1_count}/${mod.N}) | ${(mod.s1 - base.s1) >= 0 ? '+' : ''}${(mod.s1 - base.s1).toFixed(3)} | - |`);
    console.log(`| ${chName} | Success@5 | ${base.s5.toFixed(3)} (${base.s5_count}/${base.N}) | ${mod.s5.toFixed(3)} (${mod.s5_count}/${mod.N}) | ${(mod.s5 - base.s5) >= 0 ? '+' : ''}${(mod.s5 - base.s5).toFixed(3)} | - |`);
    console.log(`| ${chName} | Success@10 | ${base.s10.toFixed(3)} (${base.s10_count}/${base.N}) | ${mod.s10.toFixed(3)} (${mod.s10_count}/${mod.N}) | ${(mod.s10 - base.s10) >= 0 ? '+' : ''}${(mod.s10 - base.s10).toFixed(3)} | - |`);
    console.log(`| ${chName} | Abstentions | ${base.abstained} / ${base.N} | ${mod.abstained} / ${mod.N} | ${mod.abstained - base.abstained} | - |`);
  }
}

runVerification().catch(console.error);
