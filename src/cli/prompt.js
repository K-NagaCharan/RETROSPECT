const ContextBuilder = require('../structural/context/ContextBuilder');

const SYSTEM = [
  'You are Retrospect, a code assistant that answers questions about a repository and its history.',
  'Answer only from the provided context (CURRENT CODE and HISTORICAL EVIDENCE). Do not use outside knowledge about this codebase.',
  'If the context is insufficient to answer, say so explicitly and state what is missing.',
  'Clearly distinguish current code (what exists now) from former names (what a symbol used to be called).',
  'Cite file paths (path:line) for every claim about current code, and commit shas for claims about history.'
].join('\n');

/**
 * Assemble the prompt from G's ranked results.
 * @param {string} question
 * @param {Array} ranked results from rankG (each with .symbol, .score, .formerly)
 * @param {object} opts { k, tokenBudget, lineage }
 * @returns {{ system: string, user: string, context: object, sources: Array }}
 */
function buildPrompt(question, ranked, opts = {}) {
  const k = opts.k || 5;
  const lineage = opts.lineage || {};
  const context = ContextBuilder.buildContext(ranked.map(r => ({ symbol: r.symbol, score: r.score })), { maxResults: k, tokenBudget: opts.tokenBudget || 4000 });
  const byId = new Map(ranked.map(r => [r.symbol.id, r]));

  const current = context.results.map((b, i) => {
    const loc = `${(b.filePath || '').replace(/\\/g, '/')}:${b.range.startLine}-${b.range.endLine}`;
    return [`[${i + 1}] ${b.qualifiedName || b.name} (${b.kind || 'symbol'}) — ${loc}`, '```', (b.source || '').trimEnd(), '```'].join('\n');
  });

  const evidence = [];
  const sources = [];
  for (const b of context.results) {
    const r = byId.get(b.symbolId);
    const file = (b.filePath || '').replace(/\\/g, '/');
    const src = { file, line: b.range.startLine, name: b.qualifiedName || b.name, commit: null };
    const recs = (lineage[b.symbolId] || []).filter(x => x.oldName && x.oldName !== b.name);
    const chosen = r && r.formerly && r.formerly.oldName ? recs.filter(x => x.oldName === r.formerly.oldName) : recs;
    for (const x of chosen.slice(0, 3)) {
      evidence.push(`- ${x.oldName} → ${b.qualifiedName || b.name} (${file}); commit ${x.commit ? x.commit.slice(0, 12) : 'unknown'}${x.date ? ', ' + x.date : ''}; "${x.subject || ''}"`);
      if (!src.commit && x.commit) src.commit = x.commit;
    }
    sources.push(src);
  }

  const user = [
    'QUESTION',
    question,
    '',
    'CURRENT CODE',
    current.length ? current.join('\n\n') : '(no matching code found)',
    '',
    'HISTORICAL EVIDENCE',
    evidence.length ? evidence.join('\n') : '(no rename or move history for these symbols in the indexed window)'
  ].join('\n');

  return { system: SYSTEM, user, context, sources };
}

function formatSources(sources) {
  return ['Sources:', ...sources.map(s => `- ${s.file}:${s.line} (${s.name})${s.commit ? ` — history: commit ${s.commit.slice(0, 7)}` : ''}`)].join('\n');
}

module.exports = { SYSTEM, buildPrompt, formatSources };
