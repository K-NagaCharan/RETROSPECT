#!/usr/bin/env node
/**
 * Build frozen retrieval cases from machine-verified evolution events (read-only on repositories).
 *
 * Queries are derived deterministically from repository evidence (no hand-written or LLM-written text):
 *   B_identifier  old simple name of the predecessor                      -> target: successor at pin
 *   C_docstring   first sentence of the predecessor's (old) docstring       -> target: successor at pin
 *   A_current_doc first sentence of the successor's current docstring       -> target: successor at pin (structural baseline task)
 *   D_negative    old simple name of a deleted callable with no successor   -> no accepted target
 * Leakage rules (reports/evaluation_protocol.md) are applied here and recorded per case.
 *
 * Usage: node build_cases.js            (writes ground_truth/retrieval_cases.jsonl, accepted_targets.jsonl, negative_cases.jsonl)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const FunctionExtractor = require(path.join('D:/base papers considered/Retrospect', 'src/parser/FunctionExtractor'));

const W = path.resolve(__dirname, '..', '..');
const B_LABELS = new Set(['strict_rename', 'rename_signature_change', 'rename_move']);
const inv = {};
for (const line of fs.readFileSync(path.join(W, 'REPOSITORY_INVENTORY.csv'), 'utf8').trim().split('\n').slice(1)) {
  const cols = line.split(',');
  inv[cols[0]] = cols[1];
}

const git = (repo, args) => execFileSync('git', ['-c', 'core.longpaths=true', ...args], { cwd: inv[repo], encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const fx = new FunctionExtractor();
const symCache = new Map();
async function symbolsAt(repo, rev, file) {
  const key = `${repo}:${rev}:${file}`;
  if (!symCache.has(key)) {
    let syms = null;
    try { syms = (await fx.extract(git(repo, ['show', `${rev}:${file}`]), file)).symbols; } catch (e) { syms = null; }
    if (symCache.size > 2000) symCache.clear();
    symCache.set(key, syms);
  }
  return symCache.get(key);
}

function firstSentence(doc) {
  if (!doc) return null;
  const text = doc.replace(/^[\s/*#"'`]+|[\s*/"'`]+$/g, '').replace(/^\s*[*#]\s?/gm, '').replace(/@\w+.*$/gms, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const s = (text.match(/^.*?[.!?](\s|$)/) || [text])[0].trim();
  const words = s.split(' ');
  if (words.length < 4) return null; // too short to be a behavioural description
  return words.slice(0, 30).join(' ');
}

const subtokens = n => (n || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_$]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
const caseId = (...parts) => crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);

(async () => {
  const events = fs.readFileSync(path.join(W, 'ground_truth', 'evolution_events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const outCases = path.join(W, 'ground_truth', 'retrieval_cases.jsonl');
  if (fs.existsSync(outCases)) throw new Error('retrieval_cases.jsonl exists; refusing to overwrite (cases are frozen once written)');
  const cases = [], targets = [], negatives = [], excluded = [];
  for (const ev of events) {
    const base = {
      event_id: ev.event_id, cluster_id: ev.cluster_id, repository: ev.repository, language: ev.language, pin: ev.pin,
      commit: ev.commit, topo_position: ev.topo_position, lineage_label: ev.lineage_label,
      development_only_repository: ev.development_only_repository
    };
    if (B_LABELS.has(ev.lineage_label)) {
      const sp = ev.successor_at_pin || {};
      if (!(sp.present && sp.match === 'qualified' && sp.count === 1)) {
        excluded.push({ ...base, reason: `successor not uniquely present at pin (${sp.reason || sp.match + ' x' + sp.count})` });
        continue;
      }
      const target = { file: ev.after.file, qualifiedName: ev.after.qualifiedName, name: ev.after.name };
      const oldName = ev.before.name;
      const newName = ev.after.name;
      const overlap = (() => { const a = new Set(subtokens(oldName)), b = new Set(subtokens(newName)); const i = [...a].filter(x => b.has(x)).length; return +(i / new Set([...a, ...b]).size).toFixed(3); })();
      const leakId = oldName.toLowerCase() === newName.toLowerCase() || subtokens(oldName).join(' ').includes(subtokens(newName).join(' '));
      const mk = (task, query, provenance, leak, extra = {}) => {
        const id = caseId(ev.event_id, task);
        cases.push({ case_id: id, task, query, query_provenance: provenance, accepted_targets: [target], leakage_flag: leak, ...base,
          old_name: oldName, new_name: newName, name_subtoken_overlap: overlap, old_name_files_at_pin: ev.old_name_files_at_pin, ...extra });
        targets.push({ case_id: id, ...target, pin: ev.pin, repository: ev.repository });
      };
      if (leakId) excluded.push({ ...base, task: 'B_identifier', reason: 'old name contains the new name (identifier query would leak the target)' });
      else mk('B_identifier', oldName, 'predecessor simple name (before.name)', false);

      const beforeSyms = await symbolsAt(ev.repository, ev.parent, ev.before.file);
      const bs = beforeSyms && beforeSyms.find(s => s.qualifiedName === ev.before.qualifiedName && s.range.startLine === ev.before.startLine);
      const oldDoc = firstSentence(bs && bs.docstring);
      if (oldDoc) {
        const leak = new RegExp('\\b' + newName.replace(/[$]/g, '\\$') + '\\b').test(oldDoc);
        if (leak) excluded.push({ ...base, task: 'C_docstring', reason: 'old docstring mentions the new name' });
        else mk('C_docstring', oldDoc, 'first sentence of predecessor docstring at parent commit', false);
      }
      const pinSyms = await symbolsAt(ev.repository, ev.pin, target.file);
      const ps = pinSyms && pinSyms.find(s => s.qualifiedName === target.qualifiedName);
      const curDoc = firstSentence(ps && ps.docstring);
      if (curDoc) mk('A_current_doc', curDoc, 'first sentence of successor docstring at pin', false, { note: 'structural baseline task; describes current code' });
    } else if (ev.lineage_label === 'no_valid_lineage') {
      if (ev.old_name_files_at_pin !== 0) {
        excluded.push({ ...base, task: 'D_negative', reason: 'deleted name still occurs in the repository at pin' });
        continue;
      }
      const id = caseId(ev.event_id, 'D_negative');
      const neg = { case_id: id, task: 'D_negative', query: ev.before.name, query_provenance: 'deleted callable simple name', accepted_targets: [],
        leakage_flag: false, ...base, old_name: ev.before.name, best_successor_containment: ev.best_successor_containment };
      cases.push(neg);
      negatives.push(neg);
    }
  }
  // One case per distinct task instance: identical (repository, pin, task, query, target) rows - e.g. deleted overloads of one
  // name, or the same name deleted in two commits - are the same task, not independent cases (kept: first in event order).
  const seen = new Set();
  const dedup = [];
  for (const c of cases) {
    const key = [c.repository, c.pin, c.task, c.query, JSON.stringify(c.accepted_targets)].join('|');
    if (seen.has(key)) { excluded.push({ case_id: c.case_id, event_id: c.event_id, repository: c.repository, language: c.language, task: c.task, reason: 'duplicate task instance (same repository, pin, task, query and target)' }); continue; }
    seen.add(key);
    dedup.push(c);
  }
  cases.length = 0;
  cases.push(...dedup);
  const keep = new Set(cases.map(c => c.case_id));
  for (const arr of [targets, negatives]) { const k = arr.filter(x => keep.has(x.case_id)); arr.length = 0; arr.push(...k); }
  const write = (file, rows) => fs.writeFileSync(path.join(W, 'ground_truth', file), rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  write('retrieval_cases.jsonl', cases);
  write('accepted_targets.jsonl', targets);
  write('negative_cases.jsonl', negatives);
  write('case_exclusions.jsonl', excluded);
  const count = {};
  for (const c of cases) {
    const k = `${c.language}/${c.task}`;
    count[k] = count[k] || { cases: 0, clusters: new Set() };
    count[k].cases++;
    count[k].clusters.add(c.cluster_id);
  }
  console.log(JSON.stringify(Object.fromEntries(Object.entries(count).sort().map(([k, v]) => [k, { cases: v.cases, clusters: v.clusters.size }])), null, 1));
  console.log('case exclusions', excluded.length);
})().catch(e => { console.error(e); process.exit(1); });
