const path = require('path');
const { StructuralRetriever } = require('../structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../structural/query/QueryProcessor');
const HistoricalRetrievalAdapter = require('../retrieval/HistoricalRetrievalAdapter');
const { rankLineageGate } = require('../retrieval/LineageGate');

const byScoreThenId = (x, y) => y.score - x.score || (x.symbol.id || x.symbol.name).localeCompare(y.symbol.id || y.symbol.name);

/**
 * Rank with configuration G (lineage-match gate) over the persisted indexes. B1 and B2 are computed exactly as in the
 * evaluation harness (same ordering and tie-breaks); G is rankLineageGate on top of them.
 * @returns {{ results: Array, ids: string[], lineageMatches: number, totalCandidates: number }}
 */
function rankG(question, { structuralIndex, profileMap, lineage }, k) {
  const symbols = Array.from(structuralIndex.symbols.values());
  const q = QueryProcessor.process(question);
  const b1 = new StructuralRetriever(structuralIndex).rankCandidates(q, symbols).sort(byScoreThenId);
  const candidates = symbols.map(sym => ({ symbol: sym, historyProfile: profileMap.get(sym.id) || null }));
  const b2 = new HistoricalRetrievalAdapter().rankHistoricalOnly(q, candidates, {}, { enforceCandidateParity: true }).sort(byScoreThenId);
  const g = rankLineageGate(question, b1, b2, profileMap);
  const want = new Set(g.ids);
  const results = g.ranking.filter(x => x.score > 0).slice(0, k).map((x, i) => {
    const sym = x.symbol;
    const prof = profileMap.get(sym.id) || {};
    const historyMatch = i < g.lineageMatches;
    let formerly = null;
    if (historyMatch) {
      const matchedName = (prof.historicalNames || []).find(n => want.has(n));
      const rec = (lineage[sym.id] || []).find(r => r.oldName === matchedName) || null;
      formerly = { oldName: matchedName, commit: rec ? rec.commit : null, date: rec ? rec.date : null, subject: rec ? rec.subject : null,
        changeClassification: rec ? rec.changeClassification : null };
    }
    return {
      rank: i + 1,
      name: sym.name,
      qualifiedName: sym.qualifiedName || sym.name,
      kind: sym.symbolType,
      file: (sym.filePath || '').replace(/\\/g, '/'),
      line: sym.range ? sym.range.startLine : null,
      endLine: sym.range ? sym.range.endLine : null,
      score: Number(x.score.toFixed(4)),
      historyMatch,
      formerly,
      symbol: sym
    };
  });
  return { results, ids: g.ids, lineageMatches: g.lineageMatches, totalCandidates: symbols.length };
}

function formatResults(out) {
  if (!out.results.length) return 'No results.';
  const lines = [];
  for (const r of out.results) {
    lines.push(`${String(r.rank).padStart(2)}. ${r.qualifiedName}  ${r.file}:${r.line}`);
    if (r.formerly) {
      const when = r.formerly.commit ? ` (renamed in ${r.formerly.commit.slice(0, 7)}${r.formerly.date ? ', ' + r.formerly.date : ''})` : '';
      lines.push(`    formerly ${r.formerly.oldName}${when}`);
    }
  }
  return lines.join('\n');
}

function toJson(question, out, meta) {
  return {
    query: question,
    mode: out.lineageMatches > 0 ? 'lineage_gate' : 'structural',
    extractedIdentifiers: out.ids,
    lineageMatches: out.lineageMatches,
    indexedHead: meta && meta.indexedHead,
    results: out.results.map(({ symbol, ...r }) => r)
  };
}

module.exports = { rankG, formatResults, toJson };
