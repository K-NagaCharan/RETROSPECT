const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { indexRepository, clearIndexCache, StructuralIndex } = require('../structural');
const HistoricalRetrievalAdapter = require('../retrieval/HistoricalRetrievalAdapter');
const { writeJson, readJson, readProjectConfig, PROJECT_DEFAULTS } = require('./config');

/**
 * On-disk index store in <repo>/.retrospect/:
 *   config.json            project config (history, k, tokenBudget)
 *   structural-index.json  StructuralIndex.save() output
 *   history.json           history profiles (as built by HistoricalRetrievalAdapter) + captured lineage records
 *   meta.json              indexed HEAD, timings and counts
 */
const DIR = '.retrospect';

class NotGitRepoError extends Error {
  constructor(cwd) {
    super(`Not inside a git repository: ${cwd}\nRetrospect indexes a repository's code and git history; run it from inside a git working tree.`);
    this.name = 'NotGitRepoError';
  }
}

class NotInitialisedError extends Error {
  constructor() {
    super('Not initialised — run: rtro init');
    this.name = 'NotInitialisedError';
  }
}

function git(cwd, args) {
  return execFileSync('git', ['-c', 'core.longpaths=true', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function repoRoot(cwd) {
  try {
    return path.resolve(git(cwd, ['rev-parse', '--show-toplevel']));
  } catch {
    throw new NotGitRepoError(cwd);
  }
}

function headOf(root) {
  try {
    return git(root, ['rev-parse', 'HEAD']);
  } catch {
    return null; // repository without commits
  }
}

const paths = root => {
  const dir = path.join(root, DIR);
  return { dir, config: path.join(dir, 'config.json'), structural: path.join(dir, 'structural-index.json'), history: path.join(dir, 'history.json'), meta: path.join(dir, 'meta.json') };
};

function isInitialised(root) {
  const p = paths(root);
  return fs.existsSync(p.meta) && fs.existsSync(p.structural) && fs.existsSync(p.history);
}

/** Add ".retrospect/" to the repository's info/exclude (never edits tracked files). Returns true if a line was added. */
function ensureExcluded(root) {
  const rel = git(root, ['rev-parse', '--git-path', 'info/exclude']);
  const excludePath = path.isAbsolute(rel) ? rel : path.join(root, rel);
  fs.mkdirSync(path.dirname(excludePath), { recursive: true });
  const current = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  if (current.split(/\r?\n/).some(l => l.trim() === `${DIR}/`)) return false;
  fs.writeFileSync(excludePath, current + (current && !current.endsWith('\n') ? '\n' : '') + `${DIR}/\n`);
  return true;
}

/**
 * HistoricalRetrievalAdapter subclass that records, per current symbol, the lineage records returned by the
 * (unchanged) stitchLineage method, so the CLI can cite the commit behind a former name. Ranking is not affected.
 */
class LineageCapturingAdapter extends HistoricalRetrievalAdapter {
  constructor(options) {
    super(options);
    this.capturedLineage = new Map();
  }

  stitchLineage(sym, evolutionMap, commitIndexMap, options) {
    const records = super.stitchLineage(sym, evolutionMap, commitIndexMap, options);
    if (records && records.length) {
      this.capturedLineage.set(sym.id, records.map(r => ({
        commit: r.childCommit,
        oldName: r.predecessorSymbol ? r.predecessorSymbol.name : null,
        oldQualifiedName: r.predecessorSymbol ? r.predecessorSymbol.qualifiedName || null : null,
        oldFile: r.predecessorSymbol ? r.predecessorSymbol.filePath || null : null,
        changeClassification: r.changeClassification,
        subject: (r.commitMessage || '').split(/\r?\n/)[0]
      })));
    }
    return records;
  }
}

function commitDates(root, shas) {
  const out = {};
  for (const sha of shas) {
    try { out[sha] = git(root, ['show', '-s', '--format=%cs', sha]); } catch { out[sha] = null; }
  }
  return out;
}

/**
 * Build (or rebuild) both indexes and persist them. Returns the meta object.
 * @param {string} root repository root
 * @param {object} [opts] { history: window size, log: function }
 */
async function buildIndexes(root, opts = {}) {
  const p = paths(root);
  fs.mkdirSync(p.dir, { recursive: true });
  const cfg = readProjectConfig(p.dir);
  const history = opts.history || cfg.history || PROJECT_DEFAULTS.history;
  const head = headOf(root);
  const log = opts.log || (() => {});

  const t0 = Date.now();
  clearIndexCache();
  const structuralIndex = await indexRepository(root, { forceRebuild: true });
  const symbols = Array.from(structuralIndex.symbols.values());
  const structuralSeconds = (Date.now() - t0) / 1000;
  log(`structural index: ${symbols.length} symbols in ${structuralIndex.files.size} files (${structuralSeconds.toFixed(1)}s)`);

  const t1 = Date.now();
  let profiles = {}, lineage = {}, stats = { commitsAnalyzed: 0, symbolsWithHistory: 0, extractionFailures: { count: 0, firstError: null } };
  if (head) {
    const adapter = new LineageCapturingAdapter();
    const res = await adapter.indexRepositoryHistory(root, symbols, { maxCommits: history, startCommit: head, firstParentOnly: false });
    for (const [id, prof] of res.profileMap) profiles[id] = prof;
    lineage = Object.fromEntries(adapter.capturedLineage);
    stats = res.stats;
  }
  const shas = [...new Set(Object.values(lineage).flat().map(r => r.commit).filter(Boolean))];
  const dates = commitDates(root, shas);
  for (const recs of Object.values(lineage)) for (const r of recs) r.date = dates[r.commit] || null;
  const historySeconds = (Date.now() - t1) / 1000;
  log(`history index: ${stats.commitsAnalyzed} commits analysed, ${stats.symbolsWithHistory} symbols with history (${historySeconds.toFixed(1)}s, window ${history})`);

  structuralIndex.save(p.structural);
  writeJson(p.history, { historyWindow: history, head, profiles, lineage });
  const meta = {
    indexedHead: head, builtAt: new Date().toISOString(), historyWindow: history,
    counts: { symbols: symbols.length, files: structuralIndex.files.size, commitsAnalyzed: stats.commitsAnalyzed, symbolsWithHistory: stats.symbolsWithHistory },
    extractionFailures: { structural: structuralIndex.extractionFailures || null, history: stats.extractionFailures || null },
    timings: { structuralSeconds, historySeconds }
  };
  writeJson(p.meta, meta);
  if (!fs.existsSync(p.config)) writeJson(p.config, { ...PROJECT_DEFAULTS, history });
  return meta;
}

/** Load the persisted indexes. */
function loadIndexes(root) {
  const p = paths(root);
  if (!isInitialised(root)) throw new NotInitialisedError();
  const structuralIndex = StructuralIndex.load(p.structural);
  const hist = readJson(p.history, {});
  const profileMap = new Map(Object.entries(hist.profiles || {}));
  return { structuralIndex, profileMap, lineage: hist.lineage || {}, meta: readJson(p.meta, {}) };
}

/** Fresh/stale status: stale when the current HEAD differs from the indexed HEAD. */
function freshness(root) {
  const meta = readJson(paths(root).meta, null);
  const current = headOf(root);
  return { indexedHead: meta ? meta.indexedHead : null, currentHead: current, stale: !!meta && meta.indexedHead !== current };
}

module.exports = {
  DIR, paths, repoRoot, headOf, isInitialised, ensureExcluded, buildIndexes, loadIndexes, freshness,
  LineageCapturingAdapter, NotGitRepoError, NotInitialisedError
};
