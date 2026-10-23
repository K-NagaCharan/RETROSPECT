"""Consolidate Retrospect's existing experiment outputs into authoritative current metrics.

Read-only on all inputs. Writes CURRENT_PROJECT_RESULTS.json, CURRENT_PROJECT_CASE_RESULTS.csv and
current_inventory_registry.json into the workspace root. Every metric is recomputed from case-level ranks.

Usage:  python -I consolidate_current_results.py
"""
import csv
import hashlib
import itertools
import json
import os
import statistics
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R = 'D:/base papers considered/Retrospect'
X = R + '/research_execution_2026-10-21'
C = R + '/research_corrected_2026-10-21'
CATB = 'D:/base papers considered/Test creation/results/category_b_benchmark_repair_2026-10-19/category_b_repaired.json'
CONFIGS = OrderedDict([('b1', 'B1_structural_only'), ('b2', 'B2_historical_only'), ('b3', 'B3_linear_fusion_0.6S_0.4H'), ('b4', 'B4_rrf_v2_k60_0.5_0.5')])


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def read_csv(p):
    with open(p, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def rank(v):
    s = '' if v is None else str(v).strip()
    return None if s in ('', 'null', 'None') else int(float(s))


def sign_flip(deltas):
    m = len(deltas)
    if m == 0:
        return None
    obs = sum(deltas) / m
    if m > 20:
        return {'clusters': m, 'observed_mean_delta': round(obs, 4), 'p_exact_two_sided': None, 'note': 'too many clusters for exact enumeration'}
    ext = sum(1 for s in itertools.product((1, -1), repeat=m) if abs(sum(a * b for a, b in zip(s, deltas)) / m) >= abs(obs) - 1e-12)
    return {'clusters': m, 'observed_mean_delta': round(obs, 4), 'p_exact_two_sided': round(ext / 2 ** m, 5), 'min_attainable_p': round(2 / 2 ** m, 5)}


def metrics(cases, base='b1', hist='b4'):
    n = len(cases)
    out = OrderedDict(cases=n, independent_clusters=len({c['cluster'] for c in cases}))
    if not n:
        return out
    for k, name in CONFIGS.items():
        rs = [c[f'{k}_rank'] for c in cases]
        ranked = sorted(r for r in rs if r is not None)
        m = OrderedDict()
        for cut in (1, 5, 10):
            m[f'recall@{cut}'] = round(sum(1 for r in rs if r is not None and r <= cut) / n, 4)
        m['mrr'] = round(sum(1 / r for r in rs if r is not None) / n, 4)
        # Median over all cases with unranked treated as +infinity; None if more than half are unranked.
        allr = sorted([r if r is not None else float('inf') for r in rs])
        med = statistics.median(allr) if allr else None
        m['median_rank_unranked_as_inf'] = None if med == float('inf') else med
        m['median_rank_among_ranked'] = statistics.median(ranked) if ranked else None
        m['pct_not_retrieved'] = round(100 * sum(1 for r in rs if r is None) / n, 1)
        out[name] = m

    def cmp(a, b):
        res = {'rescues@10': [], 'harms@10': [], 'rank_improved_same_top10_status': [], 'rank_regressed_same_top10_status': []}
        for c in cases:
            ra, rb = c[f'{a}_rank'], c[f'{b}_rank']
            ha, hb = ra is not None and ra <= 10, rb is not None and rb <= 10
            if hb and not ha:
                res['rescues@10'].append(c['case_id'])
            elif ha and not hb:
                res['harms@10'].append(c['case_id'])
            elif ra is not None and rb is not None and ha == hb:
                if rb < ra:
                    res['rank_improved_same_top10_status'].append(c['case_id'])
                elif rb > ra:
                    res['rank_regressed_same_top10_status'].append(c['case_id'])
        return {k: {'count': len(v), 'case_ids': v} for k, v in res.items()}

    out['B4_vs_B1'] = cmp('b1', 'b4')
    out['B2_vs_B1'] = cmp('b1', 'b2')
    out['B2_no_historical_score'] = {'count': sum(1 for c in cases if c['b2_rank'] is None)}
    by = defaultdict(list)
    for c in cases:
        by[c['cluster']].append((1 / c['b4_rank'] if c['b4_rank'] else 0) - (1 / c['b1_rank'] if c['b1_rank'] else 0))
    out['cluster_sign_flip_B4_minus_B1_mrr'] = sign_flip([sum(v) / len(v) for v in by.values()])
    return out


def load_java(run_csv, experiment, horizon):
    sets = json.load(open(X + '/e3_reach_case_sets.json', encoding='utf-8'))
    primary = set(sets['sets']['primary']['case_ids'])
    roles = {r['case_id']: r for r in read_csv(C + '/per_case_results_corrected.csv')}
    rows = []
    for r in read_csv(run_csv):
        cid = r['case_id']
        cls = sets['classification'].get(cid) or ('rejected_ground_truth' if cid in sets['rejected_by_existing_audit_rule'] else
                                                  sets['exclusions'].get(cid, 'unclassified').split(':')[0].split(' ')[0])
        rows.append(OrderedDict(
            experiment=experiment, data_status='final-study candidate (Category B; not pristine held-out)', language='java',
            repository=r['repository_id'], case_id=cid, cluster=r['origin_commit'][:10], history_horizon=horizon,
            transformation=cls, in_E3_primary=cid in primary,
            excluded_reason=sets['exclusions'].get(cid, 'rejected by existing audit rule' if cid in sets['rejected_by_existing_audit_rule'] else ''),
            stage_a_status=r['stage_a_status'], window_position=r['history_window_position'],
            role_2026_10_21=roles[cid]['evaluation_role'],
            **{f'{k}_rank': rank(r[f'{k}_rank']) for k in CONFIGS}))
    return rows


def load_phase_b():
    meta = {c['case_id']: c for c in json.load(open(X + '/phase_b_input/phase_b_case_study_input.json', encoding='utf-8'))}
    rows = []
    for r in read_csv(X + '/E2_after_fix2/per_case_results.csv'):
        m = meta[r['case_id']]
        rows.append(OrderedDict(
            experiment='E2_phase_b_after_fix2', data_status='development set (fusion designed on it; NOT held-out)',
            language=m['target_language'], repository=r['repository_id'], case_id=r['case_id'], cluster=r['origin_commit'][:10],
            history_horizon=50, transformation=m['phase_b_metadata']['evolution_type'], in_E3_primary=False,
            excluded_reason='', stage_a_status=r['stage_a_status'], window_position=r['history_window_position'],
            role_2026_10_21='phase_b_' + str(m['phase_b_metadata']['verification_status']),
            **{f'{k}_rank': rank(r[f'{k}_rank']) for k in CONFIGS}))
    return rows


def main():
    e1 = load_java(X + '/E1_after_fix2/per_case_results.csv', 'E1_java_H50_after_fix2', 50)
    e3 = load_java(X + '/E3_reach/per_case_results.csv', 'E3_reach_java_H400', 400)
    e2 = load_phase_b()
    lineage = json.load(open(X + '/E_lineage/e_lineage_results.json', encoding='utf-8'))
    e3_prereg = json.load(open(X + '/E3_reach_analysis/e3_reach_results.json', encoding='utf-8'))

    res = OrderedDict(generated_utc=datetime.now(timezone.utc).isoformat(timespec='seconds'), configurations=CONFIGS)
    # E1 / E3 by analysis set
    sets = json.load(open(X + '/e3_reach_case_sets.json', encoding='utf-8'))
    prim = set(sets['sets']['primary']['case_ids'])
    res['E1_java_H50'] = OrderedDict(
        all_29_reference=metrics(e1), primary_18=metrics([c for c in e1 if c['case_id'] in prim]),
        primary_in_window=metrics([c for c in e1 if c['case_id'] in prim and c['window_position'] not in ('', None)]),
        primary_outside_window=metrics([c for c in e1 if c['case_id'] in prim and c['window_position'] in ('', None)]))
    res['E3_reach_java_H400'] = OrderedDict(
        primary_18=metrics([c for c in e3 if c['case_id'] in prim]),
        strict_rename_9=metrics([c for c in e3 if c['case_id'] in set(sets['sets']['strict_rename_sensitivity']['case_ids'])]),
        by_transformation={t: metrics([c for c in e3 if c['case_id'] in prim and c['transformation'] == t])
                           for t in sorted({c['transformation'] for c in e3 if c['case_id'] in prim})},
        preregistered_outcome_from_analysis_file=e3_prereg['primary_outcome'],
        preregistered_validity=e3_prereg['valid'])
    res['E2_phase_b_dev'] = OrderedDict()
    for lang in ('java', 'python', 'javascript', 'typescript'):
        sub = [c for c in e2 if c['language'] == lang]
        res['E2_phase_b_dev'][lang] = OrderedDict(
            all=metrics(sub),
            evidence_commit_in_window=metrics([c for c in sub if c['window_position'] not in ('', None)]),
            by_transformation={t: metrics([c for c in sub if c['transformation'] == t]) for t in sorted({c['transformation'] for c in sub})})
    lin = defaultdict(lambda: defaultdict(int))
    for r in lineage['results']:
        lin[r['language']]['cases'] += 1
        lin[r['language']][r['outcome']] += 1
    res['E_lineage'] = {k: dict(v) for k, v in lin.items()}
    res['E_lineage_clusters'] = {lang: len({r['labelled_commit'] for r in lineage['results'] if r['language'] == lang}) for lang in lin}
    res['E1_reproduction'] = {f: open(X + '/' + f, encoding='utf-8').read().strip().splitlines()[-2] for f in
                              ('E1_comparison.txt', 'E1_after_fix_comparison.txt', 'E1_after_fix2_comparison.txt')}
    res['inputs'] = {p: sha(p) for p in [X + '/E1_after_fix2/per_case_results.csv', X + '/E3_reach/per_case_results.csv',
                                         X + '/E2_after_fix2/per_case_results.csv', X + '/e3_reach_case_sets.json',
                                         X + '/E_lineage/e_lineage_results.json', X + '/E3_reach_analysis/e3_reach_results.json',
                                         C + '/per_case_results_corrected.csv', X + '/phase_b_input/phase_b_case_study_input.json']}
    with open(os.path.join(W, 'CURRENT_PROJECT_RESULTS.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=2, default=str)
    rows = e1 + e3 + e2
    with open(os.path.join(W, 'CURRENT_PROJECT_CASE_RESULTS.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print('rows', len(rows), '| E1', len(e1), 'E3', len(e3), 'E2', len(e2))
    # Short console summary
    def line(tag, m):
        return f"{tag:48s} N={m['cases']:2d} cl={m['independent_clusters']:2d} " + ' '.join(
            f"{n.split('_')[0]} R@10={m[n]['recall@10']:.2f} MRR={m[n]['mrr']:.3f} unret={m[n]['pct_not_retrieved']:.0f}%" for n in CONFIGS.values())
    print(line('E1 primary18 H50', res['E1_java_H50']['primary_18']))
    print(line('E3 primary18 H400', res['E3_reach_java_H400']['primary_18']), res['E3_reach_java_H400']['primary_18']['cluster_sign_flip_B4_minus_B1_mrr'])
    for lang, v in res['E2_phase_b_dev'].items():
        print(line(f'E2 {lang}', v['all']))
    print('lineage', res['E_lineage'], res['E_lineage_clusters'])


if __name__ == '__main__':
    main()
