#!/usr/bin/env node
/**
 * Phase 2: externally grounded 4-language rename case set (deterministic, resumable).
 *
 *   node build_external_cases.js collect   per repository: clone, find candidate events, choose one (seeded), pin, check
 *   node build_external_cases.js s3b       only for languages below the minimum: second pass over unselected S3 repos (S3b)
 *   node build_external_cases.js freeze    write cases/cases.jsonl, cases/MANIFEST.sha256.json, cases/exclusion_log.csv,
 *                                          cases/review_sheet.csv, cases/funnel.json; check out each clone at its pin
 *
 * Sources: S1 RefactoringMiner oracle (Java, TP Rename Method / Move And Rename Method); S2 PyRef oracle (Python, TP Rename
 * Method); S3 developer-attested renames in commit messages (Python/JavaScript/TypeScript catalog repos, alphabetical);
 * S3b fallback (message has "rename" + NEW). Similarity = the miner's multiset Jaccard over identifier tokens
 * (mine_events.js; verify_events.py only reads the miner's recorded similarity). Seed 20261023.
 * Resume: one result file per repository in cases/work/<lang>/<repo>.json (written last); a clone without its
 * .retrospect_clone_ok marker is moved aside to <dir>.incomplete-<ts> and re-cloned.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const R = 'D:/base papers considered/Retrospect';
const FunctionExtractor = require(path.join(R, 'src/parser/FunctionExtractor'));
const { classifyOriginInWindow } = require(path.join(R, 'src/git/historyWindow'));

const W = path.resolve(__dirname, '..');
const CLONES = 'D:/clones_external';
const SEED = '20261023';
const TARGET = 12, MIN_PER_LANG = 8, MIN_TOTAL = 36, H = 400;
const MAX_CLONE_BYTES = 1.5 * 1024 ** 3, CLONE_TIMEOUT_MS = 10 * 60 * 1000;
const LANGS = ['java', 'python', 'javascript', 'typescript'];
const EXT = { java: ['.java'], python: ['.py'], javascript: ['.js', '.jsx', '.mjs', '.cjs'], typescript: ['.ts', '.tsx', '.mts', '.cts'] };
const GREP_GLOBS = { java: ['*.java'], python: ['*.py'], javascript: ['*.js', '*.jsx', '*.mjs', '*.cjs'], typescript: ['*.ts', '*.tsx', '*.mts', '*.cts'] };
// Production-only: union of mine_events.js NONPROD and verify_events.py NONPROD_EXTRA (copied, unchanged).
const NONPROD = /(^|\/)(tests?|__tests__|spec|specs|testing|test-data|testdata|fixtures?|examples?|docs?|benchmarks?|bench|node_modules|dist|build|vendor|third_party|scripts)(\/|$)|\.d\.ts$|(_test|\.test|\.spec)\.\w+$|(^|\/)test_[^/]+\.py$/i;
const NONPROD_EXTRA = /(^|\/)(min|docs_src|npm-package|integration-tests?|tasks|bin|gallery)(\/|$)|(^|\/)src\/it\/|\.min\.js$|IT\.java$/;
const GENERATED = /(^|\/)(generated|gen|__generated__)(\/|$)|\.generated\.\w+$|_pb2\.py$|\.pb\.\w+$/i;
// Pre-freeze refinement (2026-10-23, before any benchmark run): demo/story files and build tooling are not production code.
const DEMO_TOOLING = /\.stories\.\w+$|(^|\/)(tooling|stories|storybook)(\/|$)/i;
const CALLABLE = new Set(['function', 'method', 'arrow_function']);
const NL_TEMPLATES = ['Where is the function OLD now?', 'What happened to OLD after the refactor?', 'Show me the current code for `OLD`.'];
const S3_GREPS = ['rename', 'renamed', 'renaming', '->', '→'];

// ---- similarity (copied from mine_events.js, unchanged) ----
const KEYWORDS = new Set(('abstract and as assert async await boolean break byte case catch char class const continue def default del do double elif else enum except '
  + 'export extends False final finally float for from function global if implements import in instanceof int interface is lambda let long new None nonlocal '
  + 'not null of or package pass private protected public raise return self short static super switch synchronized this throw throws transient True try '
  + 'typeof var void volatile while with yield true false undefined').split(' '));
function tokens(src, selfName) {
  const out = (src.match(/[A-Za-z_$][A-Za-z0-9_$]*|\d+/g) || []).filter(t => t !== selfName && !KEYWORDS.has(t));
  const bag = new Map();
  for (const t of out) bag.set(t, (bag.get(t) || 0) + 1);
  return { bag, n: out.length };
}
function jaccard(a, b) {
  let inter = 0;
  for (const [t, c] of a.bag) if (b.bag.has(t)) inter += Math.min(c, b.bag.get(t));
  const union = a.n + b.n - inter;
  return union ? inter / union : 0;
}
// ---- query helpers (copied from build_cases.js, unchanged) ----
function firstSentence(doc) {
  if (!doc) return null;
  const text = doc.replace(/^[\s/*#"'`]+|[\s*/"'`]+$/g, '').replace(/^\s*[*#]\s?/gm, '').replace(/@\w+.*$/gms, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const s = (text.match(/^.*?[.!?](\s|$)/) || [text])[0].trim();
  const words = s.split(' ');
  if (words.length < 4) return null;
  return words.slice(0, 30).join(' ');
}
const subtokens = n => (n || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_$]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);

// ---- utilities ----
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const norm = u => { const m = (u || '').toLowerCase().replace(/\.git$/, '').replace(/\/$/, '').match(/github\.com[:/]([^/]+\/[^/]+)$/); return m ? m[1] : (u || '').toLowerCase(); };
function git(repo, args, opts = {}) {
  return execFileSync('git', ['-c', 'core.longpaths=true', ...args], { cwd: repo, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], ...opts });
}
function tryGit(repo, args) { try { return git(repo, args); } catch { return null; } }
const isLangFile = (lang, f) => EXT[lang].some(e => f.endsWith(e));
const isProd = f => !NONPROD.test(f) && !NONPROD_EXTRA.test(f) && !GENERATED.test(f) && !DEMO_TOOLING.test(f);
const wordRe = w => new RegExp('(^|[^A-Za-z0-9_$])' + w.replace(/[$]/g, '\\$') + '($|[^A-Za-z0-9_$])');
const log = m => { const line = `${new Date().toISOString()} ${m}`; fs.appendFileSync(path.join(W, 'logs', 'build_external_cases.log'), line + '\n'); console.log(line); };

const fx = new FunctionExtractor();
const parseCache = new Map();
async function callables(repo, rev, file) {
  const key = `${repo}|${rev}|${file}`;
  if (parseCache.has(key)) return parseCache.get(key);
  const src = tryGit(repo, ['show', `${rev}:${file}`]);
  let syms = null;
  if (src !== null && src.length <= 400 * 1024) {
    try {
      syms = (await fx.extract(src, file)).symbols
        .filter(s => CALLABLE.has(s.symbolType) && s.name && s.name !== 'anonymous' && !(s.metadata && s.metadata.isSignatureOnly))
        .map(s => ({ name: s.name, qualifiedName: s.qualifiedName, file, startLine: s.range.startLine, docstring: s.docstring || null, source: s.source || '' }));
    } catch { syms = null; }
  }
  if (parseCache.size > 3000) parseCache.clear();
  parseCache.set(key, syms);
  return syms;
}
const badName = n => !n || n.length <= 3 || n === 'constructor' || /^__.*__$/.test(n) || n === '<init>';
const nested = (a, b) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());

// ---- candidate repositories ----
function excludedSet() { return JSON.parse(fs.readFileSync(path.join(W, 'cases', 'excluded_repositories.json'), 'utf8')); }
function oracleS1() {
  const d = JSON.parse(fs.readFileSync('D:/base papers considered/Test creation/datasets/existing/refactoring-miner-corpus/data/oracle-data.json', 'utf8'));
  const byRepo = new Map();
  for (const c of d) for (const r of c.refactorings) {
    if (r.validation !== 'TP' || !['Rename Method', 'Move And Rename Method'].includes(r.type)) continue;
    let m, ev = null;
    const nameOf = s => { const x = s.match(/([A-Za-z_$][\w$]*)\s*\(/); return x ? x[1] : null; };
    if (r.type === 'Rename Method' && (m = r.description.match(/^Rename Method (.+?) renamed to (.+?) in class (\S+)\s*$/))) ev = { old: nameOf(m[1]), new: nameOf(m[2]), oldClass: m[3], newClass: m[3] };
    else if (r.type === 'Move And Rename Method' && (m = r.description.match(/^Move And Rename Method (.+?) from class (\S+) to (.+?) from class (\S+)\s*$/))) ev = { old: nameOf(m[1]), new: nameOf(m[3]), oldClass: m[2], newClass: m[4] };
    if (!ev || !ev.old || !ev.new) continue;
    const key = norm(c.repository);
    if (!byRepo.has(key)) byRepo.set(key, { url: c.repository, events: [] });
    byRepo.get(key).events.push({ source: 'S1', commit: c.sha1, commit_url: c.url, type: r.type, description: r.description, ...ev });
  }
  return byRepo;
}
function oracleS2() {
  const text = fs.readFileSync(path.join(CLONES, 'PyRef', 'data', 'dataset.csv'), 'utf8');
  // minimal CSV parser (quoted fields with embedded newlines)
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') q = false; else field += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; } else field += ch;
  }
  const [hdr, ...body] = rows;
  const byRepo = new Map();
  for (const cells of body) {
    const r = Object.fromEntries(hdr.map((h, i) => [h, cells[i]]));
    if (r['refactoring type'] !== 'Rename Method' || r.validation !== 'TP') continue;
    const m = (r.description || '').match(/The method "([^"]+)" is renamed to "([^"]+)"/);
    const loc = (r.description || '').match(/Location:\s*(\S+)/);
    const cm = r.commit.match(/github\.com\/([^/]+\/[^/]+)\/commit\/([0-9a-f]{7,40})/);
    if (!m || !cm) continue;
    const key = cm[1].toLowerCase();
    if (!byRepo.has(key)) byRepo.set(key, { url: `https://github.com/${cm[1]}.git`, events: [] });
    byRepo.get(key).events.push({ source: 'S2', commit: cm[2], commit_url: r.commit, type: 'Rename Method', description: r.description, old: m[1], new: m[2], file_hint: loc && loc[1] });
  }
  return byRepo;
}
function catalog(lang) {
  const dir = path.join('D:/base papers considered/Test creation/repository-catalog', lang);
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { key: norm(j.canonical_url || j.repository_id), url: j.canonical_url };
  });
}
function candidateRepos() {
  const ex = excludedSet();
  const out = { java: [], python: [], javascript: [], typescript: [] };
  const s1 = oracleS1(), s2 = oracleS2();
  for (const [k, v] of [...s1].sort((a, b) => a[0].localeCompare(b[0]))) out.java.push({ key: k, url: v.url, source: 'S1', oracle: v.events, excluded: ex[k] || null });
  for (const [k, v] of [...s2].sort((a, b) => a[0].localeCompare(b[0]))) out.python.push({ key: k, url: v.url, source: 'S2', oracle: v.events, excluded: ex[k] || null });
  for (const lang of ['python', 'javascript', 'typescript']) {
    for (const c of catalog(lang)) {
      if (out[lang].some(x => x.key === c.key)) continue;
      out[lang].push({ key: c.key, url: c.url, source: 'S3', oracle: null, excluded: ex[c.key] || null });
    }
  }
  return out;
}

// ---- clone ----
function dirSize(p) {
  let n = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const q = path.join(p, e.name);
    try { n += e.isDirectory() ? dirSize(q) : fs.statSync(q).size; } catch { /* ignore */ }
  }
  return n;
}
function cloneRepo(r) {
  const dir = path.join(CLONES, r.key.replace('/', '__'));
  const ok = path.join(dir, '.git', '.retrospect_clone_ok');
  if (fs.existsSync(ok)) return { dir, ...JSON.parse(fs.readFileSync(ok, 'utf8')) };
  if (fs.existsSync(dir)) { const moved = `${dir}.incomplete-${Date.now()}`; fs.renameSync(dir, moved); log(`moved unfinished clone ${dir} -> ${moved}`); }
  const t = Date.now();
  const res = spawnSync('git', ['-c', 'core.longpaths=true', 'clone', '--single-branch', '-q', r.url, dir], { timeout: CLONE_TIMEOUT_MS, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  const seconds = (Date.now() - t) / 1000;
  if (res.error && res.error.code === 'ETIMEDOUT') return { error: `clone exceeded 10 minutes`, seconds };
  if (res.status !== 0) return { error: `clone failed: ${(res.stderr || '').trim().slice(0, 200)}`, seconds };
  const bytes = dirSize(dir);
  if (bytes > MAX_CLONE_BYTES) return { error: `clone exceeds 1.5 GB (${(bytes / 1024 ** 3).toFixed(2)} GB)`, seconds, bytes };
  const info = { clone_seconds: seconds, clone_bytes: bytes, default_branch: git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), head: git(dir, ['rev-parse', 'HEAD']).trim() };
  fs.writeFileSync(ok, JSON.stringify(info));
  return { dir, ...info };
}

// ---- event validation (extractor on the commit's changed files only) ----
function changedFiles(repo, commit, lang) {
  const out = tryGit(repo, ['diff-tree', '--no-commit-id', '-r', '-M', '--name-status', commit]);
  if (out === null) return [];
  return out.trim().split('\n').filter(Boolean).map(l => l.split('\t')).map(p => ({ status: p[0][0], oldPath: p[0][0] === 'R' ? p[1] : (p[0][0] === 'A' ? null : p[1]), newPath: p[0][0] === 'R' ? p[2] : (p[0][0] === 'D' ? null : p[1]) }))
    .filter(c => [c.oldPath, c.newPath].some(f => f && isLangFile(lang, f)));
}
async function sidesOf(repo, commit, parent, lang) {
  const before = [], after = [], files = changedFiles(repo, commit, lang);
  for (const c of files) {
    if (c.oldPath && isLangFile(lang, c.oldPath)) before.push(...((await callables(repo, parent, c.oldPath)) || []));
    if (c.newPath && isLangFile(lang, c.newPath)) after.push(...((await callables(repo, commit, c.newPath)) || []));
  }
  return { before, after };
}
// OLD callable in parent and absent in child; NEW absent in parent and present in child; best body similarity.
function checkPair(sides, OLD, NEW, opts = {}) {
  const oldB = sides.before.filter(s => s.name === OLD), oldA = sides.after.filter(s => s.name === OLD);
  const newB = sides.before.filter(s => s.name === NEW), newA = sides.after.filter(s => s.name === NEW);
  if (!oldB.length) return { ok: false, reason: 'OLD not a callable in parent (changed files)' };
  if (oldA.length) return { ok: false, reason: 'OLD still a callable in child (changed files)' };
  if (newB.length) return { ok: false, reason: 'NEW already a callable in parent (changed files)' };
  if (!newA.length) return { ok: false, reason: 'NEW not a callable in child (changed files)' };
  let best = null;
  for (const b of oldB) for (const a of newA) {
    if (opts.oldClass && !b.qualifiedName.includes(opts.oldClass.split('.').pop())) continue;
    if (opts.newClass && !a.qualifiedName.includes(opts.newClass.split('.').pop())) continue;
    const sim = jaccard(tokens(b.source, b.name), tokens(a.source, a.name));
    if (!best || sim > best.sim) best = { sim, b, a };
  }
  if (!best) return { ok: false, reason: 'no OLD/NEW callables in the oracle classes' };
  if (!isProd(best.b.file) || !isProd(best.a.file)) return { ok: false, reason: 'non-production path' };
  if (opts.minSim != null && best.sim < opts.minSim) return { ok: false, reason: `body similarity ${best.sim.toFixed(3)} < ${opts.minSim}` };
  return { ok: true, sim: best.sim, before: best.b, after: best.a };
}
const nameFilter = (OLD, NEW) => badName(OLD) || badName(NEW) ? 'constructor/dunder or name <= 3 chars' : (nested(OLD, NEW) ? 'OLD and NEW are nested substrings' : null);

async function candidateEvents(r, clone, lang, mode) {
  const repo = clone.dir, evs = [], rejects = [];
  const reject = (e, reason) => rejects.push({ commit: e.commit, old: e.old || null, new: e.new || null, source: e.source, reason });
  const onDefault = c => tryGit(repo, ['merge-base', '--is-ancestor', c, 'HEAD']) !== null;
  if (mode === 'oracle') {
    for (const e of r.oracle) {
      const nf = nameFilter(e.old, e.new);
      if (nf) { reject(e, nf); continue; }
      const full = tryGit(repo, ['rev-parse', '--verify', '--quiet', `${e.commit}^{commit}`]);
      if (!full) { reject(e, 'commit not in default-branch clone'); continue; }
      e.commit = full.trim();
      if (!onDefault(e.commit)) { reject(e, 'commit not on default branch'); continue; }
      const parents = git(repo, ['rev-list', '--parents', '-n', '1', e.commit]).trim().split(' ').slice(1);
      if (parents.length !== 1) { reject(e, 'merge or root commit'); continue; }
      const sides = await sidesOf(repo, e.commit, parents[0], lang);
      const chk = checkPair(sides, e.old, e.new, { oldClass: e.oldClass, newClass: e.newClass });
      if (!chk.ok) { reject(e, chk.reason); continue; }
      evs.push({ ...e, parent: parents[0], similarity: +chk.sim.toFixed(3), before: strip(chk.before), after: strip(chk.after) });
    }
  } else {
    const args = ['log', '--all', '-i', ...S3_GREPS.flatMap(g => ['--grep', g]), '--format=%H%x00%P%x00%B%x1e'];
    const out = tryGit(repo, args) || '';
    for (const rec of out.split('\x1e')) {
      const [h, p, msg] = rec.replace(/^\n/, '').split('\x00');
      if (!h || !msg) continue;
      const parents = (p || '').trim().split(' ').filter(Boolean);
      if (parents.length !== 1) continue;
      if (!onDefault(h)) continue;
      const words = new Set((msg.match(/[A-Za-z_$][\w$]*/g) || []).filter(w => w.length > 3));
      if (mode === 's3' && words.size < 2) continue;
      if (mode === 's3b' && !/rename/i.test(msg)) continue;
      const sides = await sidesOf(repo, h, parents[0], lang);
      const beforeNames = new Set(sides.before.map(s => s.name)), afterNames = new Set(sides.after.map(s => s.name));
      const olds = [...beforeNames].filter(n => !afterNames.has(n)), news = [...afterNames].filter(n => !beforeNames.has(n));
      for (const NEW of news) {
        if (!words.has(NEW)) continue;
        for (const OLD of olds) {
          if (mode === 's3' && !words.has(OLD)) continue;
          if (mode === 's3' && !(wordRe(OLD).test(msg) && wordRe(NEW).test(msg))) continue;
          const e = { source: mode === 's3' ? 'S3' : 'S3b', commit: h, parent: parents[0], old: OLD, new: NEW, message: msg.trim().slice(0, 500) };
          const nf = nameFilter(OLD, NEW);
          if (nf) { reject(e, nf); continue; }
          const chk = checkPair(sides, OLD, NEW, { minSim: 0.5 });
          if (!chk.ok) { reject(e, chk.reason); continue; }
          evs.push({ ...e, commit_url: `${r.url.replace(/\.git$/, '')}/commit/${h}`, similarity: +chk.sim.toFixed(3), before: strip(chk.before), after: strip(chk.after) });
        }
      }
    }
  }
  // de-duplicate identical (commit, OLD, NEW)
  const seen = new Set();
  return { evs: evs.filter(e => { const k = `${e.commit}|${e.old}|${e.new}`; if (seen.has(k)) return false; seen.add(k); return true; }), rejects };
}
const strip = s => ({ name: s.name, qualifiedName: s.qualifiedName, file: s.file, startLine: s.startLine });

// ---- pin + at-pin checks ----
function pinFor(repo, commit, offset) {
  const fp = git(repo, ['rev-list', '--first-parent', 'HEAD']).trim().split('\n').reverse(); // oldest -> newest
  let lo = 0, hi = fp.length - 1, first = -1;
  const contains = i => tryGit(repo, ['merge-base', '--is-ancestor', commit, fp[i]]) !== null;
  if (!contains(hi)) return null;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (contains(mid)) { first = mid; hi = mid - 1; } else lo = mid + 1; }
  return { first_containing: fp[first], pin: fp[Math.min(first + offset, fp.length - 1)], offset_applied: Math.min(offset, fp.length - 1 - first) };
}
async function callablesNamedAt(repo, pin, lang, name) {
  const out = tryGit(repo, ['grep', '-l', '-w', '-F', name, pin, '--', ...GREP_GLOBS[lang]]) || '';
  const files = out.trim().split('\n').filter(Boolean).map(l => l.slice(pin.length + 1)).filter(isProd);
  const hits = [];
  for (const f of files) for (const s of (await callables(repo, pin, f)) || []) if (s.name === name) hits.push(s);
  return hits;
}
async function atPin(repo, e, lang) {
  for (const offset of [50, 10]) {
    const p = pinFor(repo, e.commit, offset);
    if (!p) return { ok: false, reason: 'event not reachable from default-branch HEAD' };
    const reach = classifyOriginInWindow(repo, e.commit, p.pin, H, { firstParentOnly: false, topoOrder: true });
    if (!(reach.status === 'IN_WINDOW' && reach.origin_diff_analyzed)) {
      if (offset === 50) continue;
      return { ok: false, reason: `not IN_WINDOW+diffed at H=${H} with pin offset +50 or +10 (status ${reach.status}, position ${reach.window_position})` };
    }
    const succ = (await callablesNamedAt(repo, p.pin, lang, e.new)).filter(s => s.qualifiedName === e.after.qualifiedName);
    if (succ.length !== 1) return { ok: false, reason: succ.length ? 'successor not unique at pin' : 'successor absent at pin' };
    const oldLeft = await callablesNamedAt(repo, p.pin, lang, e.old);
    if (oldLeft.length) return { ok: false, reason: 'OLD still exists as a callable at pin' };
    return { ok: true, ...p, reach, target: succ[0] };
  }
}

// ---- per-repository processing ----
async function processRepo(r, lang, mode) {
  const workDir = path.join(W, 'cases', 'work', lang);
  fs.mkdirSync(workDir, { recursive: true });
  const outPath = path.join(workDir, `${r.key.replace('/', '__')}${mode === 's3b' ? '.s3b' : ''}.json`);
  if (fs.existsSync(outPath)) return JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const res = { repository: r.key, url: r.url, language: lang, source: mode === 's3b' ? 'S3b' : r.source, mode, status: null, reason: null, funnel: {}, rejects: [], drops: [], selected: null };
  const save = () => { fs.writeFileSync(outPath + '.tmp', JSON.stringify(res, null, 1)); fs.renameSync(outPath + '.tmp', outPath); return res; };
  if (r.excluded) { res.status = 'excluded'; res.reason = `excluded repository (${r.excluded})`; return save(); }
  const t0 = Date.now();
  const clone = cloneRepo(r);
  if (clone.error) { res.status = 'skipped'; res.reason = clone.error; res.funnel.clone_seconds = clone.seconds; return save(); }
  res.clone = { dir: clone.dir, seconds: clone.clone_seconds, bytes: clone.clone_bytes, default_branch: clone.default_branch, head: clone.head };
  const { evs, rejects } = await candidateEvents(r, clone, lang, mode === 's3b' ? 's3b' : (r.oracle ? 'oracle' : 's3'));
  res.rejects = rejects;
  res.funnel = { candidate_events: evs.length + rejects.length, passed_extractor_check: evs.length };
  const order = evs.map(e => ({ e, k: sha(`${SEED}|${r.key}|${e.commit}|${e.old}|${e.new}`) })).sort((a, b) => a.k.localeCompare(b.k)).map(x => x.e);
  for (const e of order) {
    const chk = await atPin(clone.dir, e, lang);
    if (!chk.ok) { res.drops.push({ commit: e.commit, old: e.old, new: e.new, source: e.source, reason: chk.reason }); continue; }
    const docAtPin = firstSentence(chk.target.docstring);
    const docOk = docAtPin && !wordRe(e.old).test(docAtPin) && !wordRe(e.new).test(docAtPin) ? docAtPin : null;
    res.selected = { ...e, pin: chk.pin, first_containing: chk.first_containing, pin_offset: chk.offset_applied, reach: chk.reach,
      target: { file: chk.target.file, qualifiedName: chk.target.qualifiedName, name: chk.target.name }, a_query: docOk,
      name_subtoken_overlap: (() => { const a = new Set(subtokens(e.old)), b = new Set(subtokens(e.new)); const i = [...a].filter(x => b.has(x)).length; return +(i / new Set([...a, ...b]).size).toFixed(3); })() };
    break;
  }
  res.funnel.dropped_at_pin = res.drops.length;
  res.status = res.selected ? 'selected' : 'no_valid_event';
  if (!res.selected) res.reason = evs.length ? 'all candidate events dropped at pin checks' : 'no candidate event passed the extractor check';
  res.seconds = (Date.now() - t0) / 1000;
  return save();
}

function selectedCount(lang) {
  const dir = path.join(W, 'cases', 'work', lang);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter(x => x.status === 'selected').length;
}

async function collect(mode) {
  const repos = candidateRepos();
  for (const lang of LANGS) {
    if (mode === 's3b' && selectedCount(lang) >= MIN_PER_LANG) continue;
    if (mode === 's3b' && lang === 'java') continue; // S3b applies to S3 languages only
    for (const r of repos[lang]) {
      if (selectedCount(lang) >= TARGET) break;
      if (mode === 's3b') {
        if (r.source !== 'S3' || r.excluded) continue;
        const prev = path.join(W, 'cases', 'work', lang, `${r.key.replace('/', '__')}.json`);
        if (fs.existsSync(prev) && JSON.parse(fs.readFileSync(prev, 'utf8')).status === 'selected') continue;
        if (fs.existsSync(prev) && JSON.parse(fs.readFileSync(prev, 'utf8')).status === 'skipped') continue;
      }
      log(`${mode} ${lang} ${r.key} (${r.source})`);
      try {
        const res = await processRepo(r, lang, mode);
        log(`  -> ${res.status}${res.reason ? ' (' + res.reason + ')' : ''}; selected so far ${selectedCount(lang)}`);
      } catch (err) { log(`  -> ERROR ${err && err.stack ? err.stack.split('\n')[0] : err}`); }
    }
  }
  printFunnel();
}

function allResults() {
  const out = [];
  for (const lang of LANGS) {
    const dir = path.join(W, 'cases', 'work', lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  return out;
}
function funnel() {
  const f = {};
  for (const r of allResults()) {
    const k = `${r.language}/${r.source}`;
    f[k] = f[k] || { repositories_considered: 0, excluded: 0, clone_skipped: 0, no_valid_event: 0, selected: 0, candidate_events: 0, passed_extractor_check: 0, dropped_at_pin: 0 };
    const x = f[k];
    x.repositories_considered++;
    if (r.status === 'excluded') x.excluded++; else if (r.status === 'skipped') x.clone_skipped++; else if (r.status === 'no_valid_event') x.no_valid_event++; else if (r.status === 'selected') x.selected++;
    x.candidate_events += r.funnel.candidate_events || 0; x.passed_extractor_check += r.funnel.passed_extractor_check || 0; x.dropped_at_pin += r.funnel.dropped_at_pin || 0;
  }
  const per = Object.fromEntries(LANGS.map(l => [l, allResults().filter(r => r.language === l && r.status === 'selected').length]));
  return { by_language_source: f, selected_per_language: per, total_selected: Object.values(per).reduce((a, b) => a + b, 0) };
}
function printFunnel() { console.log(JSON.stringify(funnel(), null, 1)); }

function csvRow(vals) { return vals.map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','); }

function freeze() {
  const out = path.join(W, 'cases', 'cases.jsonl');
  if (fs.existsSync(out)) throw new Error('cases.jsonl exists; refusing to overwrite (frozen)');
  const fun = funnel();
  // protocol.md Deviation 1: minimum relaxed to 7 for JavaScript only (catalog exhausted in S3 and S3b).
  const MIN_OVERRIDE = { javascript: 7 };
  const short = LANGS.filter(l => fun.selected_per_language[l] < (MIN_OVERRIDE[l] || MIN_PER_LANG));
  if (short.length || fun.total_selected < MIN_TOTAL) { console.log(JSON.stringify(fun, null, 1)); throw new Error(`MINIMUM NOT MET: short languages ${short.join(',') || 'none'}, total ${fun.total_selected} (need >= ${MIN_PER_LANG}/language, >= ${MIN_TOTAL} total)`); }
  const rows = [], review = [], excl = [];
  // a repository may have both an S3 result and an S3b result; S3 wins if selected
  const results = allResults();
  const chosen = new Map();
  for (const r of results) if (r.status === 'selected' && (!chosen.has(r.repository) || r.source !== 'S3b')) chosen.set(r.repository, r);
  for (const r of results) {
    if (r.status !== 'selected') excl.push([r.language, r.repository, r.source, '', '', '', 'repository', r.reason]);
    for (const x of r.rejects || []) excl.push([r.language, r.repository, x.source, x.commit, x.old, x.new, 'extractor/name check', x.reason]);
    for (const x of r.drops || []) excl.push([r.language, r.repository, x.source, x.commit, x.old, x.new, 'pin check', x.reason]);
  }
  for (const r of [...chosen.values()].sort((a, b) => a.language.localeCompare(b.language) || a.repository.localeCompare(b.repository))) {
    const s = r.selected;
    const base = { repository: r.repository, language: r.language, source: s.source, cluster_id: r.repository, pin: s.pin, commit: s.commit, parent: s.parent,
      commit_url: s.commit_url, old_name: s.old, new_name: s.new, accepted_targets: [s.target], topo_position: s.reach.window_position, lineage_label: 'rename',
      name_subtoken_overlap: s.name_subtoken_overlap, similarity: s.similarity };
    const id = t => sha(`${r.repository}|${s.commit}|${s.old}|${s.new}|${t}`).slice(0, 16);
    rows.push({ case_id: id('B_id'), task: 'B_id', query: s.old, template: null, ...base });
    NL_TEMPLATES.forEach((tpl, i) => rows.push({ case_id: id(`B_nl_${i + 1}`), task: 'B_nl', template: i + 1, query: tpl.replace('OLD', s.old), ...base }));
    if (s.a_query) rows.push({ case_id: id('A'), task: 'A', query: s.a_query, template: null, ...base });
    if (s.source === 'S3' || s.source === 'S3b') review.push([r.language, r.repository, s.source, s.commit_url, (s.message || '').replace(/\s+/g, ' ').slice(0, 300), `${s.old} -> ${s.new}`, '', '']);
  }
  fs.writeFileSync(out, rows.map(x => JSON.stringify(x)).join('\n') + '\n');
  fs.writeFileSync(path.join(W, 'cases', 'exclusion_log.csv'), csvRow(['language', 'repository', 'source', 'commit', 'old', 'new', 'stage', 'reason']) + '\n' + excl.map(csvRow).join('\n') + '\n');
  fs.writeFileSync(path.join(W, 'cases', 'review_sheet.csv'), csvRow(['language', 'repository', 'source', 'commit_url', 'message', 'old_to_new', 'verdict (confirm|reject)', 'note']) + '\n' + review.map(csvRow).join('\n') + '\n');
  fs.writeFileSync(path.join(W, 'cases', 'funnel.json'), JSON.stringify(fun, null, 1));
  // inventory for the harness + check out each clone at its pin (detached; clones are ours)
  const inv = ['repository,local_path,remote_url,primary_language'];
  for (const r of chosen.values()) {
    const d = r.clone.dir.replace(/\\/g, '/');
    if (git(d, ['status', '--porcelain', '--untracked-files=no']).trim()) throw new Error(`clone not clean: ${d}`);
    git(d, ['checkout', '-q', '--detach', r.selected.pin]);
    inv.push([r.repository, d, r.url, r.language].join(','));
  }
  fs.writeFileSync(path.join(W, 'REPOSITORY_INVENTORY.csv'), inv.join('\n') + '\n');
  const files = ['cases/cases.jsonl', 'cases/exclusion_log.csv', 'cases/review_sheet.csv', 'cases/funnel.json', 'REPOSITORY_INVENTORY.csv', 'cases/excluded_repositories.json'];
  fs.writeFileSync(path.join(W, 'cases', 'MANIFEST.sha256.json'), JSON.stringify({ frozen_utc: new Date().toISOString(), seed: SEED,
    retrospect_head: git(R, ['rev-parse', 'HEAD']).trim(), files: Object.fromEntries(files.map(f => [f, sha(fs.readFileSync(path.join(W, f)))])) }, null, 2));
  console.log(`frozen: ${rows.length} query rows, ${chosen.size} repositories`);
  printFunnel();
}

(async () => {
  fs.mkdirSync(path.join(W, 'logs'), { recursive: true });
  const cmd = process.argv[2];
  if (cmd === 'collect') await collect('collect');
  else if (cmd === 's3b') await collect('s3b');
  else if (cmd === 'freeze') freeze();
  else if (cmd === 'funnel') printFunnel();
  else throw new Error('usage: collect | s3b | freeze | funnel');
})().catch(e => { console.error(e); process.exit(1); });
