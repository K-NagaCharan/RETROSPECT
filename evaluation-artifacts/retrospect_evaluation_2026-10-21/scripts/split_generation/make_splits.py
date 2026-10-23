"""Deterministic cluster-grouped split of retrieval cases (no retrieval results are read).

Input : ground_truth/retrieval_cases.jsonl
Output: retrieval_cases/{development,validation,held_out_test}/cases.jsonl, manifests/split_manifest.json

Rules (fixed in reports/evaluation_protocol.md):
  * The grouping key is cluster_id (commit + evolution-chain union), so all queries of one event/commit/chain share a split.
  * Clusters from repositories previously used during development (guava, requests, zod) -> development only.
  * Other clusters: bucket = int(sha256(SEED + cluster_id), 16) % 100;  <20 development, <35 validation, else held_out_test.
Usage: python -I make_splits.py
"""
import hashlib
import json
import os
from collections import Counter, defaultdict

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SEED = 'retrospect-eval-2026-10-21'


def split_of(case):
    if case['development_only_repository']:
        return 'development'
    b = int(hashlib.sha256((SEED + case['cluster_id']).encode()).hexdigest(), 16) % 100
    return 'development' if b < 20 else ('validation' if b < 35 else 'held_out_test')


def main():
    cases = [json.loads(l) for l in open(os.path.join(W, 'ground_truth', 'retrieval_cases.jsonl'), encoding='utf-8')]
    out = defaultdict(list)
    for c in cases:
        c['split'] = split_of(c)
        out[c['split']].append(c)
    # integrity: no cluster in two splits; no (event, task) duplicate
    cl = defaultdict(set)
    for c in cases:
        cl[c['cluster_id']].add(c['split'])
    leaks = [k for k, v in cl.items() if len(v) > 1]
    assert not leaks, f'cluster split leakage: {leaks[:5]}'
    assert len({(c['event_id'], c['task']) for c in cases}) == len(cases), 'duplicate event/task case'
    for s, rows in out.items():
        d = os.path.join(W, 'retrieval_cases', s)
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, 'cases.jsonl')
        if os.path.exists(p):
            raise SystemExit(f'refusing to overwrite {p}')
        with open(p, 'w', encoding='utf-8') as f:
            for r in rows:
                f.write(json.dumps(r) + '\n')
    summary = {}
    for s, rows in out.items():
        summary[s] = {
            'cases': len(rows), 'clusters': len({r['cluster_id'] for r in rows}),
            'by_language_task': {f"{l}/{t}": {'cases': n, 'clusters': len({r['cluster_id'] for r in rows if r['language'] == l and r['task'] == t})}
                                 for (l, t), n in sorted(Counter((r['language'], r['task']) for r in rows).items())},
            'by_label': dict(Counter(r['lineage_label'] for r in rows)),
            'repositories': dict(Counter(r['repository'] for r in rows)),
        }
    manifest = {'seed': SEED, 'algorithm': 'sha256(seed+cluster_id) % 100 -> <20 development, <35 validation, else held_out_test; development-only repositories forced to development',
                'grouping_key': 'cluster_id', 'cluster_leakage_check': 'passed', 'splits': summary,
                'files': {s: hashlib.sha256(open(os.path.join(W, 'retrieval_cases', s, 'cases.jsonl'), 'rb').read()).hexdigest() for s in out}}
    os.makedirs(os.path.join(W, 'manifests'), exist_ok=True)
    with open(os.path.join(W, 'manifests', 'split_manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps({s: {k: v[k] for k in ('cases', 'clusters', 'by_language_task')} for s, v in summary.items()}, indent=1))


if __name__ == '__main__':
    main()
