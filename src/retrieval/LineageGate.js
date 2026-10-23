/**
 * Lineage-match gate (configuration G) and deterministic identifier extraction.
 *
 * A separate retrieval mode: B1-B4 are unchanged. G has no parameters.
 *
 * ids(q):
 *   (a) the contents of `backticks`, if any; otherwise
 *   (b) tokens matching [A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*(\(\))? that contain a lower->upper case change, an
 *       underscore, a dot, or a trailing (); otherwise
 *   (c) the whole query, if it is a single token.
 *   Each identifier has a trailing () stripped; for dotted names both the full form and the last segment are kept.
 *
 * G: L = the B2 candidates (in B2 order, positive B2 score) whose inherited historical simple names contain any element
 *    of ids(q) (exact, case-sensitive). If L is empty, G is the B1 ranking unchanged; otherwise G is L followed by the
 *    B1 ranking with L removed.
 */

const TOKEN_RE = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\))?/g;
const FULL_TOKEN_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\))?$/;

function expand(raw, out) {
  let id = String(raw).trim();
  if (id.endsWith('()')) id = id.slice(0, -2);
  if (!id) return;
  if (!out.includes(id)) out.push(id);
  if (id.includes('.')) {
    const last = id.split('.').pop();
    if (last && !out.includes(last)) out.push(last);
  }
}

function looksLikeIdentifier(tok) {
  return /[a-z][A-Z]/.test(tok) || tok.includes('_') || tok.includes('.') || tok.endsWith('()');
}

/**
 * Deterministic identifier extraction from a query.
 * @param {string} q
 * @returns {string[]} identifiers in order of first appearance (no duplicates)
 */
function extractIdentifiers(q) {
  if (typeof q !== 'string') return [];
  const out = [];
  const ticks = [...q.matchAll(/`([^`]+)`/g)].map(m => m[1].trim()).filter(Boolean);
  if (ticks.length) {
    ticks.forEach(t => expand(t, out));
    return out;
  }
  const toks = (q.match(TOKEN_RE) || []).filter(looksLikeIdentifier);
  if (toks.length) {
    toks.forEach(t => expand(t, out));
    return out;
  }
  const whole = q.trim();
  if (whole && !/\s/.test(whole) && FULL_TOKEN_RE.test(whole)) expand(whole, out);
  return out;
}

const symId = s => (s && (s.symbol ? s.symbol.id : s.id));

/**
 * Configuration G.
 * @param {string} query
 * @param {Array<{symbol: object, score: number}>} b1Ranked  B1 ranking (sorted, best first)
 * @param {Array<{symbol: object, score: number}>} b2Ranked  B2 ranking (sorted, best first)
 * @param {Map<string, object>|function} historyProfiles     symbolId -> history profile (with historicalNames), or a lookup fn
 * @returns {{ ranking: Array<{symbol: object, score: number}>, ids: string[], lineageMatches: number }}
 *   L entries carry positive scores above every B1 score (so rank cut-offs treat them as retrieved); the rest keep
 *   their B1 scores, so a target unretrieved by B1 and absent from L stays unretrieved.
 */
function rankLineageGate(query, b1Ranked, b2Ranked, historyProfiles) {
  const b1 = Array.isArray(b1Ranked) ? b1Ranked : [];
  const b2 = Array.isArray(b2Ranked) ? b2Ranked : [];
  let ids = [];
  try { ids = extractIdentifiers(query); } catch { ids = []; }
  const profileOf = id => {
    try {
      if (!historyProfiles) return null;
      if (typeof historyProfiles === 'function') return historyProfiles(id);
      if (typeof historyProfiles.get === 'function') return historyProfiles.get(id);
      return historyProfiles[id] || null;
    } catch { return null; }
  };
  const L = [];
  if (ids.length) {
    const want = new Set(ids);
    const seen = new Set();
    for (const item of b2) {
      const id = symId(item);
      if (!item || !(typeof item.score === 'number' && item.score > 0) || id == null || seen.has(id)) continue;
      const names = ((profileOf(id) || {}).historicalNames) || [];
      if (Array.isArray(names) && names.some(n => want.has(n))) { L.push(item); seen.add(id); }
    }
  }
  if (!L.length) return { ranking: b1, ids, lineageMatches: 0 };
  const inL = new Set(L.map(symId));
  const top = b1.reduce((m, x) => Math.max(m, typeof x.score === 'number' ? x.score : 0), 0);
  const ranking = L.map((x, i) => ({ symbol: x.symbol || x, score: top + (L.length - i) }))
    .concat(b1.filter(x => !inL.has(symId(x))));
  return { ranking, ids, lineageMatches: L.length };
}

module.exports = { extractIdentifiers, rankLineageGate };
