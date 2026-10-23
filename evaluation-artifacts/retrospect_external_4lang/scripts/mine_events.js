#!/usr/bin/env node
/**
 * Candidate evolution-event miner (read-only on the repository: only `git log/show/diff-tree`).
 *
 * For each non-merge commit among the first N commits of `git log --topo-order <pin>`, compares the callables
 * of changed production files before and after the commit and emits CANDIDATE events:
 *   rename, move, rename_move (1:1 pairing by body-token similarity), signature_change, extraction, inlining,
 *   split, deletion_no_successor (negative candidate).
 * Pairing is independent of Retrospect's FunctionMatcher; symbols are parsed with Retrospect's Tree-sitter adapters.
 * Thresholds are fixed constants (DATASET_DESIGN.md §3) and are not tuned on retrieval results.
 *
 * Usage: node mine_events.js --repo <path> --name <repo> --lang <java|python|javascript|typescript>
 *                            --window <N> --out <file.jsonl> [--pin <sha>]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RETROSPECT = 'D:/base papers considered/Retrospect';
const FunctionExtractor = require(path.join(RETROSPECT, 'src/parser/FunctionExtractor'));

const EXT = { java: ['.java'], python: ['.py'], javascript: ['.js', '.jsx', '.mjs', '.cjs'], typescript: ['.ts', '.tsx', '.mts', '.cts'] };
const NONPROD = /(^|\/)(tests?|__tests__|spec|specs|testing|test-data|testdata|fixtures?|examples?|docs?|benchmarks?|bench|node_modules|dist|build|vendor|third_party|scripts)(\/|$)|\.d\.ts$|(_test|\.test|\.spec)\.\w+$|(^|\/)test_[^/]+\.py$/i;
const CALLABLE = new Set(['function', 'method', 'arrow_function']);
const MAX_FILE_BYTES = 400 * 1024;
// Fixed thresholds (documented in DATASET_DESIGN.md)
const T = { pairMin: 0.5, strong: 0.8, margin: 0.1, contain: 0.6, splitPart: 0.5, minTokens: 12 };

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

function git(repo, args, opts = {}) {
  return execFileSync('git', ['-c', 'core.longpaths=true', ...args], { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], ...opts });
}

function tryShow(repo, rev, file) {
  try {
    const size = parseInt(git(repo, ['cat-file', '-s', `${rev}:${file}`]).trim(), 10);
    if (size > MAX_FILE_BYTES) return null;
    return git(repo, ['show', `${rev}:${file}`]);
  } catch (e) {
    return null;
  }
}

// Identifier/number tokens only; punctuation and language keywords are excluded so that similarity
// reflects shared vocabulary rather than syntax.
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

function bagIntersect(a, b) {
  let s = 0;
  for (const [t, c] of a.bag) if (b.bag.has(t)) s += Math.min(c, b.bag.get(t));
  return s;
}

function jaccard(a, b) {
  const inter = bagIntersect(a, b);
  const union = a.n + b.n - inter;
  return union ? inter / union : 0;
}

function containment(part, whole) { // fraction of `part` tokens present in `whole`
  return part.n ? bagIntersect(part, whole) / part.n : 0;
}

function bagDiff(a, b) { // tokens in a not in b (multiset)
  const bag = new Map();
  let n = 0;
  for (const [t, c] of a.bag) {
    const d = c - (b.bag.get(t) || 0);
    if (d > 0) { bag.set(t, d); n += d; }
  }
  return { bag, n };
}

function sig(s) {
  return (s.parameters || []).map(p => `${p.name || ''}:${p.type || ''}`).join(',');
}

const short = s => ({
  name: s.name, qualifiedName: s.qualifiedName, file: s.file, symbolType: s.symbolType,
  signature: s.normalizedSignature || null, parameters: (s.parameters || []).map(p => p.name), returnType: s.returnType || null,
  startLine: s.range.startLine, endLine: s.range.endLine, hasDocstring: !!(s.docstring && s.docstring.trim())
});

async function main() {
  const repo = arg('repo');
  const name = arg('name');
  const lang = arg('lang');
  const window = parseInt(arg('window', '300'), 10);
  const outPath = arg('out');
  if (!repo || !name || !EXT[lang] || !outPath) throw new Error('missing --repo/--name/--lang/--out');
  if (fs.existsSync(outPath)) throw new Error(`refusing to overwrite ${outPath}`);
  const pin = git(repo, ['rev-parse', arg('pin', 'HEAD')]).trim();
  const fx = new FunctionExtractor();
  const isLangFile = f => EXT[lang].some(e => f.endsWith(e)) && !NONPROD.test(f);

  const parseCache = new Map();
  async function callables(rev, file) {
    const key = `${rev}:${file}`;
    if (parseCache.has(key)) return parseCache.get(key);
    const src = tryShow(repo, rev, file);
    let syms = null;
    if (src !== null) {
      try {
        syms = (await fx.extract(src, file)).symbols
          .filter(s => CALLABLE.has(s.symbolType) && s.name && s.name !== 'anonymous' && !(s.metadata && s.metadata.isSignatureOnly))
          .map(s => ({ ...s, file, tok: tokens(s.source || '', s.name) }));
      } catch (e) {
        syms = null;
      }
    }
    if (parseCache.size > 4000) parseCache.clear();
    parseCache.set(key, syms);
    return syms;
  }

  const pinFileCache = new Map();
  async function atPin(file, qualifiedName, simpleName) {
    if (!pinFileCache.has(file)) {
      const syms = await callables(pin, file);
      pinFileCache.set(file, syms);
    }
    const syms = pinFileCache.get(file);
    if (!syms) return { present: false, reason: 'file_absent_at_pin' };
    const q = syms.filter(s => s.qualifiedName === qualifiedName);
    if (q.length) return { present: true, match: 'qualified', count: q.length, line: q[0].range.startLine };
    const n = syms.filter(s => s.name === simpleName);
    if (n.length) return { present: true, match: 'name_only', count: n.length, line: n[0].range.startLine };
    return { present: false, reason: 'symbol_absent_at_pin' };
  }

  const grepCache = new Map();
  function grepCount(rev, word) { // number of language files containing `word` as a whole word at `rev`
    const key = `${rev}:${word}`;
    if (grepCache.has(key)) return grepCache.get(key);
    let n = 0;
    try {
      n = git(repo, ['grep', '-l', '-w', '-F', word, rev, '--', ...EXT[lang].map(e => `*${e}`)]).trim().split('\n').filter(Boolean).length;
    } catch (e) {
      n = 0; // git grep exits 1 when nothing matches
    }
    grepCache.set(key, n);
    return n;
  }

  const log = git(repo, ['log', '--format=%H %P', '--topo-order', '-n', String(window), pin]).trim().split('\n');
  const out = fs.openSync(outPath, 'w');
  const stats = { commits: 0, mergesSkipped: 0, commitsWithChanges: 0, events: {}, parseFailures: 0 };
  let position = 0;
  for (const line of log) {
    position++;
    const [commit, ...parents] = line.trim().split(' ');
    if (parents.length !== 1) { stats.mergesSkipped++; continue; }
    stats.commits++;
    const parent = parents[0];
    const changes = git(repo, ['diff-tree', '-r', '-M', '--no-commit-id', '--name-status', parent, commit]).trim().split('\n').filter(Boolean)
      .map(l => l.split('\t')).map(([st, a, b]) => ({ status: st[0], oldPath: st[0] === 'A' ? null : a, newPath: st[0] === 'D' ? null : (b || a) }))
      .filter(c => (c.oldPath && isLangFile(c.oldPath)) || (c.newPath && isLangFile(c.newPath)));
    if (!changes.length) continue;
    stats.commitsWithChanges++;

    const before = [], after = [];
    const pathMap = new Map(); // oldPath -> newPath
    for (const c of changes) {
      if (c.oldPath) {
        const s = await callables(parent, c.oldPath);
        if (s === null && c.oldPath) stats.parseFailures++;
        (s || []).forEach(x => before.push({ ...x, file: c.oldPath, mapped: c.newPath || c.oldPath }));
      }
      if (c.newPath) {
        const s = await callables(commit, c.newPath);
        (s || []).forEach(x => after.push(x));
      }
      if (c.oldPath && c.newPath) pathMap.set(c.oldPath, c.newPath);
    }
    // Identity = file + qualified name + parameter signature, so overloads/property accessors stay distinct.
    const idB = s => `${s.mapped}::${s.qualifiedName}#${sig(s)}`;
    const idA = s => `${s.file}::${s.qualifiedName}#${sig(s)}`;
    const nameB = s => `${s.mapped}::${s.qualifiedName}`;
    const nameA = s => `${s.file}::${s.qualifiedName}`;
    const afterIds = new Map(after.map(s => [idA(s), s]));
    const beforeIds = new Map(before.map(s => [idB(s), s]));
    const kept = before.filter(s => afterIds.has(idB(s))).map(s => ({ b: s, a: afterIds.get(idB(s)) }));
    const unB = before.filter(s => !afterIds.has(idB(s)));
    const unA = after.filter(s => !beforeIds.has(idA(s)));
    // Same qualified name, signature changed: only when exactly one unmatched symbol remains on each side.
    const sigChanges = [];
    const byNameB = new Map(), byNameA = new Map();
    unB.forEach(s => byNameB.set(nameB(s), [...(byNameB.get(nameB(s)) || []), s]));
    unA.forEach(s => byNameA.set(nameA(s), [...(byNameA.get(nameA(s)) || []), s]));
    const consumed = new Set();
    for (const [k, bs] of byNameB) {
      const as = byNameA.get(k) || [];
      if (bs.length === 1 && as.length === 1) { sigChanges.push({ b: bs[0], a: as[0] }); consumed.add(bs[0]); consumed.add(as[0]); }
      else if (as.length) { bs.forEach(x => consumed.add(x)); as.forEach(x => consumed.add(x)); } // overload churn: not paired
    }
    const removed = unB.filter(s => !consumed.has(s) && s.tok.n >= T.minTokens);
    const added = unA.filter(s => !consumed.has(s) && s.tok.n >= T.minTokens);
    kept.push(...sigChanges);
    const meta = git(repo, ['show', '-s', '--format=%an%x1f%aI%x1f%s', commit]).trim().split('\x1f');

    const emitted = [];
    const emit = async (type, b, a, extra = {}) => {
      const target = a ? await atPin(a.file, a.qualifiedName, a.name) : null;
      const ev = {
        event_id: null, repository: name, language: lang, pin, commit, parent, topo_position: position,
        commit_subject: meta[2], commit_date: meta[1], candidate_type: type,
        before: b ? short(b) : null, after: a ? short(a) : null, ...extra,
        successor_at_pin: target, old_name_files_at_pin: b ? grepCount(pin, b.name) : null, status: 'candidate'
      };
      ev.event_id = crypto.createHash('sha256').update([name, commit, type, b && `${b.file}::${b.qualifiedName}`, a && `${a.file}::${a.qualifiedName}`].join('|')).digest('hex').slice(0, 16);
      fs.writeSync(out, JSON.stringify(ev) + '\n');
      emitted.push(ev);
      stats.events[type] = (stats.events[type] || 0) + 1;
    };

    // 1:1 pairing of removed -> added by body similarity
    const usedAdded = new Set();
    const pairedRemoved = new Set();
    for (const r of removed) {
      const scored = added.map(a => ({ a, sim: jaccard(r.tok, a.tok) })).filter(x => x.sim >= T.pairMin).sort((x, y) => y.sim - x.sim);
      if (!scored.length) continue;
      const best = scored[0];
      const second = scored[1] ? scored[1].sim : 0;
      const sameFile = r.mapped === best.a.file;
      const sameName = r.name === best.a.name;
      let type = sameName ? (sameFile ? 'scope_change' : 'move') : (sameFile ? 'rename' : 'rename_move');
      const strong = best.sim >= T.strong && best.sim - second >= T.margin;
      await emit(strong ? type : 'ambiguous_pairing', r, best.a, {
        similarity: +best.sim.toFixed(3), second_best_similarity: +second.toFixed(3), signature_changed: sig(r) !== sig(best.a),
        competing_successors: scored.slice(1, 4).map(x => ({ qualifiedName: x.a.qualifiedName, file: x.a.file, sim: +x.sim.toFixed(3) })),
        file_renamed: r.file !== r.mapped
      });
      pairedRemoved.add(r);
      if (strong) usedAdded.add(best.a);
    }

    // signature change: unique same-name pair with different parameters
    for (const { b, a } of sigChanges) {
      if (b.tok.n >= T.minTokens) {
        await emit('signature_change', b, a, { similarity: +jaccard(b.tok, a.tok).toFixed(3), signature_changed: true });
      }
    }

    // extraction: added callable whose tokens come from code removed from a kept callable that now calls it
    for (const a of added) {
      if (usedAdded.has(a)) continue;
      for (const { b, a: k } of kept) {
        const removedPart = bagDiff(b.tok, k.tok);
        if (removedPart.n < T.minTokens) continue;
        const c = containment(a.tok, removedPart);
        if (c >= T.contain && (k.source || '').includes(a.name + '(')) {
          await emit('extraction', b, a, { containment: +c.toFixed(3), extracted_from_successor: short(k) });
          break;
        }
      }
    }

    // removed and not paired: inlining, split, or deletion without successor
    for (const r of removed) {
      if (pairedRemoved.has(r)) continue;
      let handled = false;
      for (const { b, a: k } of kept) {
        const addedPart = bagDiff(k.tok, b.tok);
        if (addedPart.n < T.minTokens) continue;
        const c = containment(r.tok, addedPart);
        if (c >= T.contain && (b.source || '').includes(r.name + '(')) {
          await emit('inlining', r, k, { containment: +c.toFixed(3) });
          handled = true;
          break;
        }
      }
      if (handled) continue;
      const parts = added.filter(a => !usedAdded.has(a)).map(a => ({ a, c: containment(a.tok, r.tok) })).filter(x => x.c >= T.splitPart);
      const union = { bag: new Map(), n: 0 };
      for (const p of parts) for (const [t, c] of p.a.tok.bag) union.bag.set(t, Math.max(union.bag.get(t) || 0, c));
      union.n = [...union.bag.values()].reduce((x, y) => x + y, 0);
      if (parts.length >= 2 && containment(r.tok, union) >= T.contain) {
        for (const p of parts) await emit('split_part', r, p.a, { containment: +p.c.toFixed(3), split_parts: parts.length });
        continue;
      }
      // Negative evidence: best containment of the old body in any code added by this commit, and whether
      // the old name still occurs anywhere in the repository right after the commit.
      let bestC = 0;
      for (const a of added) bestC = Math.max(bestC, containment(r.tok, a.tok));
      for (const { b, a: k } of kept) bestC = Math.max(bestC, containment(r.tok, bagDiff(k.tok, b.tok)));
      const nameAfter = grepCount(commit, r.name);
      await emit('deletion_no_successor', r, null, {
        best_successor_containment: +bestC.toFixed(3), old_name_files_after_commit: nameAfter,
        strong_negative_candidate: bestC < 0.3 && nameAfter === 0
      });
    }
  }
  fs.closeSync(out);
  const summary = { repository: name, language: lang, pin, window, ...stats };
  fs.writeFileSync(outPath.replace(/\.jsonl$/, '.summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
}

main().catch(e => { console.error(e); process.exit(1); });
