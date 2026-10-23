"""Build corrected reporting artifacts for the Oct 20 Retrospect 45-case census.

Reads existing experiment outputs and audit files (read-only), runs read-only git
queries against D:/clones, and writes ONLY into the directory containing this
script. It does not run retrieval, does not modify any input, and does not check
out anything in the clones.

Usage:  python -I build_corrected_reporting.py
"""
import csv
import hashlib
import itertools
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = 'D:/base papers considered'
TC = BASE + '/Test creation'
RAW_DIR = TC + '/experiments/final_multirepo_evaluation_merge_aware_2026-10-20'
AUDIT_DIR = TC + '/experiments/final_multirepo_evaluation_audit_2026-10-20'
CLONES = 'D:/clones'

INPUTS = {
    'audit_per_case': AUDIT_DIR + '/corrected_per_case_results.csv',
    'audit_reconciliation': AUDIT_DIR + '/case_reconciliation.csv',
    'audit_aggregates': AUDIT_DIR + '/corrected_results.csv',
    'audit_statistics': AUDIT_DIR + '/corrected_statistical_analysis.csv',
    'audit_config': AUDIT_DIR + '/corrected_experiment_config.json',
    'raw_per_case': RAW_DIR + '/per_case_results.csv',
    'raw_config': RAW_DIR + '/experiment_config.json',
    'raw_results_json': RAW_DIR + '/results.json',
    'catb_audit': TC + '/audits/category_b_java_audit_2026-10-19/case_audit_results.csv',
    'quarantine_manifest': TC + '/datasets/exploratory_java_v1_reconciled/quarantine_manifest.json',
    'catb_dataset': TC + '/results/category_b_benchmark_repair_2026-10-19/category_b_repaired.json',
    'research_per_case_superseded': BASE + '/Retrospect/research/per_case_empirical_results.csv',
    'research_aggregate_superseded': BASE + '/Retrospect/research/aggregate_empirical_metrics.csv',
    'research_generator_superseded': BASE + '/Retrospect/scratch/generate_research_deliverables.js',
}

REPO_DIRS = {
    'checkstyle/checkstyle': 'checkstyle', 'graphhopper/graphhopper': 'graphhopper',
    'undertow-io/undertow': 'undertow', 'datastax/java-driver': 'datastax-java-driver',
    'google/guava': 'guava', 'psf/requests': 'requests', 'colinhacks/zod': 'zod',
    'encode/httpx': 'httpx', 'pytest-dev/pytest': 'pytest',
    'marshmallow-code/marshmallow': 'marshmallow', 'moment/moment': 'moment',
    'mochajs/mocha': 'mocha', 'vuejs/core': 'vue', 'ReactiveX/rxjs': 'rxjs',
    'lodash/lodash': 'lodash',
}

H = 50  # search horizon used by the run (experiment_config.json: search_horizon)
METHODS = ['b1', 'b2', 'b3', 'b4']
METHOD_LABELS = {
    'b1': 'B1 Structural only (StructuralRetriever)',
    'b2': 'B2 Historical only (HistoricalRetrievalAdapter, merge-aware --topo-order, H=50)',
    'b3': 'B3 Linear fusion 0.60*S + 0.40*H (HistoricalRetrievalAdapter.fuseScores)',
    'b4': 'B4 RRF-v2 k=60, wS=0.50, wH=0.50, zero-signal gating (fuseRRFv2)',
}
TEMPLATE_PREFIX = 'Locate current implementation corresponding to historical method'

# Evaluation roles. Order defines report order.
ROLES = [
    ('primary_verified_rename_in_window', True,
     'Category B case with audit_status=verified in the Oct 19 Category B audit (automated, not human-adjudicated).'),
    ('needs_review_reachable', True,
     'Category B audit_status=needs_review and origin commit within the first 50 commits of git log --topo-order <pin>.'),
    ('needs_review_unreachable', True,
     'Category B audit_status=needs_review and origin commit is an ancestor of the pin but NOT within the first 50 topo-ordered commits.'),
    ('rejected_ground_truth', False,
     'Category B audit_status=rejected (quarantine_manifest.json). The audit directs exclusion from all evaluation runs. Ranks are reported for transparency only; not negatives, not positives.'),
    ('current_code_control', True,
     'Structural pilot case with no origin commit (no refactoring event). Measures fusion effect on current-code queries only.'),
    ('anchor_origin_is_pin', True,
     'Historical pilot case whose recorded origin commit equals the pin (k=0); there is no prior history to traverse.'),
    ('cross_language_origin_verified', True,
     'Cross-language pilot case whose origin commit exists in the clone and is an ancestor of the pin.'),
    ('cross_language_origin_missing', False,
     'Cross-language pilot case whose recorded origin commit does not exist in the full clone. Provenance invalid: not usable as historical-retrieval evidence. Not inferred to be outside the horizon.'),
]
ROLE_ELIGIBLE = {r: e for r, e, _ in ROLES}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def read_csv(path):
    with open(path, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


def git(repo_dir, *args):
    r = subprocess.run(['git', '-C', f'{CLONES}/{repo_dir}', *args], capture_output=True, text=True)
    return r.returncode, r.stdout.strip()


def commit_exists(repo_dir, sha):
    return git(repo_dir, 'cat-file', '-e', f'{sha}^{{commit}}')[0] == 0


_topo_cache = {}


def topo_window(repo_dir, pin):
    key = (repo_dir, pin)
    if key not in _topo_cache:
        _, out = git(repo_dir, 'log', '--format=%H', '--topo-order', '-n', str(H), pin)
        _topo_cache[key] = out.split()
    return _topo_cache[key]


def rank(v):
    return None if v in (None, '', 'null', 'None') else int(float(v))


def out_path(name):
    p = os.path.abspath(os.path.join(OUT_DIR, name))
    if os.path.dirname(p) != OUT_DIR:
        raise RuntimeError('refusing to write outside output directory: ' + p)
    return p


def fmt(v):
    return '' if v is None else v


def main():
    for k, p in INPUTS.items():
        if not os.path.exists(p):
            sys.exit(f'missing input {k}: {p}')

    audit_rows = read_csv(INPUTS['audit_per_case'])
    recon = {r['case_id']: r for r in read_csv(INPUTS['audit_reconciliation'])}
    raw = {r['case_id']: r for r in read_csv(INPUTS['raw_per_case'])}
    catb = {r['case_id']: r for r in read_csv(INPUTS['catb_audit'])}
    quarantine = {q['case_id']: q for q in json.load(open(INPUTS['quarantine_manifest'], encoding='utf-8'))}
    raw_cfg = json.load(open(INPUTS['raw_config'], encoding='utf-8'))
    if raw_cfg.get('search_horizon') != H:
        sys.exit('search_horizon in experiment_config.json is not 50; refusing to label reachability')

    checks = []

    # --- Check: ranks in audit CSV equal ranks in the raw run CSV ---
    raw_cols = {'b1': 'b1_rank', 'b2': 'b2_rank', 'b3': 'b3_linear_rank', 'b4': 'b4_rrf_rank'}
    mism = []
    for r in audit_rows:
        rr = raw.get(r['case_id'])
        if rr is None:
            mism.append((r['case_id'], 'missing in raw'))
            continue
        for m in METHODS:
            if rank(r[m + '_rank']) != rank(rr[raw_cols[m]]):
                mism.append((r['case_id'], m))
    checks.append({'check': 'audit per-case ranks == raw run per-case ranks (all 4 methods)',
                   'cases': len(audit_rows), 'mismatches': mism, 'pass': not mism})

    # --- Per-case corrected rows ---
    cases = []
    for r in audit_rows:
        cid = r['case_id']
        repo_dir = REPO_DIRS[r['repository_id']]
        pin = r['pin_sha']
        origin = r['origin_commit'] if r['origin_commit'] not in ('', 'null') else None
        pin_ok = commit_exists(repo_dir, pin)
        origin_ok = commit_exists(repo_dir, origin) if origin else None
        ancestor = rev_dist = topo_pos = None
        if pin_ok and origin_ok:
            ancestor = git(repo_dir, 'merge-base', '--is-ancestor', origin, pin)[0] == 0
            rev_dist = int(git(repo_dir, 'rev-list', '--count', f'{origin}..{pin}')[1])
            win = topo_window(repo_dir, pin)
            full = git(repo_dir, 'rev-parse', origin)[1]
            topo_pos = win.index(full) + 1 if full in win else None

        if not pin_ok:
            reach = 'PIN_NOT_FOUND'
        elif origin is None:
            reach = 'NO_ORIGIN_RECORDED'
        elif not origin_ok:
            reach = 'ORIGIN_NOT_FOUND_IN_CLONE'
        elif not ancestor:
            reach = 'ORIGIN_NOT_ANCESTOR_OF_PIN'
        elif rev_dist == 0:
            reach = 'ORIGIN_IS_PIN'
        elif topo_pos is not None:
            reach = 'IN_TOPO50_WINDOW'
        else:
            reach = 'NOT_IN_TOPO50_WINDOW'

        status = catb.get(cid, {}).get('audit_status')
        if cid in catb:
            if status == 'verified':
                role = 'primary_verified_rename_in_window'
            elif status == 'rejected':
                role = 'rejected_ground_truth'
            elif reach == 'IN_TOPO50_WINDOW':
                role = 'needs_review_reachable'
            else:
                role = 'needs_review_unreachable'
        elif r['cohort'] == 'verified_structural_pilot':
            role = 'current_code_control'
        elif r['cohort'] == 'verified_historical_pilot':
            role = 'anchor_origin_is_pin'
        elif r['cohort'] == 'cross_language_exploratory':
            role = 'cross_language_origin_verified' if (origin_ok and ancestor) else 'cross_language_origin_missing'
        else:
            raise RuntimeError('unclassified case ' + cid)

        ranks = {m: rank(r[m + '_rank']) for m in METHODS}
        hit = {m: ranks[m] is not None and ranks[m] <= 10 for m in METHODS}
        outcome = ('A_HISTORICAL_ADVANTAGE' if hit['b2'] and not hit['b1'] else
                   'B_SHARED_SUCCESS' if hit['b2'] and hit['b1'] else
                   'C_STRUCTURAL_ONLY' if hit['b1'] else 'D_NEITHER')
        fusion = ('FUSION_RESCUE' if hit['b4'] and not hit['b1'] else
                  'FUSION_HARM' if hit['b1'] and not hit['b4'] else 'NEUTRAL')

        # Historical-channel failure mode (only when B2 misses top-10). Precedence documented in README.
        if role == 'rejected_ground_truth':
            fmode = 'NOT_INTERPRETABLE_REJECTED_GROUND_TRUTH'
        elif hit['b2']:
            fmode = 'NONE_B2_TOP10'
        elif reach == 'ORIGIN_NOT_FOUND_IN_CLONE':
            fmode = 'NOT_INTERPRETABLE_ORIGIN_MISSING'
        elif reach == 'NO_ORIGIN_RECORDED':
            fmode = 'NOT_APPLICABLE_NO_REFACTORING'
        elif reach == 'ORIGIN_IS_PIN':
            fmode = 'NO_PRIOR_HISTORY_K0'
        elif reach == 'NOT_IN_TOPO50_WINDOW':
            fmode = 'ORIGIN_OUTSIDE_TOPO50_WINDOW'
        elif r['stage_b_match_type'] == 'AMBIGUOUS':
            fmode = 'IN_WINDOW_AMBIGUOUS_MATCH'
        elif r['stage_b_match_type'] == 'UNMATCHED':
            fmode = 'IN_WINDOW_UNMATCHED'
        elif ranks['b2'] is not None:
            fmode = 'IN_WINDOW_RANKED_BELOW_10'
        else:
            fmode = 'IN_WINDOW_NO_B2_SCORE'

        q = r['query_text']
        qform = ('templated_with_historical_identifier' if q.startswith(TEMPLATE_PREFIX) else
                 'identifier_only' if ' ' not in q.strip() else 'natural_language')

        # Cross-check the audit's own reconciled reachability where it is defined
        rec = recon.get(cid, {})
        cases.append({
            'case_id': cid,
            'repository_id': r['repository_id'],
            'language': r['language'],
            'original_cohort_label': r['cohort'],
            'evaluation_role': role,
            'eligible_for_historical_claims': ROLE_ELIGIBLE[role],
            'catb_audit_status': status or '',
            'rejection_reasons': ';'.join(quarantine.get(cid, {}).get('exclusion_reasons', [])),
            'pin_sha': pin,
            'origin_commit': origin or '',
            'cluster_id': origin or cid,
            'pin_exists_in_clone': pin_ok,
            'origin_exists_in_clone': '' if origin_ok is None else origin_ok,
            'origin_is_ancestor_of_pin': '' if ancestor is None else ancestor,
            'rev_list_distance': fmt(rev_dist),
            'topo_order_position': fmt(topo_pos),
            'history_reachability_h50': reach,
            'audit_stage_a_status_reconciled': rec.get('stage_a_status_reconciled', r['stage_a_status_reconciled']),
            'audit_rev_list_distance': rec.get('rev_list_distance', ''),
            'audit_topo_log_position': rec.get('topo_log_position', ''),
            'original_run_stage_a_status': raw[cid]['stage_a_status'],
            'stage_b_match_type': r['stage_b_match_type'],
            'query_form': qform,
            'query_text': q,
            'target_symbol_name': r['target_symbol_name'],
            'target_file_path': r['target_file_path'],
            **{f'{m}_rank': fmt(ranks[m]) for m in METHODS},
            **{f'{m}_score': r[m + '_score'] for m in METHODS},
            'outcome_k10': outcome,
            'fusion_impact_b4_vs_b1': fusion,
            'historical_failure_mode': fmode,
            'value_provenance': 'ranks/scores copied from audit corrected_per_case_results.csv (identical to raw run); '
                                'reachability fields newly measured with read-only git; outcomes recomputed',
        })

    # Excluded-before-evaluation rows (in reconciliation, not in per-case results)
    evaluated_ids = {c['case_id'] for c in cases}
    excluded = []
    for cid, rec in recon.items():
        if cid in evaluated_ids:
            continue
        repo_dir = REPO_DIRS.get(rec['repository_id'])
        pin_ok = commit_exists(repo_dir, rec['pin_sha']) if repo_dir else None
        excluded.append({
            'case_id': cid, 'repository_id': rec['repository_id'], 'original_cohort_label': rec['cohort'],
            'evaluation_role': 'excluded_before_evaluation', 'eligible_for_historical_claims': False,
            'pin_sha': rec['pin_sha'], 'pin_exists_in_clone': pin_ok,
            'history_reachability_h50': 'PIN_NOT_FOUND' if pin_ok is False else '',
            'value_provenance': 'exclusion copied from audit case_reconciliation.csv: ' + rec['exclusion_reason'],
        })

    # --- Check: newly measured reachability vs audit reconciliation ---
    reach_mism = []
    for c in cases:
        a_topo = c['audit_topo_log_position']
        a_dist = c['audit_rev_list_distance']
        if a_dist not in ('', 'null') and str(c['rev_list_distance']) != a_dist:
            reach_mism.append((c['case_id'], 'rev_list', a_dist, c['rev_list_distance']))
        if a_topo not in ('', 'null') and str(c['topo_order_position']) != a_topo:
            reach_mism.append((c['case_id'], 'topo', a_topo, c['topo_order_position']))
    checks.append({'check': 'measured rev-list distance and topo position == audit case_reconciliation.csv values (where audit defines them)',
                   'mismatches': reach_mism, 'pass': not reach_mism})

    # --- Aggregation ---
    def metrics(sub):
        n = len(sub)
        res = {'N': n, 'clusters': len({c['cluster_id'] for c in sub})}
        if n == 0:
            return res
        for m in METHODS:
            rs = [c[m + '_rank'] for c in sub]
            for k in (1, 5, 10):
                res[f'{m}_success_at_{k}_count'] = sum(1 for x in rs if x != '' and x <= k)
                res[f'{m}_success_at_{k}_pct'] = round(100 * res[f'{m}_success_at_{k}_count'] / n, 1)
            res[f'{m}_mrr'] = round(sum(1 / x for x in rs if x != '') / n, 4)
        for o in ('A_HISTORICAL_ADVANTAGE', 'B_SHARED_SUCCESS', 'C_STRUCTURAL_ONLY', 'D_NEITHER'):
            res['outcome_' + o] = sum(1 for c in sub if c['outcome_k10'] == o)
        res['fusion_rescues'] = sum(1 for c in sub if c['fusion_impact_b4_vs_b1'] == 'FUSION_RESCUE')
        res['fusion_harms'] = sum(1 for c in sub if c['fusion_impact_b4_vs_b1'] == 'FUSION_HARM')
        res['case_ids'] = [c['case_id'] for c in sub]
        return res

    groups = []
    for role, elig, desc in ROLES:
        sub = [c for c in cases if c['evaluation_role'] == role]
        groups.append({'grouping': 'evaluation_role', 'group': role, 'eligible_for_historical_claims': elig,
                       'definition': desc, **metrics(sub)})
    orig_labels = ['in_policy_primary', 'verified_structural_pilot', 'quarantined_negative',
                   'distance_stratified_diagnostic', 'cross_language_exploratory', 'verified_historical_pilot']
    for lab in orig_labels:
        sub = [c for c in cases if c['original_cohort_label'] == lab]
        groups.append({'grouping': 'original_cohort_label_reference', 'group': lab,
                       'eligible_for_historical_claims': None,
                       'definition': 'Original hard-coded cohort from scratch/run_full_multirepo_evaluation.js; reported only to reconcile with prior outputs.',
                       **metrics(sub)})
    for lab, pred in [('all_45_evaluated_reference_only', lambda c: True),
                      ('reachability_IN_TOPO50_WINDOW', lambda c: c['history_reachability_h50'] == 'IN_TOPO50_WINDOW'),
                      ('reachability_NOT_IN_TOPO50_WINDOW', lambda c: c['history_reachability_h50'] == 'NOT_IN_TOPO50_WINDOW'),
                      ('reachability_IN_TOPO50_WINDOW_excl_rejected', lambda c: c['history_reachability_h50'] == 'IN_TOPO50_WINDOW' and c['evaluation_role'] != 'rejected_ground_truth'),
                      ('reachability_NOT_IN_TOPO50_WINDOW_excl_rejected', lambda c: c['history_reachability_h50'] == 'NOT_IN_TOPO50_WINDOW' and c['evaluation_role'] != 'rejected_ground_truth')]:
        sub = [c for c in cases if pred(c)]
        groups.append({'grouping': 'reference', 'group': lab, 'eligible_for_historical_claims': None,
                       'definition': 'Reference grouping; mixes roles. Not a headline result.', **metrics(sub)})

    # --- Check: recomputed original-cohort metrics vs audit corrected_results.csv ---
    name_map = {'Primary In-Policy Refactorings': 'in_policy_primary',
                'Category C: Current-Code Controls': 'verified_structural_pilot',
                'Category D: Quarantined Negatives': 'quarantined_negative',
                'Distance-Stratified Diagnostic': 'distance_stratified_diagnostic',
                'Cross-Language Exploratory Pilots': 'cross_language_exploratory',
                'Historical Pilot Anchors': 'verified_historical_pilot',
                'Composite Heterogeneous Pool (Reference Only)': '__all__'}
    by_orig = {g['group']: g for g in groups if g['grouping'] == 'original_cohort_label_reference'}
    by_orig['__all__'] = next(g for g in groups if g['group'] == 'all_45_evaluated_reference_only')
    agg_diffs = []
    for a in read_csv(INPUTS['audit_aggregates']):
        g = by_orig[name_map[a['cohort_or_stratum']]]
        if int(a['case_count']) != g['N']:
            agg_diffs.append((a['cohort_or_stratum'], 'N', a['case_count'], g['N']))
        for m in METHODS:
            d_s = abs(float(a[f'{m}_s10_pct']) - 100 * g[f'{m}_success_at_10_count'] / g['N'])
            d_m = abs(float(a[f'{m}_mrr']) - sum(1 / c[m + '_rank'] for c in cases if c['case_id'] in g['case_ids'] and c[m + '_rank'] != '') / g['N'])
            if d_s > 0.01 or d_m > 0.00011:
                agg_diffs.append((a['cohort_or_stratum'], m, round(d_s, 4), round(d_m, 5)))
    checks.append({'check': 'recomputed original-cohort S@10 and MRR == audit corrected_results.csv (tolerance 0.01 pct-pt, 0.00011 MRR)',
                   'differences': agg_diffs, 'pass': not agg_diffs})

    # --- Exact sign-flip permutation test, primary role, B4 - B1 (one case per origin commit) ---
    prim = [c for c in cases if c['evaluation_role'] == 'primary_verified_rename_in_window']
    stats = {}
    if len({c['cluster_id'] for c in prim}) == len(prim):
        def rr(x):
            return 0.0 if x == '' else 1.0 / x

        def h10(x):
            return 1.0 if x != '' and x <= 10 else 0.0
        for name, f in (('MRR', rr), ('Success@10', h10)):
            d = [f(c['b4_rank']) - f(c['b1_rank']) for c in prim]
            obs = sum(d) / len(d)
            ext = 0
            for signs in itertools.product((1, -1), repeat=len(d)):
                if abs(sum(s * x for s, x in zip(signs, d)) / len(d)) >= abs(obs) - 1e-12:
                    ext += 1
            total = 2 ** len(d)
            stats[name] = {'M': len(d), 'per_case_deltas': [round(x, 4) for x in d],
                           'observed_mean_delta': round(obs, 4),
                           'p_two_sided_exact': round(ext / total, 4),
                           'p_two_sided_plus_one': round((ext + 1) / (total + 1), 4),
                           'min_attainable_p_plus_one': round(2 / (total + 1), 4)}
    audit_stats = [s for s in read_csv(INPUTS['audit_statistics']) if s['cohort'] == 'Primary In-Policy Refactorings']
    for s in audit_stats:
        if s['metric'] in stats:
            stats[s['metric']]['audit_reported_p'] = float(s['exact_perm_p_value'])
            stats[s['metric']]['audit_reported_delta'] = float(s['observed_delta'])

    # --- Superseded research CSV: record the defects measurably ---
    old = read_csv(INPUTS['research_per_case_superseded'])
    superseded = {
        'rows': len(old),
        'empty_commit_distance': sum(1 for x in old if x['commit_distance'] == ''),
        'empty_stage_a_reachability': sum(1 for x in old if x['stage_a_reachability'] == ''),
        'empty_contains_historical_identifier': sum(1 for x in old if x['contains_historical_identifier'] == ''),
        'failure_mode_LOOKBACK_HORIZON_EXCEEDED': sum(1 for x in old if x['failure_mode'] == 'LOOKBACK_HORIZON_EXCEEDED'),
        'rank_mismatches_vs_corrected': [x['case_id'] for x in old for m in METHODS
                                         if rank(x[m + '_rank']) != next(c[m + '_rank'] or None for c in cases if c['case_id'] == x['case_id'])],
    }

    # --- Write per-case CSV ---
    cols = list(cases[0].keys())
    with open(out_path('per_case_results_corrected.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        for c in cases:
            w.writerow(c)
        for e in excluded:
            w.writerow({k: e.get(k, '') for k in cols})

    # --- Write group results CSV ---
    gcols = ['grouping', 'group', 'eligible_for_historical_claims', 'N', 'clusters']
    for m in METHODS:
        gcols += [f'{m}_success_at_1_pct', f'{m}_success_at_5_pct', f'{m}_success_at_10_pct',
                  f'{m}_success_at_10_count', f'{m}_mrr']
    gcols += ['outcome_A_HISTORICAL_ADVANTAGE', 'outcome_B_SHARED_SUCCESS', 'outcome_C_STRUCTURAL_ONLY',
              'outcome_D_NEITHER', 'fusion_rescues', 'fusion_harms', 'case_ids']
    with open(out_path('results_by_group.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=gcols, extrasaction='ignore')
        w.writeheader()
        for g in groups:
            row = dict(g)
            row['case_ids'] = ';'.join(g.get('case_ids', []))
            w.writerow(row)

    generated = datetime.now(timezone.utc).isoformat(timespec='seconds')
    results = {
        'generated_utc': generated,
        'value_status': 'RECOMPUTED from measured per-case ranks of the 2026-10-20 run; no retrieval was rerun',
        'methods': METHOD_LABELS,
        'search_horizon': H,
        'metric_definitions': {
            'success_at_k': 'fraction of cases in the group whose target symbol rank <= k; unranked counts as miss; denominator = N of group',
            'mrr': 'mean over the group of 1/rank; unranked contributes 0; denominator = N of group',
            'outcome_k10': 'A: B2<=10 and B1>10/unranked; B: both <=10; C: B1<=10 and B2>10/unranked; D: neither',
            'fusion_impact_b4_vs_b1': 'RESCUE: B4<=10 and B1 not; HARM: B1<=10 and B4 not; else NEUTRAL',
            'clusters': 'distinct origin commits (case id used when no origin)',
        },
        'groups': groups,
        'primary_role_exact_sign_flip_test_b4_minus_b1': stats,
        'excluded_before_evaluation': excluded,
        'validation_checks': checks,
        'superseded_research_csv_defects_measured': superseded,
    }
    with open(out_path('results.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, default=str)

    # --- Provenance manifest ---
    _, gitv = subprocess.run(['git', '--version'], capture_output=True, text=True).returncode, \
        subprocess.run(['git', '--version'], capture_output=True, text=True).stdout.strip()
    manifest = {
        'generated_utc': generated,
        'builder': {'path': os.path.abspath(__file__), 'sha256': sha256(os.path.abspath(__file__)),
                    'python': sys.version.split()[0], 'git': gitv},
        'inputs': {k: {'path': p, 'sha256': sha256(p), 'bytes': os.path.getsize(p)} for k, p in INPUTS.items()},
        'experiment_configuration': {
            'source': INPUTS['raw_config'],
            'search_horizon': raw_cfg.get('search_horizon'),
            'git_traversal_flags': raw_cfg.get('environment', {}).get('git_traversal_flags'),
            'retrieval_configurations': raw_cfg.get('retrieval_configurations'),
            'source_fingerprints_note': 'Source-file SHA-256 fingerprints for the run are recorded in ' + AUDIT_DIR + '/reproducibility_manifest.txt; the run is not reproducible from any git commit.',
        },
        'read_only_git_commands_per_case': [
            'git -C D:/clones/<repo> cat-file -e <sha>^{commit}',
            'git -C D:/clones/<repo> merge-base --is-ancestor <origin> <pin>',
            'git -C D:/clones/<repo> rev-list --count <origin>..<pin>',
            'git -C D:/clones/<repo> log --format=%H --topo-order -n 50 <pin>',
            'git -C D:/clones/<repo> rev-parse <origin>',
        ],
        'case_counts': {
            'in_reconciliation': len(recon),
            'evaluated_in_run': len(cases),
            'excluded_before_evaluation': len(excluded),
            'by_role': {r: sum(1 for c in cases if c['evaluation_role'] == r) for r, _, _ in ROLES},
            'eligible_for_historical_claims': sum(1 for c in cases if c['eligible_for_historical_claims']),
            'ineligible_for_historical_claims': sum(1 for c in cases if not c['eligible_for_historical_claims']),
        },
        'role_definitions': {r: d for r, _, d in ROLES},
        'outputs': {},
    }
    write_report(results, cases, excluded)
    for name in ('per_case_results_corrected.csv', 'results_by_group.csv', 'results.json', 'corrected_experiment_report.md'):
        manifest['outputs'][name] = sha256(out_path(name))
    with open(out_path('provenance_manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print('cases', len(cases), 'excluded', len(excluded))
    for c in checks:
        print('CHECK', 'PASS' if c['pass'] else 'FAIL', '-', c['check'])


def write_report(results, cases, excluded):
    g = {x['group']: x for x in results['groups']}
    st = results['primary_role_exact_sign_flip_test_b4_minus_b1']

    def row(name, suffix=''):
        x = g[name]
        if x['N'] == 0:
            return f"| `{name}`{suffix} | 0 | 0 | — | — | — | — | — | — | — | — | — |"
        return (f"| `{name}`{suffix} | {x['N']} | {x['clusters']} | "
                + ' | '.join(f"{x[m + '_success_at_10_pct']}" for m in METHODS) + ' | '
                + ' | '.join(f"{x[m + '_mrr']:.4f}" for m in METHODS)
                + f" | {x['fusion_rescues']} / {x['fusion_harms']} |")

    hdr = ('| Group | N | Clusters | B1 S@10 % | B2 S@10 % | B3 S@10 % | B4 S@10 % | B1 MRR | B2 MRR | B3 MRR | B4 MRR | Rescue / Harm |\n'
           '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|')
    rescue = [c for c in cases if c['outcome_k10'] == 'A_HISTORICAL_ADVANTAGE']
    lines = []
    a = lines.append
    a('# Corrected Experiment Report — Retrospect 45-case census (run of 2026-10-20)')
    a('')
    a(f"Generated {results['generated_utc']} by `build_corrected_reporting.py`. "
      'All numbers are **recomputed** from the measured per-case ranks of the 2026-10-20 run. '
      '**No retrieval was rerun.** Reachability fields were **newly measured** with read-only git commands. '
      'This report corrects reporting defects; it does not establish that the experiment is scientifically valid.')
    a('')
    a('## Configuration (copied from the run\'s `experiment_config.json`)')
    a('')
    for m in METHODS:
        a(f'- **{m.upper()}**: {results["methods"][m]}')
    a(f'- Search horizon H = {results["search_horizon"]} commits of `git log --topo-order -n 50 <pin>`; merge commits\' composite diffs skipped.')
    a('- Target = the current successor symbol; rank among all indexed symbols at the pin; unranked = miss / reciprocal rank 0.')
    a('')
    a('## Results by evaluation role (headline grouping)')
    a('')
    a('Roles are assigned by documented criteria (see README). Roles marked ineligible are shown for transparency only.')
    a('')
    a(hdr)
    for r, elig, _ in ROLES:
        a(row(r, '' if elig else ' (INELIGIBLE)'))
    a('')
    a('## Historical rescue (outcome A: B2 ≤ 10 and B1 > 10 or unranked)')
    a('')
    a('| Case | Role | Repo | Reachability | rev-list k / topo pos | B1 | B2 | B3 | B4 | Stage B |')
    a('|---|---|---|---|---|---:|---:|---:|---:|---|')
    for c in rescue:
        a(f"| {c['case_id']} | {c['evaluation_role']} | {c['repository_id']} | {c['history_reachability_h50']} | "
          f"{c['rev_list_distance']} / {c['topo_order_position']} | {c['b1_rank'] or '—'} | {c['b2_rank'] or '—'} | "
          f"{c['b3_rank'] or '—'} | {c['b4_rank'] or '—'} | {c['stage_b_match_type']} |")
    a('')
    langs = sorted({c['language'] for c in rescue})
    reach = sorted({c['history_reachability_h50'] for c in rescue})
    a(f"{len(rescue)} cases; languages: {', '.join(langs)}; reachability: {', '.join(reach)}; "
      f"distinct origin commits: {len({c['cluster_id'] for c in rescue})}; "
      f"in the primary role: {sum(1 for c in rescue if c['evaluation_role'] == 'primary_verified_rename_in_window')}. "
      'All are Category B rename cases; none is human-adjudicated.')
    a('')
    a('## Primary role: B4 vs B1, exact sign-flip permutation test (recomputed)')
    a('')
    a('| Metric | M | Observed mean Δ (B4−B1) | p exact | p (count+1)/(2^M+1) | Audit-reported p | Min attainable p |')
    a('|---|---:|---:|---:|---:|---:|---:|')
    for k, v in st.items():
        a(f"| {k} | {v['M']} | {v['observed_mean_delta']} | {v['p_two_sided_exact']} | {v['p_two_sided_plus_one']} | "
          f"{v.get('audit_reported_p', '—')} | {v['min_attainable_p_plus_one']} |")
    a('')
    a('No result in this report is statistically significant. With M = 5 clusters, significance at α = 0.05 is unattainable.')
    a('')
    a('## Reachability (reference grouping, rejected cases excluded)')
    a('')
    a(hdr)
    for name in ('reachability_IN_TOPO50_WINDOW_excl_rejected', 'reachability_NOT_IN_TOPO50_WINDOW_excl_rejected'):
        a(row(name))
    a('')
    a('Historical success outside the window is 0 by construction (the origin commit is never read). '
      'This is a reachability cut-off, not a measured decay curve.')
    a('')
    a('## Reconciliation with prior outputs')
    a('')
    a('Original cohort labels, recomputed (should equal the audit\'s `corrected_results.csv`; see validation checks):')
    a('')
    a(hdr)
    for lab in ('in_policy_primary', 'verified_structural_pilot', 'quarantined_negative',
                'distance_stratified_diagnostic', 'cross_language_exploratory', 'verified_historical_pilot',
                'all_45_evaluated_reference_only'):
        a(row(lab))
    a('')
    a('Validation checks performed by the builder:')
    a('')
    for c in results['validation_checks']:
        a(f"- {'PASS' if c['pass'] else 'FAIL'}: {c['check']}")
    a('')
    a('## Excluded before evaluation')
    a('')
    for e in excluded:
        a(f"- {e['case_id']} ({e['repository_id']}): {e['value_provenance']}")
    a('')
    a('## Claims this report does NOT support')
    a('')
    a('- General superiority of fusion or history over structural retrieval (pooled B4 < B1; harms exceed rescues).')
    a('- Safe abstention on negatives: there is no valid negative set; the former "Category D" cases are rejected ground truth.')
    a('- Cross-language historical rescue: 8 of 11 cross-language cases cite origin commits absent from the clones; the 3 verified ones lie outside the window.')
    a('- Any statistical significance.')
    a('- Recovery of predecessor implementations: only current successors are ranked.')
    a('')
    with open(out_path('corrected_experiment_report.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


if __name__ == '__main__':
    main()
