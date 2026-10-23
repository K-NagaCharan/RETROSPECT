"""Rule-based verification of mined candidate events (read-only git checks).

Input : candidate_events/<language>/<repo>.jsonl (from scripts/event_mining/mine_events.js)
Output: verified_events/<language>/<repo>.jsonl   (events that pass every gate, with a lineage label)
        ground_truth/exclusions.jsonl            (every rejected candidate with explicit reasons)
        ground_truth/evolution_events.jsonl      (all verified events, all languages)
        verified_events/verification_summary.json

"Verified" here means MACHINE-VERIFIED against source evidence by fixed rules (documented in
reports/ground_truth_protocol.md). It is not human adjudication; human review status is recorded per event.
Rules are fixed before any retrieval result exists and must not be changed in response to retrieval results.

Usage: python -I verify_events.py
"""
import glob
import hashlib
import json
import os
import re
import subprocess
from collections import Counter, defaultdict

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LANGS = ('java', 'python', 'javascript', 'typescript')
REPO_PATHS = {}  # filled from REPOSITORY_INVENTORY.csv
DEV_REPOS = {'guava', 'requests', 'zod'}  # previously used during development: development split only
CHAIN_LABELS = {'strict_rename', 'rename_signature_change', 'rename_move', 'move', 'extraction', 'inlining', 'split'}
# Paths the miner's NONPROD filter missed (found by a pre-freeze audit, before any retrieval run): minified/generated
# builds (moment min/, lodash npm-package/), documentation sources (fastapi docs_src/), integration tests (src/it/, *IT.java,
# integration-test/), build tasks and CLI/tool scripts (tasks/, bin/, gallery/).
NONPROD_EXTRA = re.compile(r'(^|/)(min|docs_src|npm-package|integration-tests?|tasks|bin|gallery)(/|$)|(^|/)src/it/|\.min\.js$|IT\.java$')
RULES = {'strong_similarity': 0.8, 'margin': 0.1, 'continuity': 0.5, 'containment': 0.6}


def load_repo_paths():
    import csv
    with open(os.path.join(W, 'REPOSITORY_INVENTORY.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            REPO_PATHS[r['repository']] = r['local_path']


_cache = {}


def git_show(repo, rev, path):
    key = (repo, rev, path)
    if key not in _cache:
        r = subprocess.run(['git', '-C', REPO_PATHS[repo], 'show', f'{rev}:{path}'], capture_output=True, text=True, encoding='utf-8', errors='replace')
        if len(_cache) > 3000:
            _cache.clear()
        _cache[key] = r.stdout if r.returncode == 0 else None
    return _cache[key]


def commit_exists(repo, sha):
    return subprocess.run(['git', '-C', REPO_PATHS[repo], 'cat-file', '-e', f'{sha}^{{commit}}'], capture_output=True).returncode == 0


def line_has(src, line, name):
    if src is None:
        return False
    lines = src.splitlines()
    # declaration may start on a decorator/annotation line; allow a 3-line window
    return any(re.search(r'\b' + re.escape(name) + r'\b', lines[i]) for i in range(max(0, line - 1), min(len(lines), line + 2)))


def word_in(src, name):
    return src is not None and re.search(r'\b' + re.escape(name) + r'\b', src) is not None


def label(ev):
    t, b, a = ev['candidate_type'], ev['before'], ev['after']
    sim = ev.get('similarity') or 0
    margin = sim - (ev.get('second_best_similarity') or 0)
    strong = sim >= RULES['strong_similarity'] and margin >= RULES['margin']
    if t == 'rename' and strong:
        return 'rename_signature_change' if ev.get('signature_changed') else 'strict_rename'
    if t == 'rename_move' and strong:
        return 'rename_move'
    if t == 'move' and strong:
        return 'move'
    if t == 'scope_change' and strong:
        return 'move'  # same name and file, different enclosing scope
    if t in ('rename', 'rename_move', 'move', 'scope_change', 'ambiguous_pairing'):
        return 'ambiguous'
    if t == 'signature_change':
        return 'signature_change' if sim >= RULES['continuity'] else 'rewrite_same_name'
    if t == 'extraction' and (ev.get('containment') or 0) >= RULES['containment']:
        return 'extraction'
    if t == 'inlining' and (ev.get('containment') or 0) >= RULES['containment']:
        return 'inlining'
    if t == 'split_part':
        return 'split'
    if t == 'deletion_no_successor':
        return 'no_valid_lineage' if ev.get('strong_negative_candidate') else 'unresolved_deletion'
    return 'ambiguous'


def main():
    load_repo_paths()
    os.makedirs(os.path.join(W, 'ground_truth'), exist_ok=True)
    verified_all, excluded_all = [], []
    summary = defaultdict(lambda: defaultdict(Counter))
    for lang in LANGS:
        for path in sorted(glob.glob(os.path.join(W, 'candidate_events', lang, '*.jsonl'))):
            repo = os.path.basename(path)[:-6]
            if not os.path.exists(path[:-6] + '.summary.json'):
                print('skip incomplete', path)
                continue
            out_dir = os.path.join(W, 'verified_events', lang)
            os.makedirs(out_dir, exist_ok=True)
            verified = []
            seen_pairs = {}
            for line in open(path, encoding='utf-8'):
                ev = json.loads(line)
                reasons = []
                if not commit_exists(repo, ev['commit']) or not commit_exists(repo, ev['parent']):
                    reasons.append('commit_or_parent_missing')
                b, a = ev['before'], ev['after']
                if any(s and NONPROD_EXTRA.search(s['file']) for s in (b, a)):
                    reasons.append('non_production_path')
                if b:
                    src_b = git_show(repo, ev['parent'], b['file'])
                    if src_b is None:
                        reasons.append('before_source_unavailable')
                    elif not line_has(src_b, b['startLine'], b['name']):
                        reasons.append('before_symbol_not_at_recorded_line')
                if a:
                    src_a = git_show(repo, ev['commit'], a['file'])
                    if src_a is None:
                        reasons.append('after_source_unavailable')
                    elif not line_has(src_a, a['startLine'], a['name']):
                        reasons.append('after_symbol_not_at_recorded_line')
                lab = label(ev)
                if lab in ('strict_rename', 'rename_signature_change', 'rename_move') and b and a:
                    # name really changed: old name absent from the successor file, new name absent from the predecessor file
                    if word_in(git_show(repo, ev['commit'], a['file']), b['name']) and ev['candidate_type'] != 'rename_move':
                        lab = 'ambiguous'
                        ev['label_note'] = 'old name still present in successor file after the commit'
                    elif word_in(git_show(repo, ev['parent'], b['file']), a['name']):
                        lab = 'ambiguous'
                        ev['label_note'] = 'new name already present in predecessor file before the commit'
                # Same symbol pair: the same task across commits for identity-changing labels (e.g. a re-applied rename),
                # but distinct events across commits for same-identity edits.
                pair_key = (b and (b['file'], b['qualifiedName']), a and (a['file'], a['qualifiedName']), lab,
                            None if lab in CHAIN_LABELS else ev['commit'])
                if pair_key in seen_pairs and lab not in ('no_valid_lineage', 'unresolved_deletion'):
                    reasons.append(f'duplicate_of:{seen_pairs[pair_key]}')
                if reasons:
                    excluded_all.append({'event_id': ev['event_id'], 'repository': repo, 'language': lang, 'candidate_type': ev['candidate_type'],
                                         'commit': ev['commit'], 'reasons': reasons})
                    summary[lang][repo]['excluded'] += 1
                    continue
                seen_pairs[pair_key] = ev['event_id']
                ev['lineage_label'] = lab
                ev['status'] = 'machine_verified'
                ev['human_review'] = 'not_reviewed'
                ev['development_only_repository'] = repo in DEV_REPOS
                verified.append(ev)
                summary[lang][repo][lab] += 1
            with open(os.path.join(out_dir, f'{repo}.jsonl'), 'w', encoding='utf-8') as f:
                for ev in verified:
                    f.write(json.dumps(ev) + '\n')
            verified_all.extend(verified)

    # Clusters: events from the same commit, merged along evolution chains (A->B then B->C) via union-find.
    parent = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        parent[find(x)] = find(y)

    # Only identity-changing events create chain links. Same-identity edits and deletions do not: linking through them
    # merged every commit touching a frequently edited function into one giant component.
    for ev in verified_all:
        c = f"{ev['repository']}:{ev['commit']}"
        find(c)
        if ev['lineage_label'] not in CHAIN_LABELS:
            continue
        for side in ('before', 'after'):
            s = ev[side]
            if s:
                union(c, f"{ev['repository']}:sym:{s['file']}::{s['qualifiedName']}")
    for ev in verified_all:
        root = find(f"{ev['repository']}:{ev['commit']}")
        ev['cluster_id'] = hashlib.sha256(root.encode()).hexdigest()[:12]

    with open(os.path.join(W, 'ground_truth', 'evolution_events.jsonl'), 'w', encoding='utf-8') as f:
        for ev in verified_all:
            f.write(json.dumps(ev) + '\n')
    with open(os.path.join(W, 'ground_truth', 'exclusions.jsonl'), 'w', encoding='utf-8') as f:
        for x in excluded_all:
            f.write(json.dumps(x) + '\n')
    flat = {lang: {repo: dict(c) for repo, c in repos.items()} for lang, repos in summary.items()}
    clusters = defaultdict(set)
    for ev in verified_all:
        clusters[ev['language']].add(ev['cluster_id'])
    out = {'rules': RULES, 'by_language_repo_label': flat, 'verified_events': len(verified_all), 'excluded_candidates': len(excluded_all),
           'clusters_by_language': {k: len(v) for k, v in clusters.items()},
           'exclusion_reasons': Counter(r.split(':')[0] for x in excluded_all for r in x['reasons'])}
    with open(os.path.join(W, 'verified_events', 'verification_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
    print(json.dumps({k: out[k] for k in ('verified_events', 'excluded_candidates', 'clusters_by_language', 'exclusion_reasons')}, indent=1))
    for lang, repos in flat.items():
        tot = Counter()
        for c in repos.values():
            tot.update(c)
        print(lang, dict(tot))


if __name__ == '__main__':
    main()
