const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const retrospectDir = path.resolve(__dirname, '..');

const { indexRepository, clearIndexCache } = require(path.join(retrospectDir, 'src/structural/index'));
const { StructuralRetriever } = require(path.join(retrospectDir, 'src/structural/retrieval/StructuralRetriever'));
const QueryProcessor = require(path.join(retrospectDir, 'src/structural/query/QueryProcessor'));
const HistoricalRetrievalAdapter = require(path.join(retrospectDir, 'src/retrieval/HistoricalRetrievalAdapter'));
const { fuseRRFv2 } = require(path.join(retrospectDir, 'src/retrieval/RRFv2'));
const { classifyOriginInWindow, stageAStatusFromWindow } = require(path.join(retrospectDir, 'src/git/historyWindow'));

function checkTargetMatch(candSymbol, target) {
  if (!candSymbol || !target) return false;

  const candPath = (candSymbol.filePath || '').replace(/\\/g, '/').toLowerCase();
  const tgtPath = (target.file_path || '').replace(/\\/g, '/').toLowerCase();
  const fileMatch = candPath.endsWith(tgtPath) || tgtPath.endsWith(candPath);
  if (!fileMatch) return false;

  const tgtName = target.symbol_name || '';
  const tgtShort = tgtName.split('.').pop();
  const candName = candSymbol.name || '';
  const candQName = candSymbol.qualifiedName || '';

  const nameMatch = candName === tgtShort ||
                    candName === tgtName ||
                    (candQName && (candQName === tgtName ||
                                   candQName.endsWith('.' + tgtShort) ||
                                   candQName.endsWith('.' + tgtName)));
  return !!nameMatch;
}

async function runWorker() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node evaluate_snapshot_worker.js <input.json> <output.json>');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { repoSlug, repoPath, pinSha, cases, searchHorizon = 50 } = input;

  console.log(`\n------------------------------------------------------------`);
  console.log(`Processing Snapshot: ${repoSlug} @ ${pinSha.substring(0, 10)} (${cases.length} cases)`);
  console.log(`------------------------------------------------------------`);

  // Detect default / original branch
  let originalBranch = 'main';
  try {
    const bOut = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath, stdio: 'pipe' }).toString().trim();
    if (bOut && bOut !== 'HEAD') originalBranch = bOut;
  } catch (e) {}

  // Checkout pinned commit
  console.log(`  Checking out ${pinSha.substring(0, 10)}...`);
  execFileSync('git', ['checkout', '--detach', pinSha], { cwd: repoPath, stdio: 'pipe' });

  try {
    // Structural Indexing
    const t0_struct = process.hrtime.bigint();
    clearIndexCache();
    const structuralIndex = await indexRepository(repoPath, { forceRebuild: true });
    const allSymbols = Array.from(structuralIndex.symbols.values());
    const t1_struct = process.hrtime.bigint();
    const structMs = Number(t1_struct - t0_struct) / 1e6;
    console.log(`  Structural Index: indexed ${allSymbols.length} symbols in ${(structMs / 1000).toFixed(2)}s`);

    // Historical Indexing (Merge-aware DAG traversal)
    const t0_hist = process.hrtime.bigint();
    const histAdapter = new HistoricalRetrievalAdapter();
    const histResult = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, {
      maxCommits: searchHorizon,
      startCommit: pinSha,
      firstParentOnly: false // Merge-aware default
    });
    const t1_hist = process.hrtime.bigint();
    const histMs = Number(t1_hist - t0_hist) / 1e6;
    console.log(`  Historical Index: analyzed ${histResult.profileMap.size} historical profiles in ${(histMs / 1000).toFixed(2)}s`);

    const snapshotMetadata = {
      repository_id: repoSlug,
      pin_sha: pinSha,
      symbol_count: allSymbols.length,
      historical_profiles_count: histResult.profileMap.size,
      struct_index_ms: parseFloat(structMs.toFixed(2)),
      hist_index_ms: parseFloat(histMs.toFixed(2)),
      case_count: cases.length
    };

    const candidates = allSymbols.map(sym => ({
      symbol: sym,
      historyProfile: histResult.profileMap.get(sym.id) || null
    }));

    const perCaseResults = [];

    // Evaluate each case in this snapshot
    for (const c of cases) {
      const q = QueryProcessor.process(c.query_text);

      let targetInPool = false;
      let targetHistoryProfile = null;

      for (const cand of candidates) {
        if (checkTargetMatch(cand.symbol, c.target)) {
          targetInPool = true;
          targetHistoryProfile = cand.historyProfile;
          break;
        }
      }

      // B1: Structural Only
      const t0_b1 = process.hrtime.bigint();
      const retriever = new StructuralRetriever(structuralIndex);
      const b1_raw = retriever.rankCandidates(q, allSymbols);
      b1_raw.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
      const t1_b1 = process.hrtime.bigint();
      const b1_lat = Number(t1_b1 - t0_b1) / 1e6;

      // B2: Historical Only
      const t0_b2 = process.hrtime.bigint();
      const b2_raw = histAdapter.rankHistoricalOnly(q, candidates, {}, { enforceCandidateParity: true });
      b2_raw.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
      const t1_b2 = process.hrtime.bigint();
      const b2_lat = Number(t1_b2 - t0_b2) / 1e6;

      // B3: Linear Combination (0.60 S / 0.40 H)
      const t0_b3 = process.hrtime.bigint();
      const sMap = new Map();
      b1_raw.forEach(r => sMap.set(r.symbol.id, r.score));
      const hMap = new Map();
      b2_raw.forEach(r => hMap.set(r.symbol.id, r.score));

      const b3_raw = candidates.map(cand => {
        const sScore = sMap.get(cand.symbol.id) || 0.0;
        const hScore = hMap.get(cand.symbol.id) || 0.0;
        const combined = HistoricalRetrievalAdapter.fuseScores(sScore, hScore, { structural: 0.60, historical: 0.40 });
        return {
          symbol: cand.symbol,
          score: combined,
          structuralScore: sScore,
          historicalScore: hScore
        };
      });
      b3_raw.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
      const t1_b3 = process.hrtime.bigint();
      const b3_lat = Number(t1_b3 - t0_b3) / 1e6;

      // B4: Channel-Balanced Cormack RRF-v2
      const t0_b4 = process.hrtime.bigint();
      const b4_raw = fuseRRFv2(
        candidates.map(cand => cand.symbol),
        b1_raw.map(r => ({ id: r.symbol.id, score: r.score })),
        b2_raw.map(r => ({ id: r.symbol.id, score: r.score })),
        { k: 60, weightStructural: 0.50, weightHistorical: 0.50 }
      );
      const t1_b4 = process.hrtime.bigint();
      const b4_lat = Number(t1_b4 - t0_b4) / 1e6;

      // Locate target in ranked lists
      const findRankAndScore = (list) => {
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const sym = item.symbol || item;
          const score = typeof item.score === 'number' ? item.score : 0.0;
          if (score > 0 && checkTargetMatch(sym, c.target)) {
            return { rank: i + 1, score: parseFloat(score.toFixed(4)) };
          }
        }
        return { rank: null, score: 0.0 };
      };

      const b1_res = findRankAndScore(b1_raw);
      const b2_res = findRankAndScore(b2_raw);
      const b3_res = findRankAndScore(b3_raw);
      const b4_res = findRankAndScore(b4_raw);

      // Stage A: Reachability, judged against the same window indexRepositoryHistory read above
      // (pinSha, merge-aware --topo-order, -n searchHorizon). commit_distance_k (rev-list count)
      // is kept as an informational field only.
      const dist = c.commit_distance_k;
      const evidenceDiscovered = !!(targetHistoryProfile && (
        (targetHistoryProfile.historicalNames && targetHistoryProfile.historicalNames.length > 0) ||
        (targetHistoryProfile.commitMessage && targetHistoryProfile.commitMessage.trim().length > 0) ||
        (targetHistoryProfile.diffText && targetHistoryProfile.diffText.trim().length > 0)
      ));

      const windowInfo = classifyOriginInWindow(repoPath, c.origin_commit, pinSha, searchHorizon, { firstParentOnly: false, topoOrder: true });
      let stageAStatus = stageAStatusFromWindow(windowInfo, evidenceDiscovered, searchHorizon).status;
      if (!c.origin_commit) {
        stageAStatus = 'STRUCTURAL_PILOT_NO_ORIGIN';
      }

      // Stage B: Detection
      let stageBMatchType = 'UNMATCHED';
      let isAmbiguous = false;
      let hasPred = false;
      if (targetHistoryProfile) {
        hasPred = Array.isArray(targetHistoryProfile.historicalNames) && targetHistoryProfile.historicalNames.length > 0;
        isAmbiguous = targetHistoryProfile.confidence === 'uncertain' || (hasPred && targetHistoryProfile.historicalNames.length > 1);
        if (hasPred) {
          const evo = (targetHistoryProfile.evolutionType || '').toLowerCase();
          if (evo === 'rename' || evo.includes('rename')) stageBMatchType = 'RENAMED_SYMBOL';
          else if (evo === 'extract' || evo.includes('extract')) stageBMatchType = 'EXTRACTED_METHOD';
          else stageBMatchType = 'EXACT_PREDECESSOR';
        }
        if (isAmbiguous) stageBMatchType = 'AMBIGUOUS';
      }

      // Outcome Categorization
      let outcome = 'Historical Unranked / Structural Dominant';
      if (b4_res.rank != null && b4_res.rank <= 10) {
        if (b2_res.rank != null && b2_res.rank <= 10) {
          outcome = 'Dual-Channel Top-10 Success';
        } else if (b2_res.score > 0) {
          outcome = 'Historical-Assisted Top-10 Success';
        } else {
          outcome = 'Structural-Only Top-10 Success';
        }
      } else if (b2_res.score > 0) {
        outcome = 'Historical Evidence Discovered (Rank > 10)';
      } else if (stageAStatus === 'OUTSIDE_SEARCH_HORIZON') {
        outcome = 'Outside Horizon (Safely Abstained)';
      } else if (c.cohort === 'quarantined_negative') {
        outcome = 'Quarantined Hard Negative';
      } else {
        outcome = 'Retrieval Failure (Unranked)';
      }

      perCaseResults.push({
        case_id: c.case_id,
        cohort: c.cohort,
        language: c.language,
        repository_id: c.repository_id,
        pin_sha: c.pin_sha,
        origin_commit: c.origin_commit,
        origin_commit_cluster: c.origin_commit || c.case_id,
        commit_distance_k: dist,
        query_text: c.query_text,
        target_symbol_name: c.target.symbol_name,
        target_file_path: c.target.file_path,
        target_in_pool: targetInPool,
        stage_a_status: stageAStatus,
        history_window_position: windowInfo.window_position,
        origin_is_ancestor: windowInfo.origin_is_ancestor,
        origin_diff_analyzed: windowInfo.origin_diff_analyzed,
        historical_evidence_discovered: evidenceDiscovered,
        stage_b_match_type: stageBMatchType,
        lineage_detected: hasPred && !isAmbiguous,
        is_ambiguous: isAmbiguous,
        b1_rank: b1_res.rank,
        b1_score: b1_res.score,
        b1_hit1: b1_res.rank === 1,
        b1_hit5: b1_res.rank != null && b1_res.rank <= 5,
        b1_hit10: b1_res.rank != null && b1_res.rank <= 10,
        b1_mrr: b1_res.rank ? parseFloat((1.0 / b1_res.rank).toFixed(4)) : 0.0,
        b2_rank: b2_res.rank,
        b2_score: b2_res.score,
        b2_hit1: b2_res.rank === 1,
        b2_hit5: b2_res.rank != null && b2_res.rank <= 5,
        b2_hit10: b2_res.rank != null && b2_res.rank <= 10,
        b2_mrr: b2_res.rank ? parseFloat((1.0 / b2_res.rank).toFixed(4)) : 0.0,
        b3_linear_rank: b3_res.rank,
        b3_linear_score: b3_res.score,
        b3_linear_hit1: b3_res.rank === 1,
        b3_linear_hit5: b3_res.rank != null && b3_res.rank <= 5,
        b3_linear_hit10: b3_res.rank != null && b3_res.rank <= 10,
        b3_linear_mrr: b3_res.rank ? parseFloat((1.0 / b3_res.rank).toFixed(4)) : 0.0,
        b4_rrf_rank: b4_res.rank,
        b4_rrf_score: b4_res.score,
        b4_rrf_hit1: b4_res.rank === 1,
        b4_rrf_hit5: b4_res.rank != null && b4_res.rank <= 5,
        b4_rrf_hit10: b4_res.rank != null && b4_res.rank <= 10,
        b4_rrf_mrr: b4_res.rank ? parseFloat((1.0 / b4_res.rank).toFixed(4)) : 0.0,
        b4_vs_b1_delta_rank: (b1_res.rank != null && b4_res.rank != null) ? (b1_res.rank - b4_res.rank) : null,
        latency_ms: {
          b1_ms: parseFloat(b1_lat.toFixed(3)),
          b2_ms: parseFloat(b2_lat.toFixed(3)),
          b3_ms: parseFloat(b3_lat.toFixed(3)),
          b4_ms: parseFloat(b4_lat.toFixed(3))
        },
        outcome_category: outcome
      });

      console.log(`    Case ${c.case_id.padEnd(20)} | B1: ${String(b1_res.rank).padStart(4)} | B2: ${String(b2_res.rank).padStart(4)} (s=${b2_res.score}) | B4: ${String(b4_res.rank).padStart(4)} | ${stageAStatus} | ${stageBMatchType}`);
    }

    fs.writeFileSync(outputPath, JSON.stringify({ perCaseResults, snapshotMetadata }, null, 2), 'utf8');

  } finally {
    // Restore clone original branch
    console.log(`  Restoring ${repoSlug} to ${originalBranch}...`);
    try {
      execFileSync('git', ['checkout', originalBranch], { cwd: repoPath, stdio: 'pipe' });
    } catch (e) {
      try { execFileSync('git', ['checkout', 'master'], { cwd: repoPath, stdio: 'pipe' }); } catch (e2) {}
    }
  }
}

runWorker().catch(err => {
  console.error('Snapshot worker error:', err);
  process.exit(1);
});
