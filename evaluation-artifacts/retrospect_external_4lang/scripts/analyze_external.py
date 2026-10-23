"""Pre-registered analysis of the external 4-language rename benchmark (protocol.md). Run with python -I.

Usage: python -I analyze_external.py --run runs/<name> --out analysis/<new dir>
Writes results.json and per_case.csv. Statistics are reused from analyze_benchmark.py (copied unchanged into this
workspace) with SEED set to 20261023: sign_flip (Monte Carlo, 100,000 assignments, p = (count + 1)/(N + 1) when more
than 20 units; exact enumeration otherwise), bootstrap_ci (10,000 resamples, percentile), metrics, transitions.
The independence unit is the repository (one event per repository).
"""
import argparse
import csv
import json
import os
import statistics
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze_benchmark as A  # noqa: E402

A.SEED = 20261023
W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
H = '400'
SYSTEMS = ('b1', 'b2', 'b3', 'b4', 'g')
LANGS = ('java', 'python', 'javascript', 'typescript')


def rr(r):
    return 1.0 / r if r else 0.0


def load(run):
    meta = {json.loads(l)['case_id']: json.loads(l) for l in open(os.path.join(W, 'cases', 'cases.jsonl'), encoding='utf-8')}
    rows, skipped = [], []
    for line in open(os.path.join(run, 'case_results.jsonl'), encoding='utf-8'):
        r = json.loads(line)
        if r.get('skipped'):
            skipped.append(r)
            continue
        m = meta[r['case_id']]
        h = r['horizons'][H]
        rows.append({'case_id': r['case_id'], 'task': r['task'], 'template': m.get('template'), 'repository': r['repository'], 'language': r['language'],
                     'source': m['source'], 'old_name': m['old_name'], 'new_name': m['new_name'], 'commit_url': m['commit_url'], 'pin': m['pin'],
                     'name_subtoken_overlap': m.get('name_subtoken_overlap'), 'target': m['accepted_targets'][0], 'query': m['query'],
                     'target_indexed': r['target_indexed'], 'reach': h['reach_status'], 'diffed': h['origin_diff_analyzed'],
                     'parser_ok': (r.get('parser_healthy_after_history') or {}).get(H),
                     'b1': r['b1_rank'], 'b2': h['b2_rank'], 'b3': h['b3_rank'], 'b4': h['b4_rank'], 'g': h['g_rank'],
                     'g_ids': h.get('g_ids'), 'g_lineage_matches': h.get('g_lineage_matches'), 'g_identical_to_b1': h.get('g_identical_to_b1'),
                     'b1_latency_ms': r.get('b1_latency_ms'), 'g_latency_ms': h.get('g_latency_ms')})
    return rows, skipped, meta


def per_repo(rows, sys_):
    """Repository-level mean reciprocal rank (B_nl: mean over its 3 templates)."""
    by = defaultdict(list)
    for r in rows:
        by[r['repository']].append(rr(r[sys_]))
    return {k: statistics.mean(v) for k, v in by.items()}


def compare(rows, sys_, base='b1'):
    a, b = per_repo(rows, sys_), per_repo(rows, base)
    repos = sorted(a)
    d = [a[k] - b[k] for k in repos]
    sf = A.sign_flip(d) if d else None
    return {'repositories': len(d), 'cases': len(rows),
            'mrr_' + base: round(statistics.mean(b[k] for k in repos), 4) if d else None,
            'mrr_' + sys_: round(statistics.mean(a[k] for k in repos), 4) if d else None,
            'delta': round(statistics.mean(d), 4) if d else None, 'ci95_repository_bootstrap': A.bootstrap_ci(d),
            'p_two_sided': sf and sf['p'], 'test': sf and sf['method'],
            'transitions': A.transitions([r[base] for r in rows], [r[sys_] for r in rows])}


def block(rows):
    return {'metrics': {s: A.metrics([r[s] for r in rows]) for s in SYSTEMS},
            **{f'{s}_vs_b1': compare(rows, s) for s in ('g', 'b2', 'b3', 'b4')}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    if os.path.exists(a.out):
        raise SystemExit(f'refusing to overwrite {a.out}')
    rows, skipped, meta = load(a.run)
    bid = [r for r in rows if r['task'] == 'B_id']
    bnl = [r for r in rows if r['task'] == 'B_nl']
    ta = [r for r in rows if r['task'] == 'A']
    res = {'protocol': 'protocol.md', 'run': a.run, 'seed': A.SEED, 'horizon': int(H), 'skipped_cases': len(skipped),
           'integrity': {'not_indexed': [r['case_id'] for r in rows if not r['target_indexed']],
                         'parser_unhealthy_H400': sorted({r['repository'] for r in rows if r['parser_ok'] is False}),
                         'not_in_window_or_not_diffed': sorted({r['repository'] for r in rows if not (r['reach'] == 'IN_WINDOW' and r['diffed'])}),
                         'g_equals_b1_when_L_empty_violations': [r['case_id'] for r in rows if r['g_lineage_matches'] == 0 and (r['g_identical_to_b1'] is not True or r['g'] != r['b1'])]}}

    # Confirmatory: Task B_id, G vs B1, pooled over repositories.
    c = compare(bid, 'g')
    t = c['transitions']
    resc, harm = t.get('rescue@10', 0), t.get('harm@10', 0)
    if c['delta'] is None:
        dec = 'NOT_TESTABLE'
    elif c['delta'] <= 0 or harm > resc:
        dec = 'NOT SUPPORTED'
    elif c['p_two_sided'] < 0.05 and resc > harm:
        dec = 'SUPPORTED'
    else:
        dec = 'INCONCLUSIVE'
    res['confirmatory'] = {'task': 'B_id', 'comparison': 'G vs B1', **c, 'metrics': {s: A.metrics([r[s] for r in bid]) for s in ('b1', 'g')},
                           'rescues@10': resc, 'harms@10': harm, 'decision': dec}

    # Harm check (non-inferiority): Task A, G vs B1.
    h = compare(ta, 'g')
    th = h['transitions']
    res['harm_check'] = {'task': 'A', 'comparison': 'G vs B1', **h, 'harms@10': th.get('harm@10', 0),
                         'result': 'PASS' if (h['delta'] is not None and th.get('harm@10', 0) == 0 and h['delta'] >= -0.01) else ('FAIL' if h['delta'] is not None else 'NOT_TESTABLE')}

    # Descriptive.
    d = {'B_id': block(bid), 'B_nl': block(bnl), 'A': block(ta)}
    d['per_language'] = {L: {'B_id': block([r for r in bid if r['language'] == L]), 'B_nl': block([r for r in bnl if r['language'] == L])} for L in LANGS}
    d['source_stratum'] = {k: {'B_id': block([r for r in bid if r['source'] in v]), 'B_nl': block([r for r in bnl if r['source'] in v])}
                           for k, v in (('S1+S2', ('S1', 'S2')), ('S3+S3b', ('S3', 'S3b')))}
    d['per_template'] = {str(k): block([r for r in bnl if r['template'] == k]) for k in (1, 2, 3)}
    d['name_overlap'] = {k: {'B_id': block([r for r in bid if f(r)])} for k, f in (('zero_subtoken_overlap', lambda r: not r['name_subtoken_overlap']),
                                                                                    ('some_overlap', lambda r: bool(r['name_subtoken_overlap'])))}
    d['b_nl_ids_extracted'] = {str(k): sum(1 for r in bnl if r['template'] == k and r['g_ids']) for k in (1, 2, 3)}
    # Cost per repository.
    man = json.load(open(os.path.join(a.run, 'run_manifest.json'), encoding='utf-8'))
    work = {}
    for L in LANGS:
        wd = os.path.join(W, 'cases', 'work', L)
        if os.path.isdir(wd):
            for fn in os.listdir(wd):
                if fn.endswith('.json'):
                    j = json.load(open(os.path.join(wd, fn), encoding='utf-8'))
                    if j.get('status') == 'selected':
                        work[j['repository']] = j
    cost = {}
    for s in man['snapshots']:
        lat = [r for r in rows if r['repository'] == s['repository']]
        cost[s['repository']] = {'clone_seconds': (work.get(s['repository'], {}).get('clone') or {}).get('seconds'),
                                 'index_seconds': s.get('index_seconds'), 'history_seconds_H400': s.get(f'history_seconds_H{H}'),
                                 'history_profile_size_H400': s.get(f'history_symbols_with_history_H{H}'), 'symbols': s.get('symbols'),
                                 'median_latency_ms_b1': round(statistics.median(x['b1_latency_ms'] for x in lat), 2) if lat else None,
                                 'median_latency_ms_g': round(statistics.median(x['g_latency_ms'] for x in lat), 2) if lat else None,
                                 'extraction_failures': {'structural': (s.get('structural_extraction_failures') or {}).get('count'),
                                                         'history_H400': (s.get(f'history_extraction_failures_H{H}') or {}).get('count')},
                                 'parser_healthy_H400': s.get(f'parser_healthy_after_history_H{H}'),
                                 'clean_at_pin_before_after': bool(s.get('clean_before') and s.get('clean_after') and s.get('head_before') == s.get('head_after'))}
    d['cost_per_repository'] = cost
    res['descriptive'] = d

    # Worked examples (fixed rule): per language, the B_id case with the largest RR_G - RR_B1; ties -> repository name.
    ex = {}
    for L in LANGS:
        cand = sorted((r for r in bid if r['language'] == L), key=lambda r: (-(rr(r['g']) - rr(r['b1'])), r['repository']))
        if cand:
            r = cand[0]
            nl = {str(x['template']): {s: x[s] for s in SYSTEMS} for x in bnl if x['repository'] == r['repository']}
            ex[L] = {'repository': r['repository'], 'source': r['source'], 'commit_url': r['commit_url'], 'old_name': r['old_name'], 'new_name': r['new_name'],
                     'target': r['target'], 'pin': r['pin'], 'b_id_ranks': {s: r[s] for s in SYSTEMS}, 'g_lineage_matches': r['g_lineage_matches'],
                     'b_nl_ranks_by_template': nl}
    res['worked_examples'] = ex
    res['funnel'] = json.load(open(os.path.join(W, 'cases', 'funnel.json'), encoding='utf-8'))
    os.makedirs(a.out)
    with open(os.path.join(a.out, 'results.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=2)
    cols = ['case_id', 'task', 'template', 'language', 'repository', 'source', 'old_name', 'new_name', 'name_subtoken_overlap', 'target_indexed',
            'reach', 'diffed', 'parser_ok', 'b1', 'b2', 'b3', 'b4', 'g', 'g_lineage_matches', 'g_identical_to_b1', 'b1_latency_ms', 'g_latency_ms', 'commit_url', 'query']
    with open(os.path.join(a.out, 'per_case.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)
    print(json.dumps({'confirmatory': {k: res['confirmatory'][k] for k in ('repositories', 'mrr_b1', 'mrr_g', 'delta', 'ci95_repository_bootstrap', 'p_two_sided', 'rescues@10', 'harms@10', 'decision')},
                      'harm_check': {k: res['harm_check'][k] for k in ('repositories', 'mrr_b1', 'mrr_g', 'delta', 'harms@10', 'result')},
                      'integrity': res['integrity']}, indent=1))


if __name__ == '__main__':
    main()
