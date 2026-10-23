"""Path-only copy of E3_reach_analyze.py for Deviation 2 (parser memory-leak fix): reads E3_reach_parserfix/, writes E3_reach_parserfix_analysis/.
Analysis logic, case sets and statistics are unchanged."""
"""Pre-registered analysis for E3-Reach (see E3_REACH_PREREGISTRATION.md). Written before results existed.

Read-only on inputs; writes only into ./E3_reach_analysis/.
Inputs:
  E3_reach/per_case_results.csv                                   (H=400 run)
  e3_reach_case_sets.json                                         (pre-registered sets; must hash to 29cbfc0a3d6bdb5c...)
  ../research_corrected_2026-10-21/per_case_results_corrected.csv (reproduced H=50 ranks; B1 validity reference)
"""
import csv
import hashlib
import itertools
import json
import os
import sys
from collections import OrderedDict, defaultdict

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, 'E3_reach_parserfix_analysis')
METHODS = ['b1', 'b2', 'b3', 'b4']
SETS_SHA_PREFIX = '29cbfc0a3d6bdb5c'


def rank(v):
    s = '' if v is None else str(v).strip()
    return None if s in ('', 'null', 'None') else int(float(s))


def rr(r):
    return 0.0 if r is None else 1.0 / r


def hit(r, k=10):
    return r is not None and r <= k


def sign_flip(deltas):
    m = len(deltas)
    obs = sum(deltas) / m
    ext = sum(1 for s in itertools.product((1, -1), repeat=m)
              if abs(sum(a * b for a, b in zip(s, deltas)) / m) >= abs(obs) - 1e-12)
    return {'clusters': m, 'observed_mean_delta': round(obs, 4), 'p_exact_two_sided': round(ext / 2 ** m, 5),
            'min_attainable_p': round(2 / 2 ** m, 5), 'cluster_deltas': [round(x, 4) for x in deltas]}


def cluster_deltas(cases, metric_fn, a, b):
    by = defaultdict(list)
    for c in cases:
        by[c['origin_commit']].append(metric_fn(c[f'{a}_rank']) - metric_fn(c[f'{b}_rank']))
    return [sum(v) / len(v) for v in by.values()]


def describe(cases):
    n = len(cases)
    out = OrderedDict(N=n, clusters=len({c['origin_commit'] for c in cases}))
    for m in METHODS:
        for k in (1, 5, 10):
            out[f'{m}_recall@{k}'] = round(sum(hit(c[f'{m}_rank'], k) for c in cases) / n, 4)
        out[f'{m}_mrr'] = round(sum(rr(c[f'{m}_rank']) for c in cases) / n, 4)
    out['b2_rescues'] = [c['case_id'] for c in cases if hit(c['b2_rank']) and not hit(c['b1_rank'])]
    out['fusion_rescues'] = [c['case_id'] for c in cases if hit(c['b4_rank']) and not hit(c['b1_rank'])]
    out['fusion_harms'] = [c['case_id'] for c in cases if hit(c['b1_rank']) and not hit(c['b4_rank'])]
    return out


def main():
    sets_path = os.path.join(D, 'e3_reach_case_sets.json')
    sha = hashlib.sha256(open(sets_path, 'rb').read()).hexdigest()
    if not sha.startswith(SETS_SHA_PREFIX):
        sys.exit(f'case-set file changed since pre-registration ({sha[:16]})')
    sets = json.load(open(sets_path, encoding='utf-8'))
    run = {r['case_id']: r for r in csv.DictReader(open(os.path.join(D, 'E3_reach_parserfix', 'per_case_results.csv'), encoding='utf-8'))}
    ref = {r['case_id']: r for r in csv.DictReader(open(os.path.join(D, '..', 'research_corrected_2026-10-21', 'per_case_results_corrected.csv'), encoding='utf-8'))}
    manifest = json.load(open(os.path.join(D, 'E3_reach_parserfix', 'run_manifest.json'), encoding='utf-8'))
    if os.path.exists(OUT):
        sys.exit(f'refusing to overwrite {OUT}')

    # Validity: all workers succeeded, H=400, every case present, B1 identical to H=50.
    invalid = []
    if manifest['configuration']['search_horizon'] != 400:
        invalid.append('search_horizon != 400')
    if any(s.get('worker_exit_code') != 0 for s in manifest['snapshots']):
        invalid.append('a worker failed')
    b1_diff = []
    for cid in ref:
        if cid.startswith('CASE-HIST-JAVA-0') and len(cid) == 19 and cid in {x for s in sets['sets'].values() for x in s['case_ids']} | set(sets['rejected_by_existing_audit_rule']):
            if cid not in run:
                invalid.append(f'missing {cid}')
            elif rank(run[cid]['b1_rank']) != rank(ref[cid]['b1_rank']):
                b1_diff.append((cid, rank(ref[cid]['b1_rank']), rank(run[cid]['b1_rank'])))
    if b1_diff:
        invalid.append(f'B1 ranks differ from H=50: {b1_diff}')

    cases = {cid: {'case_id': cid, 'origin_commit': r['origin_commit'], **{f'{m}_rank': rank(r[f'{m}_rank']) for m in METHODS},
                   'stage_a_status': r['stage_a_status'], 'history_window_position': r['history_window_position']}
             for cid, r in run.items()}

    results = OrderedDict(valid=not invalid, invalid_reasons=invalid, case_sets_sha256=sha, sets={})
    for name, s in sets['sets'].items():
        sub = [cases[c] for c in s['case_ids']]
        entry = describe(sub)
        if name in ('primary', 'strict_rename_sensitivity') or name.startswith('sensitivity_') or name.startswith('primary_'):
            entry['test_b4_minus_b1_mrr'] = sign_flip(cluster_deltas(sub, rr, 'b4', 'b1'))
            entry['test_b2_minus_b1_mrr'] = sign_flip(cluster_deltas(sub, rr, 'b2', 'b1'))
        results['sets'][name] = entry

    # Window-noise cost: previously in-window primary cases, H=50 -> H=400.
    noise = []
    for cid in sets['sets']['primary_in_window_H50']['case_ids']:
        noise.append({'case_id': cid, **{f'{m}_H50': rank(ref[cid][f'{m}_rank']) for m in ('b2', 'b4')},
                      **{f'{m}_H400': cases[cid][f'{m}_rank'] for m in ('b2', 'b4')}})
    results['window_noise_in_window_cases'] = noise

    # Pre-registered decision rule (primary only).
    p = results['sets']['primary']
    t = p['test_b4_minus_b1_mrr']
    harms, rescues = len(p['fusion_harms']), len(p['fusion_rescues'])
    if invalid:
        outcome = 'INVALID'
    elif t['observed_mean_delta'] <= 0 or harms > rescues:
        outcome = 'FAILURE'
    elif t['p_exact_two_sided'] < 0.05:
        outcome = 'SUCCESS'
    else:
        outcome = 'INCONCLUSIVE'
    results['primary_outcome'] = {'outcome': outcome, 'delta_mrr_b4_b1': t['observed_mean_delta'], 'p': t['p_exact_two_sided'],
                                  'clusters': t['clusters'], 'fusion_rescues': rescues, 'fusion_harms': harms}

    os.makedirs(OUT)
    with open(os.path.join(OUT, 'e3_reach_results.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    with open(os.path.join(OUT, 'e3_reach_per_case.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['case_id', 'origin_commit', 'b1_H50', 'b2_H50', 'b4_H50', 'b1_H400', 'b2_H400', 'b3_H400', 'b4_H400', 'stage_a_H400', 'window_pos_H400'])
        for cid in sorted(cases):
            c, r = cases[cid], ref.get(cid, {})
            w.writerow([cid, c['origin_commit'][:10], rank(r.get('b1_rank')), rank(r.get('b2_rank')), rank(r.get('b4_rank')),
                        c['b1_rank'], c['b2_rank'], c['b3_rank'], c['b4_rank'], c['stage_a_status'], c['history_window_position']])

    print('VALID' if not invalid else f'INVALID: {invalid}')
    print('PRIMARY OUTCOME:', json.dumps(results['primary_outcome']))
    for name, e in results['sets'].items():
        line = f"{name:34s} N={e['N']:2d} cl={e['clusters']:2d} " + ' '.join(
            f"{m.upper()} R@10={e[f'{m}_recall@10']:.2f} MRR={e[f'{m}_mrr']:.3f}" for m in METHODS)
        if 'test_b4_minus_b1_mrr' in e:
            line += f" | dB4-B1={e['test_b4_minus_b1_mrr']['observed_mean_delta']:+.3f} p={e['test_b4_minus_b1_mrr']['p_exact_two_sided']}"
            line += f" | dB2-B1={e['test_b2_minus_b1_mrr']['observed_mean_delta']:+.3f} p={e['test_b2_minus_b1_mrr']['p_exact_two_sided']}"
        line += f" | resc={len(e['b2_rescues'])} fRes={len(e['fusion_rescues'])} harm={len(e['fusion_harms'])}"
        print(line)
    print('window noise (in-window cases, B2/B4 H50 -> H400):', [(n['case_id'][-4:], n['b2_H50'], n['b2_H400'], n['b4_H50'], n['b4_H400']) for n in noise])


if __name__ == '__main__':
    main()
