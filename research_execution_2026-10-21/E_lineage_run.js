// E-Lineage: per-language lineage-attribution check (read-only).
// For each Phase B case with a target whose labelled evidence commit is inside the 50-commit window,
// does the history channel attach that commit to the labelled target symbol?
//   CORRECT       target profile contains the labelled commit
//   WRONG_COMMIT  target profile has history, but not the labelled commit
//   NO_COMMIT     target profile is empty (no history attached)
// Same code path and settings as the E2 worker (merge-aware, H=50). Reads the isolated clones at their
// pins (HEAD must equal the pin; nothing is checked out). Writes only into ./E_lineage/.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const R = path.resolve(__dirname, '..');
const { indexRepository, clearIndexCache } = require(path.join(R, 'src/structural/index'));
const HistoricalRetrievalAdapter = require(path.join(R, 'src/retrieval/HistoricalRetrievalAdapter'));
const { classifyOriginInWindow } = require(path.join(R, 'src/git/historyWindow'));

const OUT = path.join(__dirname, 'E_lineage');
const CLONES = 'D:/clones_eval_2026-10-22';
const REPO_DIRS = { bottle: 'phaseb_bottle', express: 'phaseb_express', gson: 'phaseb_gson', zod: 'phaseb_zod' };
const H = 50;

const git = (repo, args) => execFileSync('git', ['-c', 'core.longpaths=true', ...args], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

// Same message construction as GitHistoryReader.getCommit: `${subject}\n\n${body}`.trim()
function commitMessage(repo, sha) {
  const out = git(repo, ['show', '-s', '--format=%s%x1f%b', sha]);
  const [subject, body] = out.split('\x1f');
  return { subject: subject.trim(), message: `${subject.trim()}\n\n${(body || '').trim()}`.trim() };
}

function matchesTarget(sym, t) {
  const fp = (sym.filePath || '').replace(/\\/g, '/').toLowerCase();
  const tp = t.file_path.replace(/\\/g, '/').toLowerCase();
  const short = t.symbol_name.split('.').pop();
  const q = sym.qualifiedName || '';
  // Same rule as scratch/evaluate_snapshot_worker.js checkTargetMatch
  return (fp.endsWith(tp) || tp.endsWith(fp)) &&
    (sym.name === short || sym.name === t.symbol_name || (q && (q === t.symbol_name || q.endsWith('.' + short) || q.endsWith('.' + t.symbol_name))));
}

(async () => {
  if (fs.existsSync(OUT)) throw new Error(`refusing to overwrite ${OUT}`);
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'phase_b_input', 'phase_b_case_study_input.json'), 'utf8'));
  const byRepo = {};
  for (const c of cases) (byRepo[c.repository_id] = byRepo[c.repository_id] || []).push(c);

  const results = [];
  const snapshots = [];
  for (const [repoId, repoCases] of Object.entries(byRepo)) {
    const repo = path.join(CLONES, REPO_DIRS[repoId]);
    const pin = repoCases[0].source_revision_sha;
    if (git(repo, ['rev-parse', 'HEAD']) !== pin) throw new Error(`${repo} is not at pin ${pin}`);
    if (git(repo, ['status', '--porcelain']) !== '') throw new Error(`${repo} working tree not clean`);

    const inWindow = repoCases.map(c => ({ c, w: classifyOriginInWindow(repo, c.historical_evidence.origin_commit_sha, pin, H, { firstParentOnly: false, topoOrder: true }) }))
      .filter(x => x.w.status === 'IN_WINDOW');
    if (!inWindow.length) continue;

    clearIndexCache();
    const idx = await indexRepository(repo, { forceRebuild: true });
    const syms = Array.from(idx.symbols.values());
    const ha = new HistoricalRetrievalAdapter();
    const hist = await ha.indexRepositoryHistory(repo, syms, { maxCommits: H, startCommit: pin, firstParentOnly: false });
    const windowSubjects = new Map(git(repo, ['log', '--format=%H%x1f%s', '--topo-order', '-n', String(H), pin]).split('\n')
      .map(l => l.split('\x1f')).map(([h, s]) => [s.trim(), h]));
    snapshots.push({ repository: repoId, pin, symbols: syms.length, symbolsWithHistory: hist.stats && hist.stats.symbolsWithHistory, commitsAnalyzed: hist.stats && hist.stats.commitsAnalyzed });

    for (const { c, w } of inWindow) {
      const t = c.target_symbols[0];
      const ev = commitMessage(repo, c.historical_evidence.origin_commit_sha);
      const targets = syms.filter(s => matchesTarget(s, t));
      const perSymbol = targets.map(s => {
        const p = hist.profileMap.get(s.id) || {};
        const msgs = (p.commitMessage || '').trim();
        // A commit counts as attached when its exact subject is a line of the profile's messages
        // (substring matching would wrongly match revert commits that quote the subject).
        const lines = new Set(msgs.split(/\r?\n/).map(l => l.trim()));
        const hasLabelled = lines.has(ev.subject) && msgs.includes(ev.message);
        const attached = [...windowSubjects.keys()].filter(sub => lines.has(sub)).map(sub => windowSubjects.get(sub).slice(0, 10));
        return {
          symbol: `${s.qualifiedName || s.name}`, symbolType: s.symbolType, line: s.range.startLine,
          outcome: !msgs ? 'NO_COMMIT' : (hasLabelled ? 'CORRECT' : 'WRONG_COMMIT'),
          evolutionType: p.evolutionType || null, confidence: p.confidence || null,
          historyDepth: p.historyDepth || 0, historicalNames: p.historicalNames || [], attachedCommits: attached
        };
      });
      const best = perSymbol.find(x => x.outcome === 'CORRECT') || perSymbol.find(x => x.outcome === 'WRONG_COMMIT') || perSymbol[0];
      results.push({
        case_id: c.case_id, language: c.target_language, repository: repoId,
        evolution_type: c.phase_b_metadata.evolution_type, predecessor_name: c.phase_b_metadata.predecessor_name,
        labelled_commit: c.historical_evidence.origin_commit_sha.slice(0, 10), labelled_subject: ev.subject,
        window_position: w.window_position, labelled_commit_diffed: w.origin_diff_analyzed,
        target: t.symbol_name, target_symbols_found: targets.length,
        outcome: targets.length ? best.outcome : 'TARGET_NOT_INDEXED',
        ambiguous_target: targets.length > 1, per_symbol: perSymbol
      });
    }
  }

  fs.mkdirSync(OUT);
  fs.writeFileSync(path.join(OUT, 'e_lineage_results.json'), JSON.stringify({ config: { H, traversal: 'merge-aware --topo-order', clones: CLONES }, snapshots, results }, null, 2));
  const cols = ['case_id', 'language', 'repository', 'evolution_type', 'labelled_commit', 'window_position', 'labelled_commit_diffed', 'target', 'target_symbols_found', 'ambiguous_target', 'outcome'];
  fs.writeFileSync(path.join(OUT, 'e_lineage_results.csv'), [cols.join(','), ...results.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n') + '\n');

  const summary = {};
  for (const r of results) {
    const s = summary[r.language] = summary[r.language] || { N: 0, CORRECT: 0, WRONG_COMMIT: 0, NO_COMMIT: 0, TARGET_NOT_INDEXED: 0 };
    s.N++; s[r.outcome]++;
  }
  fs.writeFileSync(path.join(OUT, 'e_lineage_summary.json'), JSON.stringify(summary, null, 2));
  console.log('snapshots', JSON.stringify(snapshots));
  console.log('summary', JSON.stringify(summary));
  for (const r of results) {
    console.log(r.case_id.padEnd(12), r.language.padEnd(10), r.evolution_type.padEnd(20), 'pos', String(r.window_position).padStart(2), 'diffed', r.labelled_commit_diffed, '|', r.outcome,
      r.ambiguous_target ? `(targets ${r.target_symbols_found})` : '', '|', r.per_symbol.map(p => `${p.symbol}@${p.line}:${p.outcome}[${p.evolutionType},${p.confidence},depth ${p.historyDepth},${p.attachedCommits.join('/')}]`).join(' ; ').slice(0, 260));
  }
})().catch(e => { console.error(e); process.exit(1); });
