/**
 * Retrospect — Reciprocal Rank Fusion v2 (RRF-v2)
 *
 * Isolated, principled implementation of RRF with:
 * 1. Zero-Signal Gating: Channels only contribute if the candidate has positive evidence.
 * 2. Average Rank Tie-Breaking: Tied scores receive identical fractional/average ranks.
 * 3. No Artificial Fallback Ranks: Missing or unretrieved candidates contribute exactly 0.
 * 4. Deterministic Presentation: Alphabetical tie-breaking is applied strictly post-scoring.
 * 5. Input Sanitization: Non-finite (NaN, Infinity, -Infinity) and non-positive scores are rejected.
 * 6. Deduplication: Duplicate candidate IDs in score lists take the maximum finite score (max-pooling);
 *    duplicate candidate symbols in the candidate pool preserve the first occurrence.
 * 7. Strict Total Order: Sorting comparators enforce strict weak ordering without tolerance cycles;
 *    tolerance-based grouping is performed on monotonically sorted lists.
 *
 * Parameters (default):
 * - k = 60
 * - w_s = 0.60 (structural weight)
 * - w_h = 0.40 (historical weight)
 */

/**
 * Computes fractional (average) ranks for an array of scored items.
 * Tied scores receive the arithmetic mean of the ordinal positions they occupy.
 *
 * Example:
 * Items with scores [1.0, 0.8, 0.8, 0.5] occupy positions [1, 2, 3, 4].
 * - Score 1.0: rank 1.0
 * - Score 0.8: rank (2 + 3) / 2 = 2.5
 * - Score 0.5: rank 4.0
 *
 * @param {Array<{ id: string, score: number }>} items Items to rank (only finite score > 0 considered)
 * @param {object} [options]
 * @param {number} [options.epsilon=1e-9] Score equality tolerance for grouping
 * @returns {Map<string, { rank: number, score: number, tiedCount: number }>} Map of id -> rank info
 */
function computeAverageRanks(items, options = {}) {
  const epsilon = options.epsilon !== undefined ? options.epsilon : 1e-9;
  const rankMap = new Map();

  if (!items || items.length === 0) {
    return rankMap;
  }

  // Filter to positive evidence only: score must be a finite number > 0
  const positiveItems = items.filter(
    it => it && typeof it.score === 'number' && Number.isFinite(it.score) && it.score > 0
  );
  if (positiveItems.length === 0) {
    return rankMap;
  }

  // Deduplicate items by ID keeping maximum finite score if duplicate IDs exist in input
  const dedupedMap = new Map();
  for (const it of positiveItems) {
    const id = String(it.id || '').trim();
    if (!id) continue;
    if (!dedupedMap.has(id) || it.score > dedupedMap.get(id).score) {
      dedupedMap.set(id, { id, score: it.score });
    }
  }
  const uniqueItems = Array.from(dedupedMap.values());
  if (uniqueItems.length === 0) {
    return rankMap;
  }

  // Sort descending by score strictly. Deterministic ID sort breaks exact ties stably.
  // Using strict numeric inequality guarantees a strict total order, preventing comparator intransitivity cycles.
  const sorted = [...uniqueItems].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return String(a.id).localeCompare(String(b.id));
  });

  // Group contiguous items sharing the same score within epsilon
  let idx = 0;
  while (idx < sorted.length) {
    let groupEnd = idx + 1;
    while (
      groupEnd < sorted.length &&
      Math.abs(sorted[groupEnd].score - sorted[idx].score) <= epsilon
    ) {
      groupEnd++;
    }

    const tiedCount = groupEnd - idx;
    // 1-indexed ordinal range: startPos to endPos
    const startPos = idx + 1;
    const endPos = groupEnd;
    const avgRank = (startPos + endPos) / 2.0;

    for (let i = idx; i < groupEnd; i++) {
      rankMap.set(sorted[i].id, {
        rank: avgRank,
        score: sorted[i].score,
        tiedCount
      });
    }

    idx = groupEnd;
  }

  return rankMap;
}

/**
 * Normalizes input scores to a standard array of { id, score }.
 * Accepts Array<{ id, score }>, Array<{ symbol: { id }, score }>, or Map<id, number|object>.
 *
 * Chosen deduplication behavior:
 * If duplicate IDs are present, retains the entry with the highest finite score (max-pooling evidence).
 * Non-finite scores (NaN, Infinity, -Infinity) and non-positive scores are normalized to 0.
 *
 * @param {Array|Map} input 
 * @returns {Array<{ id: string, score: number, originalItem: object }>}
 */
function normalizeScoreList(input) {
  if (!input) return [];

  const candidateMap = new Map();

  if (input instanceof Map) {
    for (const [id, val] of input.entries()) {
      if (id === null || id === undefined) continue;
      const idStr = String(id).trim();
      if (!idStr) continue;

      let rawScore = 0;
      let originalItem = val;
      if (typeof val === 'number') {
        rawScore = val;
      } else if (val && typeof val === 'object' && typeof val.score === 'number') {
        rawScore = val.score;
      }
      const score = Number.isFinite(rawScore) && rawScore > 0 ? rawScore : 0;
      if (!candidateMap.has(idStr) || score > candidateMap.get(idStr).score) {
        candidateMap.set(idStr, { id: idStr, score, originalItem });
      }
    }
    return Array.from(candidateMap.values());
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item) continue;
      const rawId = item.id || (item.symbol && item.symbol.id) || (item.symbol && item.symbol.name) || item.name;
      if (rawId === null || rawId === undefined) continue;
      const idStr = String(rawId).trim();
      if (!idStr) continue;

      const rawScore = typeof item.score === 'number' ? item.score : 0;
      const score = Number.isFinite(rawScore) && rawScore > 0 ? rawScore : 0;
      if (!candidateMap.has(idStr) || score > candidateMap.get(idStr).score) {
        candidateMap.set(idStr, { id: idStr, score, originalItem: item });
      }
    }
    return Array.from(candidateMap.values());
  }

  return [];
}

/**
 * Fuses structural and historical evidence using RRF-v2.
 *
 * Scoring Rules:
 * - A channel contributes if and only if candidate has positive evidence in that channel (finite score > 0).
 * - Contribution_s = w_s / (k + rank_s) if sScore > 0 else 0.
 * - Contribution_h = w_h / (k + rank_h) if hScore > 0 else 0.
 * - Total Score = Contribution_s + Contribution_h.
 * - Candidates with no positive evidence in either channel receive score exactly 0.0.
 * - Ranks are fractional/average ranks so ties receive equal score contributions.
 * - Candidate pool deduplication: if duplicate candidate symbols are passed, the first occurrence is preserved.
 * - Presentation sorting: strictly descending by fused score; ties are broken alphabetically by ID without changing numeric scores.
 *
 * @param {Array<object>} candidates Full pool of candidate symbols: [{ id, name, ... }]
 * @param {Array|Map} structuralInput Structural retrieval outputs: [{ id, score }] or Map<id, score>
 * @param {Array|Map} historicalInput Historical retrieval outputs: [{ id, score }] or Map<id, score>
 * @param {object} [options] Configuration overrides
 * @param {number} [options.k=60] RRF smoothing constant
 * @param {number} [options.weightStructural=0.60] Structural weight
 * @param {number} [options.weightHistorical=0.40] Historical weight
 * @param {number} [options.epsilon=1e-9] Score equality tolerance for tie grouping
 * @returns {Array<object>} Fused candidates sorted descending by score with 1-indexed ranks
 */
function fuseRRFv2(candidates, structuralInput, historicalInput, options = {}) {
  const k = options.k !== undefined ? options.k : 60;
  const wS = options.weightStructural !== undefined ? options.weightStructural : 0.50;
  const wH = options.weightHistorical !== undefined ? options.weightHistorical : 0.50;
  const epsilon = options.epsilon !== undefined ? options.epsilon : 1e-9;

  // 1. Normalize and extract positive evidence lists
  const sList = normalizeScoreList(structuralInput);
  const hList = normalizeScoreList(historicalInput);

  // 2. Compute fractional average ranks for positive evidence only
  const sRankMap = computeAverageRanks(sList, { epsilon });
  const hRankMap = computeAverageRanks(hList, { epsilon });

  // Quick lookup for raw scores
  const sScoreMap = new Map(sList.map(item => [item.id, item.score]));
  const hScoreMap = new Map(hList.map(item => [item.id, item.score]));

  // Deduplicate candidate pool by unique symbol ID (first occurrence preserved)
  const seenCandidateIds = new Set();
  const pool = [];
  for (const cand of (Array.isArray(candidates) ? candidates : [])) {
    if (!cand) continue;
    const sym = cand.symbol || cand;
    const id = String(sym.id || sym.name || '').trim();
    if (!id) continue;
    if (seenCandidateIds.has(id)) continue;
    seenCandidateIds.add(id);
    pool.push(cand);
  }

  // 3. Compute channel contributions and fused scores
  const fused = pool.map(cand => {
    const sym = cand.symbol || cand;
    const id = String(sym.id || sym.name || '').trim();

    const sInfo = sRankMap.get(id);
    const hInfo = hRankMap.get(id);

    const sScore = sScoreMap.has(id) ? sScoreMap.get(id) : 0;
    const hScore = hScoreMap.has(id) ? hScoreMap.get(id) : 0;

    // Zero-signal gating: channel contributes if and only if positive evidence exists (finite score > 0)
    let sContrib = 0.0;
    let sRank = null;
    if (sInfo && typeof sInfo.score === 'number' && Number.isFinite(sInfo.score) && sInfo.score > 0) {
      sRank = sInfo.rank;
      sContrib = wS / (k + sRank);
    }

    let hContrib = 0.0;
    let hRank = null;
    if (hInfo && typeof hInfo.score === 'number' && Number.isFinite(hInfo.score) && hInfo.score > 0) {
      hRank = hInfo.rank;
      hContrib = wH / (k + hRank);
    }

    const fusedScore = sContrib + hContrib;

    return {
      symbol: sym,
      score: fusedScore,
      structuralScore: sScore,
      historicalScore: hScore,
      structuralRank: sRank,
      historicalRank: hRank,
      structuralContribution: sContrib,
      historicalContribution: hContrib,
      hasStructuralEvidence: sContrib > 0,
      hasHistoricalEvidence: hContrib > 0,
      hasAnyEvidence: fusedScore > 0,
      historyProfile: cand.historyProfile || null
    };
  });

  // 4. Deterministic sorting: descending strictly by fused score, alphabetical on ID for presentation ties.
  // Using strict numeric inequality guarantees a strict weak ordering without comparator cycles.
  fused.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const idA = String(a.symbol.id || a.symbol.name || '');
    const idB = String(b.symbol.id || b.symbol.name || '');
    return idA.localeCompare(idB);
  });

  // 5. Assign 1-indexed presentation ranks
  fused.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return fused;
}

module.exports = {
  computeAverageRanks,
  normalizeScoreList,
  fuseRRFv2,
  DEFAULT_RRF_V2_CONFIG: {
    k: 60,
    weightStructural: 0.50,
    weightHistorical: 0.50
  }
};
