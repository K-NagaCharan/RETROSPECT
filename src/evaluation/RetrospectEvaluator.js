/**
 * RetrospectEvaluator.js - Robust, benchmark-agnostic evaluation harness for Retrospect.
 *
 * Implements:
 * 1. Strict split discipline via SplitGuard (blocks sealed test cases unless explicitly permitted).
 * 2. Benchmark-agnostic loading via BenchmarkCaseLoader.
 * 3. 3-Stage Historical Evaluation:
 *    - Stage A: Reachability (Git DAG, search budget, evidence extraction).
 *    - Stage B: Detection (Lineage relationship detection, predecessor matching, ambiguity).
 *    - Stage C: Ranking (Target rank, Success@10, Recall@1, Recall@5, MRR, Abstention across B1-B4).
 * 4. Standardized latency measurement under amortized pre-indexed conditions.
 * 5. Cluster bootstrap resampling over origin-commit clusters with 95% CIs and paired comparisons.
 * 6. Stratified reporting across historical identifiers and commit distance bands.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const BenchmarkCaseLoader = require('./BenchmarkCaseLoader');
const { SplitGuard } = require('./SplitGuard');
const ClusterBootstrap = require('./ClusterBootstrap');
const { indexRepository } = require('../structural/index');
const { StructuralRetriever } = require('../structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../structural/query/QueryProcessor');
const HistoricalRetrievalAdapter = require('../retrieval/HistoricalRetrievalAdapter');
const { fuseRRFv2 } = require('../retrieval/RRFv2');
const { classifyOriginInWindow, stageAStatusFromWindow } = require('../git/historyWindow');

class RetrospectEvaluator {
  /**
   * @param {object} [options]
   * @param {string} [options.clonesDir='D:/clones'] Directory of authentic git clones.
   * @param {number} [options.searchHorizon=50] Maximum commit lookback window for historical retrieval.
   * @param {boolean} [options.allowSealedTest=false] Flag allowing sealed test evaluation.
   * @param {boolean} [options.verifyGitTree=true] Whether to verify commit SHAs and target files in Git.
   * @param {string} [options.targetSplit=null] Split filter ('dev', 'val').
   * @param {number} [options.bootstrapReplicates=1000] Number of bootstrap iterations.
   * @param {number} [options.confidenceLevel=0.95] Confidence level for bootstrap CIs.
   */
  constructor(options = {}) {
    this.clonesDir = options.clonesDir || 'D:/clones';
    this.searchHorizon = options.searchHorizon !== undefined ? options.searchHorizon : 50;
    this.allowSealedTest = options.allowSealedTest === true;
    this.verifyGitTree = options.verifyGitTree !== false;
    this.targetSplit = options.targetSplit ? options.targetSplit.toLowerCase() : null;
    this.bootstrapReplicates = options.bootstrapReplicates || 1000;
    this.confidenceLevel = options.confidenceLevel || 0.95;

    this.loader = new BenchmarkCaseLoader({
      clonesDir: this.clonesDir,
      verifyGitTree: this.verifyGitTree,
      allowSealedTest: this.allowSealedTest,
      targetSplit: this.targetSplit
    });

    this.snapshotCache = new Map();
  }

  /**
   * Resolves repository folder path from slug or name.
   * @param {string} repoSlug
   * @returns {string|null}
   */
  resolveRepoPath(repoSlug) {
    return this.loader.resolveRepoPath(repoSlug);
  }

  /**
   * Checks whether a candidate symbol matches the ground-truth target.
   * Matches on normalized file path, symbol name, and parameter types without Retrospect-internal IDs.
   * @param {object} cand Candidate symbol
   * @param {object} target Ground truth target
   * @returns {boolean}
   */
  static isTargetMatch(cand, target) {
    if (!cand || !target) return false;

    // 1. File path match
    const normCandPath = (cand.filePath || '').replace(/\\/g, '/').toLowerCase();
    const normTarget = (target.file_path || '').replace(/\\/g, '/').toLowerCase();
    const fileMatch = normCandPath.endsWith(normTarget) || normTarget.endsWith(normCandPath);
    if (!fileMatch) return false;

    // 2. Symbol name match
    const targetName = target.symbol_name || '';
    const targetShort = targetName.split('.').pop();
    const candName = cand.name || '';
    const candQName = cand.qualifiedName || '';

    const nameMatch = candName === targetShort ||
                      candName === targetName ||
                      (candQName && (candQName === targetName ||
                                     candQName.endsWith('.' + targetShort) ||
                                     candQName.endsWith('.' + targetName)));
    if (!nameMatch) return false;

    // 3. Optional parameter check if both candidate and target specify parameters
    if (Array.isArray(target.parameter_types) && target.parameter_types.length > 0 &&
        Array.isArray(cand.parameterTypes) && cand.parameterTypes.length > 0) {
      if (cand.parameterTypes.length !== target.parameter_types.length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtains or builds an amortized snapshot (structural index + historical profile map)
   * for a given repository folder and pinned commit.
   * @param {string} repoSlug
   * @param {string} commit
   * @returns {Promise<object>}
   */
  async getOrBuildSnapshot(repoSlug, commit) {
    const repoPath = this.resolveRepoPath(repoSlug);
    if (!repoPath) {
      throw new Error(`Repository clone for '${repoSlug}' not found in '${this.clonesDir}'.`);
    }

    const key = `${repoPath}::${commit}`;
    if (this.snapshotCache.has(key)) {
      return this.snapshotCache.get(key);
    }

    // Determine current git branch / HEAD
    let originalBranch = 'master';
    try {
      const branchOut = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath, stdio: 'pipe' }).toString().trim();
      if (branchOut && branchOut !== 'HEAD') {
        originalBranch = branchOut;
      }
    } catch (e) {
      // ignore
    }

    // Detach to pinned commit
    execFileSync('git', ['checkout', '--detach', commit], { cwd: repoPath, stdio: 'pipe' });

    try {
      const t0_structIndex = process.hrtime.bigint();
      const structuralIndex = await indexRepository(repoPath, { forceRebuild: true });
      const allSymbols = Array.from(structuralIndex.symbols.values());
      const t1_structIndex = process.hrtime.bigint();
      const amortizedStructIndexMs = Number(t1_structIndex - t0_structIndex) / 1e6;

      const t0_histIndex = process.hrtime.bigint();
      const histAdapter = new HistoricalRetrievalAdapter();
      const histResult = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, {
        maxCommits: this.searchHorizon,
        startCommit: commit
      });
      const t1_histIndex = process.hrtime.bigint();
      const amortizedHistIndexMs = Number(t1_histIndex - t0_histIndex) / 1e6;

      const snapshot = {
        repoSlug,
        repoPath,
        commit,
        originalBranch,
        structuralIndex,
        allSymbols,
        histAdapter,
        profileMap: histResult.profileMap,
        candidates: allSymbols.map(sym => ({
          symbol: sym,
          historyProfile: histResult.profileMap.get(sym.id) || null
        })),
        amortized_indexing: {
          structural_index_ms: parseFloat(amortizedStructIndexMs.toFixed(2)),
          historical_index_ms: parseFloat(amortizedHistIndexMs.toFixed(2)),
          total_index_ms: parseFloat((amortizedStructIndexMs + amortizedHistIndexMs).toFixed(2)),
          symbol_count: allSymbols.length
        }
      };

      this.snapshotCache.set(key, snapshot);
      return snapshot;
    } catch (err) {
      try {
        execFileSync('git', ['checkout', originalBranch], { cwd: repoPath, stdio: 'pipe' });
      } catch (e) {
        // ignore
      }
      throw err;
    }
  }

  /**
   * Evaluates Stage A: Historical Reachability
   * @param {string} repoPath
   * @param {string|null} originCommit
   * @param {string} pinSha
   * @param {number|null} commitDistance
   * @param {object|null} targetHistoryProfile
   * @returns {object}
   */
  evaluateStageA(repoPath, originCommit, pinSha, commitDistance, targetHistoryProfile) {
    const evidenceDiscovered = !!(targetHistoryProfile && (
      (targetHistoryProfile.historicalNames && targetHistoryProfile.historicalNames.length > 0) ||
      (targetHistoryProfile.commitMessage && targetHistoryProfile.commitMessage.trim().length > 0) ||
      (targetHistoryProfile.diffText && targetHistoryProfile.diffText.trim().length > 0)
    ));

    if (repoPath && originCommit) {
      // Same window that indexRepositoryHistory reads for this pin (merge-aware, --topo-order, -n H).
      const win = classifyOriginInWindow(repoPath, originCommit, pinSha, this.searchHorizon, { firstParentOnly: false, topoOrder: true });
      const mapped = stageAStatusFromWindow(win, evidenceDiscovered, this.searchHorizon);
      return {
        origin_in_dag: win.origin_exists === true,
        origin_within_budget: win.in_window,
        historical_evidence_discovered: evidenceDiscovered,
        commit_distance: win.rev_list_distance != null ? win.rev_list_distance : commitDistance,
        search_horizon: this.searchHorizon,
        reachability_status: mapped.status,
        reason: mapped.reason,
        origin_is_ancestor: win.origin_is_ancestor,
        history_window_position: win.window_position,
        origin_diff_analyzed: win.origin_diff_analyzed,
        horizon_basis: 'retrieval_window'
      };
    }

    // No repository (simulated / unit-test mode): the window cannot be computed, so fall back to the
    // supplied distance. This path is never taken by evaluateCase, which always passes the snapshot path.
    let originInDag = false;
    if (originCommit && /^[0-9a-f]{40}$/i.test(originCommit)) {
      originInDag = true;
    }

    const distance = commitDistance;
    const withinBudget = distance != null ? distance <= this.searchHorizon : false;

    let reachabilityStatus = 'REACHABLE';
    let reason = 'Origin commit exists in DAG, is within the lookback window, and historical evidence was extracted.';

    if (!originCommit) {
      reachabilityStatus = 'NO_ORIGIN_SPECIFIED';
      reason = 'No origin_commit specified in case metadata.';
    } else if (!originInDag) {
      reachabilityStatus = 'NOT_IN_DAG';
      reason = `Origin commit ${originCommit.substring(0, 10)} does not exist in repository Git DAG.`;
    } else if (!withinBudget) {
      reachabilityStatus = 'OUTSIDE_SEARCH_HORIZON';
      reason = `Commit distance (${distance}) exceeds configured search horizon of ${this.searchHorizon} commits.`;
    } else if (!evidenceDiscovered) {
      reachabilityStatus = 'NO_HISTORICAL_EVIDENCE';
      reason = 'Origin commit is in DAG and search budget, but no relevant commit message or diff evidence was extracted for target.';
    }

    return {
      origin_in_dag: originInDag,
      origin_within_budget: withinBudget,
      historical_evidence_discovered: evidenceDiscovered,
      commit_distance: distance,
      search_horizon: this.searchHorizon,
      reachability_status: reachabilityStatus,
      reason,
      origin_is_ancestor: null,
      history_window_position: null,
      origin_diff_analyzed: null,
      horizon_basis: 'supplied_distance_no_repository'
    };
  }

  /**
   * Evaluates Stage B: Historical Detection
   * @param {object|null} targetHistoryProfile
   * @returns {object}
   */
  evaluateStageB(targetHistoryProfile) {
    if (!targetHistoryProfile) {
      return {
        detected: false,
        match_type: 'UNMATCHED',
        evidence: 'No historical profile found for target symbol.',
        ambiguity_flag: false
      };
    }

    const hasPred = Array.isArray(targetHistoryProfile.historicalNames) && targetHistoryProfile.historicalNames.length > 0;
    const isAmbiguous = targetHistoryProfile.confidence === 'uncertain' ||
                        (hasPred && targetHistoryProfile.historicalNames.length > 1);

    let matchType = 'UNMATCHED';
    if (hasPred) {
      const evo = (targetHistoryProfile.evolutionType || '').toLowerCase();
      if (evo === 'rename' || evo.includes('rename')) {
        matchType = 'RENAMED_SYMBOL';
      } else if (evo === 'extract' || evo.includes('extract')) {
        matchType = 'EXTRACTED_METHOD';
      } else {
        matchType = 'EXACT_PREDECESSOR';
      }
    }

    let evidenceStr = 'No matching historical evidence found';
    if (targetHistoryProfile.commitMessage) {
      evidenceStr = `Commit: "${targetHistoryProfile.commitMessage.substring(0, 80).replace(/\r?\n/g, ' ')}" | Names: ${JSON.stringify(targetHistoryProfile.historicalNames || [])}`;
    } else if (targetHistoryProfile.diffText) {
      evidenceStr = `Diff modifications observed | Names: ${JSON.stringify(targetHistoryProfile.historicalNames || [])}`;
    }

    return {
      detected: hasPred && !isAmbiguous,
      match_type: isAmbiguous ? 'AMBIGUOUS' : (hasPred ? matchType : 'UNMATCHED'),
      evidence: evidenceStr,
      ambiguity_flag: isAmbiguous
    };
  }

  /**
   * Evaluates Stage C: Candidate Ranking across B1, B2, B3, B4
   * @param {boolean} targetInPool
   * @param {Array<object>} b1Ranked
   * @param {Array<object>} b2Ranked
   * @param {Array<object>} b3Fused
   * @param {Array<object>} b4Fused
   * @param {object} target Ground truth target
   * @returns {object}
   */
  evaluateStageC(targetInPool, b1Ranked, b2Ranked, b3Fused, b4Fused, target) {
    const evalConfig = (rankedList) => {
      let rank = null;
      let score = 0.0;

      for (let i = 0; i < rankedList.length; i++) {
        const item = rankedList[i];
        const sym = item.symbol || item;
        const s = typeof item.score === 'number' ? item.score : 0.0;
        if (s > 0 && RetrospectEvaluator.isTargetMatch(sym, target)) {
          rank = i + 1;
          score = s;
          break;
        }
      }

      const hit10 = rank !== null && rank <= 10;
      const hit1 = rank === 1;
      const hit5 = rank !== null && rank <= 5;
      const mrr = rank ? parseFloat((1.0 / rank).toFixed(4)) : 0.0;
      const abstained = rank === null || score === 0.0;

      return {
        rank,
        score: parseFloat(score.toFixed(4)),
        hit_at_1: hit1,
        hit_at_5: hit5,
        hit_at_10: hit10,
        mrr,
        abstained
      };
    };

    return {
      target_present_in_candidates: targetInPool,
      b1_structural: evalConfig(b1Ranked),
      b2_historical: evalConfig(b2Ranked),
      b3_linear: evalConfig(b3Fused),
      b4_rrf: evalConfig(b4Fused)
    };
  }

  /**
   * Evaluates a single canonical case against an amortized snapshot.
   * @param {object} c Normalized canonical case
   * @param {object} snapshot
   * @returns {object} Per-case evaluation record
   */
  evaluateCase(c, snapshot) {
    // 1. Check target presence in candidate pool
    let targetInPool = false;
    let targetHistoryProfile = null;

    for (const cand of snapshot.candidates) {
      if (RetrospectEvaluator.isTargetMatch(cand.symbol, c.target)) {
        targetInPool = true;
        targetHistoryProfile = cand.historyProfile;
        break;
      }
    }

    // 2. Query processing
    const q = QueryProcessor.process(c.query);

    // 3. Configuration B1: Structural Only
    const t0_b1 = process.hrtime.bigint();
    const retriever = new StructuralRetriever(snapshot.structuralIndex);
    const b1_ranked = retriever.rankCandidates(q, snapshot.allSymbols);
    b1_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const t1_b1 = process.hrtime.bigint();
    const t_struct = Number(t1_b1 - t0_b1) / 1e6;

    // 4. Configuration B2: Historical Only
    const t0_b2 = process.hrtime.bigint();
    const b2_ranked = snapshot.histAdapter.rankHistoricalOnly(q, snapshot.candidates, {}, { enforceCandidateParity: true });
    b2_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const t1_b2 = process.hrtime.bigint();
    const t_hist = Number(t1_b2 - t0_b2) / 1e6;

    // 5. Configuration B3: Linear Combination (0.60 S / 0.40 H)
    const t0_b3 = process.hrtime.bigint();
    const sMap = new Map();
    b1_ranked.forEach(r => sMap.set(r.symbol.id, r.score));
    const hMap = new Map();
    b2_ranked.forEach(r => hMap.set(r.symbol.id, r.score));

    const b3_fused = snapshot.candidates.map(cand => {
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
    b3_fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const t1_b3 = process.hrtime.bigint();
    const t_fusion_linear = Number(t1_b3 - t0_b3) / 1e6;

    // 6. Configuration B4: RRF-v2 with Zero-Signal Gating
    const t0_b4 = process.hrtime.bigint();
    const b4_fused = fuseRRFv2(
      snapshot.candidates.map(cand => cand.symbol),
      b1_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      b2_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      { k: 60, weightStructural: 0.50, weightHistorical: 0.50 }
    );
    const t1_b4 = process.hrtime.bigint();
    const t_fusion_rrf = Number(t1_b4 - t0_b4) / 1e6;

    // 7. Latency breakdown under standardized measurement boundary
    const latencyBreakdown = {
      b1_structural: {
        total_ms: parseFloat(t_struct.toFixed(3)),
        t_struct_ms: parseFloat(t_struct.toFixed(3)),
        t_hist_ms: 0.0,
        t_fusion_ms: 0.0
      },
      b2_historical: {
        total_ms: parseFloat(t_hist.toFixed(3)),
        t_struct_ms: 0.0,
        t_hist_ms: parseFloat(t_hist.toFixed(3)),
        t_fusion_ms: 0.0
      },
      b3_linear: {
        total_ms: parseFloat((t_struct + t_hist + t_fusion_linear).toFixed(3)),
        t_struct_ms: parseFloat(t_struct.toFixed(3)),
        t_hist_ms: parseFloat(t_hist.toFixed(3)),
        t_fusion_ms: parseFloat(t_fusion_linear.toFixed(3))
      },
      b4_rrf: {
        total_ms: parseFloat((t_struct + t_hist + t_fusion_rrf).toFixed(3)),
        t_struct_ms: parseFloat(t_struct.toFixed(3)),
        t_hist_ms: parseFloat(t_hist.toFixed(3)),
        t_fusion_ms: parseFloat(t_fusion_rrf.toFixed(3))
      }
    };

    // 8. Evaluate 3 stages
    const stageA = this.evaluateStageA(snapshot.repoPath, c.origin_commit, c.pin_sha, c.commit_distance_origin_to_pin, targetHistoryProfile);
    const stageB = this.evaluateStageB(targetHistoryProfile);
    const stageC = this.evaluateStageC(targetInPool, b1_ranked, b2_ranked, b3_fused, b4_fused, c.target);

    return {
      case_id: c.case_id,
      origin_commit: c.origin_commit,
      origin_commit_cluster: c.origin_commit || c.case_id,
      repo: c.repo,
      pin_sha: c.pin_sha,
      split: c.split,
      language: c.language,
      category: c.category,
      query: c.query,
      target: c.target,
      contains_historical_identifier: c.contains_historical_identifier,
      commit_distance_origin_to_pin: c.commit_distance_origin_to_pin,
      stage_a_reachability: stageA,
      stage_b_detection: stageB,
      stage_c_ranking: stageC,
      latency: latencyBreakdown,
      top_candidates: {
        b1: b1_ranked.slice(0, 5).map(r => ({ name: r.symbol.name, score: parseFloat(r.score.toFixed(4)) })),
        b2: b2_ranked.slice(0, 5).map(r => ({ name: r.symbol.name, score: parseFloat(r.score.toFixed(4)) })),
        b4: b4_fused.slice(0, 5).map(r => ({ name: (r.symbol ? r.symbol.name : r.name), score: parseFloat(r.score.toFixed(4)) }))
      }
    };
  }

  /**
   * Computes commit distance stratum for a given numeric distance.
   * Strata: [0, 50], [51, 150], [151, 500], > 500
   * @param {number|null} dist
   * @returns {string}
   */
  static getDistanceStratum(dist) {
    if (dist == null || typeof dist !== 'number') return 'UNKNOWN';
    if (dist <= 50) return '[0, 50]';
    if (dist <= 150) return '[51, 150]';
    if (dist <= 500) return '[151, 500]';
    return '> 500';
  }

  /**
   * Evaluates an entire dataset (file path or array) across all four configurations.
   * @param {string|Array<object>} source
   * @returns {Promise<object>} Complete evaluation output
   */
  async evaluate(source) {
    const { validCases, excludedCases, summary: loadSummary } = this.loader.load(source);

    // Group valid cases by repo and pin SHA for amortized snapshot reuse
    const snapshotGroups = new Map();
    for (const c of validCases) {
      const groupKey = `${c.repo}::${c.pin_sha}`;
      if (!snapshotGroups.has(groupKey)) {
        snapshotGroups.set(groupKey, []);
      }
      snapshotGroups.get(groupKey).push(c);
    }

    const perCaseResults = [];
    const evaluationErrors = [];

    for (const [groupKey, cases] of snapshotGroups.entries()) {
      const [repoSlug, commit] = groupKey.split('::');
      let snapshot = null;
      try {
        snapshot = await this.getOrBuildSnapshot(repoSlug, commit);
      } catch (err) {
        for (const c of cases) {
          evaluationErrors.push({
            case_id: c.case_id,
            error_type: 'SNAPSHOT_BUILD_FAILURE',
            reason: `Failed to build snapshot for ${repoSlug} at ${commit}: ${err.message}`
          });
        }
        continue;
      }

      for (const c of cases) {
        try {
          const caseRes = this.evaluateCase(c, snapshot);
          perCaseResults.push(caseRes);
        } catch (err) {
          evaluationErrors.push({
            case_id: c.case_id,
            error_type: 'CASE_EXECUTION_FAILURE',
            reason: err.message
          });
        }
      }
    }

    // Restore repositories to original branches if detached
    for (const snapshot of this.snapshotCache.values()) {
      try {
        execFileSync('git', ['checkout', snapshot.originalBranch], { cwd: snapshot.repoPath, stdio: 'pipe' });
      } catch (e) {
        // ignore
      }
    }

    // Statistical aggregation & cluster bootstrap
    const configs = ['b1_structural', 'b2_historical', 'b3_linear', 'b4_rrf'];
    const metricsSummary = {};

    const buildMetricDataset = (cfgKey) => {
      return perCaseResults.map(r => ({
        case_id: r.case_id,
        origin_commit: r.origin_commit || r.case_id,
        target_rank: r.stage_c_ranking[cfgKey].rank,
        target_score: r.stage_c_ranking[cfgKey].score,
        abstained: r.stage_c_ranking[cfgKey].abstained
      }));
    };

    const configDataSets = {};
    for (const cfg of configs) {
      configDataSets[cfg] = buildMetricDataset(cfg);
    }

    for (const cfg of configs) {
      const ds = configDataSets[cfg];
      const count = ds.length;

      const s10Hits = ds.filter(d => d.target_rank != null && d.target_rank <= 10).length;
      const r1Hits = ds.filter(d => d.target_rank === 1).length;
      const r5Hits = ds.filter(d => d.target_rank != null && d.target_rank <= 5).length;
      const abstentions = ds.filter(d => d.abstained).length;
      const mrrSum = ds.reduce((acc, d) => acc + (d.target_rank ? 1.0 / d.target_rank : 0.0), 0);

      // Bootstrap statistics
      const s10Boot = count > 0 ? ClusterBootstrap.bootstrap(ds, 'success@10', {
        replicates: this.bootstrapReplicates,
        confidence: this.confidenceLevel
      }) : null;

      const r1Boot = count > 0 ? ClusterBootstrap.bootstrap(ds, 'recall@1', {
        replicates: this.bootstrapReplicates,
        confidence: this.confidenceLevel
      }) : null;

      const r5Boot = count > 0 ? ClusterBootstrap.bootstrap(ds, 'recall@5', {
        replicates: this.bootstrapReplicates,
        confidence: this.confidenceLevel
      }) : null;

      const mrrBoot = count > 0 ? ClusterBootstrap.bootstrap(ds, 'mrr', {
        replicates: this.bootstrapReplicates,
        confidence: this.confidenceLevel
      }) : null;

      const abstBoot = count > 0 ? ClusterBootstrap.bootstrap(ds, 'abstention_rate', {
        replicates: this.bootstrapReplicates,
        confidence: this.confidenceLevel
      }) : null;

      metricsSummary[cfg] = {
        success_at_10: {
          numerator: s10Hits,
          denominator: count,
          percentage: count > 0 ? parseFloat(((s10Hits / count) * 100).toFixed(2)) : 0.0,
          bootstrap: s10Boot
        },
        recall_at_1: {
          numerator: r1Hits,
          denominator: count,
          percentage: count > 0 ? parseFloat(((r1Hits / count) * 100).toFixed(2)) : 0.0,
          bootstrap: r1Boot
        },
        recall_at_5: {
          numerator: r5Hits,
          denominator: count,
          percentage: count > 0 ? parseFloat(((r5Hits / count) * 100).toFixed(2)) : 0.0,
          bootstrap: r5Boot
        },
        mrr: {
          mean: count > 0 ? parseFloat((mrrSum / count).toFixed(4)) : 0.0,
          bootstrap: mrrBoot
        },
        abstention: {
          numerator: abstentions,
          denominator: count,
          percentage: count > 0 ? parseFloat(((abstentions / count) * 100).toFixed(2)) : 0.0,
          bootstrap: abstBoot
        }
      };
    }

    // Paired configuration comparisons against B1
    const pairedDifferences = {};
    const comparisons = [
      ['b4_rrf', 'b1_structural', 'B4_vs_B1'],
      ['b4_rrf', 'b2_historical', 'B4_vs_B2'],
      ['b4_rrf', 'b3_linear', 'B4_vs_B3'],
      ['b3_linear', 'b1_structural', 'B3_vs_B1'],
      ['b2_historical', 'b1_structural', 'B2_vs_B1']
    ];

    for (const [cfgA, cfgB, label] of comparisons) {
      if (perCaseResults.length > 0) {
        pairedDifferences[label] = ClusterBootstrap.bootstrapPaired(
          configDataSets[cfgA],
          configDataSets[cfgB],
          'success@10',
          { replicates: this.bootstrapReplicates, confidence: this.confidenceLevel }
        );
      }
    }

    // Cluster inventory
    const clusterMap = ClusterBootstrap.buildClusters(perCaseResults);
    const clusterInventory = {
      total_eligible_cases: perCaseResults.length,
      distinct_origin_clusters: clusterMap.size,
      warning: clusterMap.size < 15
        ? `Warning: Only ${clusterMap.size} independent origin-commit clusters available (minimum recommended: 15). Bootstrap uncertainty estimates are descriptive only.`
        : null,
      clusters: Array.from(clusterMap.entries()).map(([key, items]) => ({
        cluster_key: key,
        case_count: items.length,
        case_ids: items.map(it => it.case_id),
        repo: items[0].repo,
        language: items[0].language
      }))
    };

    // Stratified Analysis: Historical Identifier Presence
    const strataHistId = {
      contains_historical_identifier: perCaseResults.filter(r => r.contains_historical_identifier === true),
      does_not_contain_historical_identifier: perCaseResults.filter(r => r.contains_historical_identifier !== true)
    };

    // Stratified Analysis: Commit Distance Bands
    const strataDistance = {
      '[0, 50]': perCaseResults.filter(r => RetrospectEvaluator.getDistanceStratum(r.commit_distance_origin_to_pin) === '[0, 50]'),
      '[51, 150]': perCaseResults.filter(r => RetrospectEvaluator.getDistanceStratum(r.commit_distance_origin_to_pin) === '[51, 150]'),
      '[151, 500]': perCaseResults.filter(r => RetrospectEvaluator.getDistanceStratum(r.commit_distance_origin_to_pin) === '[151, 500]'),
      '> 500': perCaseResults.filter(r => RetrospectEvaluator.getDistanceStratum(r.commit_distance_origin_to_pin) === '> 500')
    };

    const computeStratumMetrics = (casesSubset) => {
      const n = casesSubset.length;
      if (n === 0) return { count: 0, clusters: 0, b1_success_at_10: '0/0 (0.00%)', b4_success_at_10: '0/0 (0.00%)' };
      const clusters = ClusterBootstrap.buildClusters(casesSubset).size;
      const b1Hits = casesSubset.filter(c => c.stage_c_ranking.b1_structural.hit_at_10).length;
      const b4Hits = casesSubset.filter(c => c.stage_c_ranking.b4_rrf.hit_at_10).length;
      return {
        count: n,
        clusters,
        b1_success_at_10: `${b1Hits}/${n} (${((b1Hits / n) * 100).toFixed(2)}%)`,
        b4_success_at_10: `${b4Hits}/${n} (${((b4Hits / n) * 100).toFixed(2)}%)`
      };
    };

    const stratifiedReport = {
      by_historical_identifier: {
        contains_historical_identifier: computeStratumMetrics(strataHistId.contains_historical_identifier),
        does_not_contain_historical_identifier: computeStratumMetrics(strataHistId.does_not_contain_historical_identifier)
      },
      by_commit_distance_band: {
        '[0, 50]': computeStratumMetrics(strataDistance['[0, 50]']),
        '[51, 150]': computeStratumMetrics(strataDistance['[51, 150]']),
        '[151, 500]': computeStratumMetrics(strataDistance['[151, 500]']),
        '> 500': computeStratumMetrics(strataDistance['> 500'])
      }
    };

    return {
      run_metadata: {
        timestamp: new Date().toISOString(),
        frozen_commit: '17ea399217737f8d5fe2c32c310b69c2f812b84d',
        status: 'BENCHMARK_PREPARATION_DIAGNOSTIC',
        search_horizon: this.searchHorizon,
        allow_sealed_test: this.allowSealedTest,
        target_split: this.targetSplit || 'all_unsealed',
        bootstrap_replicates: this.bootstrapReplicates,
        confidence_level: this.confidenceLevel
      },
      loader_summary: loadSummary,
      metrics_summary: metricsSummary,
      paired_differences: pairedDifferences,
      cluster_inventory: clusterInventory,
      stratified_report: stratifiedReport,
      per_case_results: perCaseResults,
      excluded_cases: [...excludedCases, ...evaluationErrors]
    };
  }

  /**
   * Generates a CSV string representation of per-case results.
   * @param {Array<object>} perCaseResults
   * @returns {string}
   */
  static generateCSV(perCaseResults) {
    const headers = [
      'case_id',
      'origin_commit',
      'origin_commit_cluster',
      'repo',
      'language',
      'category',
      'split',
      'contains_hist_id',
      'commit_distance',
      'stage_a_status',
      'stage_b_match_type',
      'b1_rank',
      'b1_score',
      'b1_lat_ms',
      'b2_rank',
      'b2_score',
      'b2_lat_ms',
      'b3_rank',
      'b3_score',
      'b3_lat_ms',
      'b4_rank',
      'b4_score',
      'b4_lat_ms'
    ];

    const rows = [headers.join(',')];

    for (const r of perCaseResults) {
      const row = [
        `"${r.case_id}"`,
        `"${r.origin_commit || ''}"`,
        `"${r.origin_commit_cluster || ''}"`,
        `"${r.repo}"`,
        `"${r.language}"`,
        `"${r.category}"`,
        `"${r.split}"`,
        r.contains_historical_identifier ? 'true' : 'false',
        r.commit_distance_origin_to_pin != null ? r.commit_distance_origin_to_pin : '',
        `"${r.stage_a_reachability.reachability_status}"`,
        `"${r.stage_b_detection.match_type}"`,
        r.stage_c_ranking.b1_structural.rank != null ? r.stage_c_ranking.b1_structural.rank : '',
        r.stage_c_ranking.b1_structural.score,
        r.latency.b1_structural.total_ms,
        r.stage_c_ranking.b2_historical.rank != null ? r.stage_c_ranking.b2_historical.rank : '',
        r.stage_c_ranking.b2_historical.score,
        r.latency.b2_historical.total_ms,
        r.stage_c_ranking.b3_linear.rank != null ? r.stage_c_ranking.b3_linear.rank : '',
        r.stage_c_ranking.b3_linear.score,
        r.latency.b3_linear.total_ms,
        r.stage_c_ranking.b4_rrf.rank != null ? r.stage_c_ranking.b4_rrf.rank : '',
        r.stage_c_ranking.b4_rrf.score,
        r.latency.b4_rrf.total_ms
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

module.exports = RetrospectEvaluator;
