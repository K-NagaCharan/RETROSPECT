"""Aggregate the sprint's experiment outputs. Read-only on inputs; writes only into this folder.

Inputs:
  E1_java_reproduction/per_case_results.csv        (29 Category B Java cases, fresh run)
  E2_phase_b_four_language/per_case_results.csv    (34 Phase B cases with targets, fresh run)
  E2_phase_b_four_language/worker_output__*.json   (stage A window fields)
  phase_b_input/phase_b_case_study_input.json      (Phase B metadata, copied from data/)
  ../research_corrected_2026-10-21/per_case_results_corrected.csv  (Java roles)

Outputs: per_case_results_all.csv, aggregate_metrics.csv, aggregate_metrics.json
Metrics: Success@k = Recall@k (one target per case, rank among all current symbols at the pin,
unranked = miss); MRR (unranked contributes 0). Denominator = cases in the group.
Rescue = B2 <= 10 and B1 > 10 or unranked. Fusion harm = B1 <= 10 and B4 > 10 or unranked.
"""
import csv
import glob
import json
import os
from collections import OrderedDict

D = os.path.dirname(os.path.abspath(__file__))
METHODS = ['b1', 'b2', 'b3', 'b4']


def read_csv(p):
    with open(p, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def rank(v):
    s = '' if v is None else str(v).strip()
    return None if s in ('', 'null', 'None') else int(float(s))


def worker_fields(run_dir):
    out = {}
    for p in glob.glob(os.path.join(run_dir, 'worker_output__*.json')):
        with open(p, encoding='utf-8') as f:
            for r in json.load(f)['perCaseResults']:
                out[r['case_id']] = r
    return out


def build_rows():
    rows = []
    # E1: Java Category B
    e1 = os.path.join(D, 'E1_java_reproduction')
    roles = {r['case_id']: r for r in read_csv(os.path.join(D, '..', 'research_corrected_2026-10-21', 'per_case_results_corrected.csv'))}
    wf = worker_fields(e1)
    for r in read_csv(os.path.join(e1, 'per_case_results.csv')):
        ref = roles[r['case_id']]
        w = wf.get(r['case_id'], {})
        rows.append({
            'experiment': 'E1_java_category_b', 'data_status': 'final-study candidate (not adjudicated)',
            'case_id': r['case_id'], 'language': 'java', 'repository': r['repository_id'],
            'evolution_type': 'rename', 'role': ref['evaluation_role'],
            'eligible': ref['eligible_for_historical_claims'] == 'True',
            'cluster': r['origin_commit'], 'stage_a_status': w.get('stage_a_status', ''),
            'window_position': w.get('history_window_position') or '',
            **{f'{m}_rank': rank(r[f'{m}_rank']) for m in METHODS}})
    # E2: Phase B four languages
    e2 = os.path.join(D, 'E2_phase_b_four_language')
    with open(os.path.join(D, 'phase_b_input', 'phase_b_case_study_input.json'), encoding='utf-8') as f:
        meta = {c['case_id']: c for c in json.load(f)}
    wf = worker_fields(e2)
    for r in read_csv(os.path.join(e2, 'per_case_results.csv')):
        m = meta[r['case_id']]
        w = wf.get(r['case_id'], {})
        pm = m['phase_b_metadata']
        rows.append({
            'experiment': 'E2_phase_b', 'data_status': 'development set (used to choose fusion; not held-out)',
            'case_id': r['case_id'], 'language': m['target_language'], 'repository': r['repository_id'],
            'evolution_type': pm['evolution_type'], 'role': 'phase_b_' + pm['verification_status'],
            'eligible': True, 'cluster': r['origin_commit'], 'stage_a_status': w.get('stage_a_status', ''),
            'window_position': w.get('history_window_position') or '',
            'is_valid_predecessor': pm['is_valid_predecessor'], 'predecessor_name': pm['predecessor_name'],
            **{f'{mm}_rank': rank(r[f'{mm}_rank']) for mm in METHODS}})
    for x in rows:
        h = {m: x[f'{m}_rank'] is not None and x[f'{m}_rank'] <= 10 for m in METHODS}
        x['in_window'] = x['window_position'] not in ('', None)
        x['rescue_b2'] = h['b2'] and not h['b1']
        x['fusion_rescue_b4'] = h['b4'] and not h['b1']
        x['fusion_harm_b4'] = h['b1'] and not h['b4']
    return rows


def metrics(sub):
    n = len(sub)
    res = OrderedDict(N=n, clusters=len({x['cluster'] or x['case_id'] for x in sub}))
    if not n:
        return res
    for m in METHODS:
        rs = [x[f'{m}_rank'] for x in sub]
        for k in (1, 5, 10):
            res[f'{m}_recall@{k}'] = round(sum(1 for v in rs if v is not None and v <= k) / n, 4)
        res[f'{m}_mrr'] = round(sum(1 / v for v in rs if v is not None) / n, 4)
        res[f'{m}_unranked'] = sum(1 for v in rs if v is None)
    res['b2_rescues'] = sum(x['rescue_b2'] for x in sub)
    res['b4_fusion_rescues'] = sum(x['fusion_rescue_b4'] for x in sub)
    res['b4_fusion_harms'] = sum(x['fusion_harm_b4'] for x in sub)
    res['in_window'] = sum(x['in_window'] for x in sub)
    res['case_ids'] = ';'.join(x['case_id'] for x in sub)
    return res


def main():
    rows = build_rows()
    groups = OrderedDict()
    java = [x for x in rows if x['experiment'] == 'E1_java_category_b']
    groups['E1 java | all 29 (reference only)'] = java
    groups['E1 java | eligible (rejected excluded)'] = [x for x in java if x['eligible']]
    groups['E1 java | primary_verified_rename_in_window'] = [x for x in java if x['role'] == 'primary_verified_rename_in_window']
    groups['E1 java | eligible, origin in window'] = [x for x in java if x['eligible'] and x['in_window']]
    groups['E1 java | eligible, origin outside window'] = [x for x in java if x['eligible'] and not x['in_window']]
    pb = [x for x in rows if x['experiment'] == 'E2_phase_b']
    for lang in ('java', 'python', 'javascript', 'typescript'):
        sub = [x for x in pb if x['language'] == lang]
        groups[f'E2 {lang} | all with target'] = sub
        groups[f'E2 {lang} | evidence commit in window'] = [x for x in sub if x['in_window']]
        groups[f'E2 {lang} | evidence commit outside window'] = [x for x in sub if not x['in_window']]
    agg = OrderedDict((k, metrics(v)) for k, v in groups.items())

    cols = ['experiment', 'data_status', 'case_id', 'language', 'repository', 'evolution_type', 'role', 'eligible',
            'cluster', 'stage_a_status', 'window_position', 'in_window', 'is_valid_predecessor', 'predecessor_name',
            'b1_rank', 'b2_rank', 'b3_rank', 'b4_rank', 'rescue_b2', 'fusion_rescue_b4', 'fusion_harm_b4']
    with open(os.path.join(D, 'per_case_results_all.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        for x in rows:
            w.writerow(x)
    acols = ['group'] + [k for k in next(iter(agg.values())).keys()]
    with open(os.path.join(D, 'aggregate_metrics.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=acols, extrasaction='ignore')
        w.writeheader()
        for k, v in agg.items():
            w.writerow({'group': k, **v})
    with open(os.path.join(D, 'aggregate_metrics.json'), 'w', encoding='utf-8') as f:
        json.dump(agg, f, indent=2)
    for k, v in agg.items():
        if v['N']:
            print(f"{k:55s} N={v['N']:2d} cl={v['clusters']:2d} win={v['in_window']:2d} "
                  + ' '.join(f"{m.upper()} R@10={v[f'{m}_recall@10']:.2f} MRR={v[f'{m}_mrr']:.3f}" for m in METHODS)
                  + f" | resc={v['b2_rescues']} fRes={v['b4_fusion_rescues']} harm={v['b4_fusion_harms']}")
    print('\nrescue cases (B2<=10, B1>10/unranked):')
    for x in rows:
        if x['rescue_b2']:
            print(' ', x['experiment'], x['case_id'], x['language'], x['evolution_type'], x['role'],
                  'window', x['window_position'], 'ranks', [x[f'{m}_rank'] for m in METHODS],
                  'pred', x.get('predecessor_name'), 'valid_pred', x.get('is_valid_predecessor'))


if __name__ == '__main__':
    main()
