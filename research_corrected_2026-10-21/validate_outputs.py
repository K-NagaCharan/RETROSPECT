"""Independent, read-only validation of the corrected reporting outputs.

Recomputes every group metric from per_case_results_corrected.csv, compares it with
results_by_group.csv, results.json and the tables in corrected_experiment_report.md,
and re-hashes every input and output listed in provenance_manifest.json.
Writes nothing.  Usage:  python -I validate_outputs.py
"""
import csv
import hashlib
import json
import os
import re
import sys

D = os.path.dirname(os.path.abspath(__file__))
METHODS = ['b1', 'b2', 'b3', 'b4']
fails = []


def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()


rows = list(csv.DictReader(open(os.path.join(D, 'per_case_results_corrected.csv'), encoding='utf-8')))
groups = list(csv.DictReader(open(os.path.join(D, 'results_by_group.csv'), encoding='utf-8')))
results = json.load(open(os.path.join(D, 'results.json'), encoding='utf-8'))
manifest = json.load(open(os.path.join(D, 'provenance_manifest.json'), encoding='utf-8'))
report = open(os.path.join(D, 'corrected_experiment_report.md'), encoding='utf-8').read()

evaluated = [r for r in rows if r['evaluation_role'] != 'excluded_before_evaluation']
check(len(rows) == 46, f'per-case rows = 46 (got {len(rows)})')
check(len(evaluated) == 45, f'evaluated rows = 45 (got {len(evaluated)})')
check(len({r['case_id'] for r in rows}) == len(rows), 'case_id unique')

# Required fields per evaluated row
for r in evaluated:
    for f in ('pin_sha', 'evaluation_role', 'history_reachability_h50', 'outcome_k10', 'fusion_impact_b4_vs_b1',
              'historical_failure_mode', 'query_form'):
        if not r[f]:
            fails.append(f'{r["case_id"]} missing {f}')
    reach = r['history_reachability_h50']
    if reach in ('IN_TOPO50_WINDOW', 'NOT_IN_TOPO50_WINDOW', 'ORIGIN_IS_PIN'):
        if r['rev_list_distance'] == '':
            fails.append(f'{r["case_id"]} reachable-class row without rev_list_distance')
    if reach == 'IN_TOPO50_WINDOW' and not (r['topo_order_position'] and 1 <= int(r['topo_order_position']) <= 50):
        fails.append(f'{r["case_id"]} IN_TOPO50_WINDOW without position 1..50')
    if reach == 'NOT_IN_TOPO50_WINDOW' and r['topo_order_position'] != '':
        fails.append(f'{r["case_id"]} NOT_IN_TOPO50_WINDOW but has a position')
    if reach == 'ORIGIN_NOT_FOUND_IN_CLONE' and (r['rev_list_distance'] or r['topo_order_position']):
        fails.append(f'{r["case_id"]} distance inferred for a missing origin')
    if reach == 'NOT_IN_TOPO50_WINDOW' and r['b2_rank'] != '' and int(r['b2_rank']) <= 10:
        fails.append(f'{r["case_id"]} B2 top-10 although origin outside window (inspect)')
    if r['evaluation_role'] == 'rejected_ground_truth' and r['eligible_for_historical_claims'] != 'False':
        fails.append(f'{r["case_id"]} rejected case marked eligible')
check(not [f for f in fails if 'missing' in f or 'window' in f.lower() or 'inferred' in f or 'eligible' in f],
      'per-row field rules (required fields, reachability/distance consistency, eligibility)')

# No case is labelled a negative anywhere in the corrected outputs
check('negative' not in ' '.join(r['evaluation_role'] for r in rows).lower(), 'no evaluation_role labels a case as a negative')

# Role counts
counts = {}
for r in evaluated:
    counts[r['evaluation_role']] = counts.get(r['evaluation_role'], 0) + 1
check(counts == manifest['case_counts']['by_role'], f'role counts match manifest {counts}')
check(sum(counts.values()) == 45, 'role counts sum to 45')


# Recompute metrics per group from the per-case CSV
def metrics(ids):
    sub = [r for r in evaluated if r['case_id'] in ids]
    n = len(sub)
    out = {'N': n, 'clusters': len({r['cluster_id'] for r in sub})}
    for m in METHODS:
        rk = [int(r[m + '_rank']) for r in sub if r[m + '_rank'] != '']
        out[m + '_success_at_10_count'] = sum(1 for x in rk if x <= 10)
        out[m + '_success_at_10_pct'] = round(100 * out[m + '_success_at_10_count'] / n, 1) if n else None
        out[m + '_mrr'] = round(sum(1 / x for x in rk) / n, 4) if n else None
    out['fusion_rescues'] = sum(1 for r in sub if r['fusion_impact_b4_vs_b1'] == 'FUSION_RESCUE')
    out['fusion_harms'] = sum(1 for r in sub if r['fusion_impact_b4_vs_b1'] == 'FUSION_HARM')
    return out


json_groups = {g['group']: g for g in results['groups']}
bad = []
for g in groups:
    ids = set(g['case_ids'].split(';')) if g['case_ids'] else set()
    rc = metrics(ids)
    if int(g['N']) != rc['N'] or int(g['clusters']) != rc['clusters']:
        bad.append((g['group'], 'N/clusters'))
    if rc['N'] == 0:
        continue
    for m in METHODS:
        if abs(float(g[m + '_success_at_10_pct']) - rc[m + '_success_at_10_pct']) > 1e-9:
            bad.append((g['group'], m, 's10'))
        if abs(float(g[m + '_mrr']) - rc[m + '_mrr']) > 1e-9:
            bad.append((g['group'], m, 'mrr'))
        jg = json_groups[g['group']]
        if jg[m + '_mrr'] != rc[m + '_mrr'] or jg[m + '_success_at_10_pct'] != rc[m + '_success_at_10_pct']:
            bad.append((g['group'], m, 'json'))
    if int(g['fusion_rescues']) != rc['fusion_rescues'] or int(g['fusion_harms']) != rc['fusion_harms']:
        bad.append((g['group'], 'rescue/harm'))
check(not bad, f'results_by_group.csv and results.json equal metrics recomputed from per-case CSV ({len(groups)} groups) {bad}')

# Outcome labels recomputed from ranks
ob = []
for r in evaluated:
    h = {m: r[m + '_rank'] != '' and int(r[m + '_rank']) <= 10 for m in METHODS}
    o = ('A_HISTORICAL_ADVANTAGE' if h['b2'] and not h['b1'] else 'B_SHARED_SUCCESS' if h['b2'] and h['b1']
         else 'C_STRUCTURAL_ONLY' if h['b1'] else 'D_NEITHER')
    if o != r['outcome_k10']:
        ob.append(r['case_id'])
check(not ob, f'outcome_k10 consistent with ranks {ob}')

# Report tables equal machine-readable values
row_re = re.compile(r'^\| `([a-zA-Z0-9_]+)`(?: \(INELIGIBLE\))? \| (\d+) \| (\d+) \| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\| (\d+) / (\d+) \|$')
seen = 0
rb = []
for line in report.splitlines():
    m = row_re.match(line.strip())
    if not m:
        continue
    seen += 1
    name = m.group(1)
    jg = json_groups[name]
    vals = [x.strip() for x in m.groups()[3:11]]
    exp = [str(jg[k + '_success_at_10_pct']) for k in METHODS] + [f"{jg[k + '_mrr']:.4f}" for k in METHODS]
    if int(m.group(2)) != jg['N'] or int(m.group(3)) != jg['clusters'] or vals != exp or \
            int(m.group(12)) != jg['fusion_rescues'] or int(m.group(13)) != jg['fusion_harms']:
        rb.append(name)
check(seen >= 17 and not rb, f'report metric tables match results.json ({seen} table rows checked) {rb}')

# Method labels present
check(all(k in results['methods'] for k in METHODS) and 'RRF-v2' in results['methods']['b4']
      and '0.60' in results['methods']['b3'], 'method labels: B3 = linear 0.60/0.40, B4 = RRF-v2')

# Hashes
for name, h in manifest['outputs'].items():
    check(sha(os.path.join(D, name)) == h, f'output hash matches manifest: {name}')
changed = [k for k, v in manifest['inputs'].items() if sha(v['path']) != v['sha256']]
check(not changed, f'all {len(manifest["inputs"])} inputs unchanged since build {changed}')

print('\nRESULT:', 'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILURE(S)')
sys.exit(1 if fails else 0)
