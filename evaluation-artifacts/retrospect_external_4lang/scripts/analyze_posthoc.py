"""Sensitivity (protocol §7) and post-hoc descriptive rows, computed after the confirmatory result. Run with python -I.

Reuses analyze_external.py (load, compare, block) and the statistics of analyze_benchmark.py (seed 20261023).
Does not modify the frozen case set, the confirmatory results.json, or protocol §4/§5.
Usage: python -I analyze_posthoc.py --run runs/external_v1 --owner owner_review/review_sheet_owner.csv --out analysis/<new dir>
"""
import argparse
import csv
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze_external as X  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True)
    ap.add_argument('--owner', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    if os.path.exists(a.out):
        raise SystemExit(f'refusing to overwrite {a.out}')
    rows, _, _ = X.load(a.run)
    owner = list(csv.DictReader(open(a.owner, encoding='utf-8-sig')))
    vk = next(k for k in owner[0] if k.startswith('verdict'))
    verdict = {r['repository']: r[vk].strip().lower() for r in owner}
    rejected = sorted(k for k, v in verdict.items() if v == 'reject')
    s3_repos = {r['repository'] for r in rows if r['source'] in ('S3', 'S3b')}
    assert s3_repos == set(verdict), 'owner sheet does not cover exactly the S3/S3b repositories'
    assert all(v in ('confirm', 'reject') for v in verdict.values()), 'unexpected verdict value'
    keep = lambda r: r['source'] in ('S1', 'S2') or verdict.get(r['repository']) == 'confirm'
    bid = [r for r in rows if r['task'] == 'B_id']
    bnl = [r for r in rows if r['task'] == 'B_nl']

    # Sensitivity (protocol §7): the confirmatory statistic on S1 + S2 + owner-confirmed S3/S3b.
    sb = [r for r in bid if keep(r)]
    c = X.compare(sb, 'g')
    t = c['transitions']
    sens = {'label': 'Sensitivity (protocol §7): B_id, G vs B1, S1 + S2 + owner-confirmed S3/S3b', 'owner_verdicts': {'confirm': sum(v == 'confirm' for v in verdict.values()),
            'reject': len(rejected), 'rejected_repositories': rejected}, **c, 'metrics': {s: X.A.metrics([r[s] for r in sb]) for s in ('b1', 'g')},
            'rescues@10': t.get('rescue@10', 0), 'harms@10': t.get('harm@10', 0)}

    # Post-hoc descriptive: B_nl without template 2.
    nl13 = [r for r in bnl if r['template'] in (1, 3)]
    posthoc_nl = {'label': 'post hoc: template 2 excluded because B1 returns no candidates above its 0.08 threshold',
                  'task': 'B_nl (templates 1 and 3; per-repository mean)', **X.block(nl13)}

    # Post-hoc descriptive: S1 only (RefactoringMiner oracle, Java).
    s1 = {'label': 'post hoc: S1 only (RefactoringMiner oracle, Java)',
          'B_id': X.compare([r for r in bid if r['source'] == 'S1'], 'g'), 'B_nl': X.compare([r for r in bnl if r['source'] == 'S1'], 'g')}

    out = {'computed_after_confirmatory_result': True, 'run': a.run, 'owner_sheet': a.owner, 'seed': X.A.SEED,
           'sensitivity_owner_confirmed': sens, 'posthoc_bnl_without_template2': posthoc_nl, 'posthoc_s1_only': s1}
    os.makedirs(a.out)
    with open(os.path.join(a.out, 'results_posthoc.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
    p = posthoc_nl['g_vs_b1']
    print(json.dumps({'sensitivity': {k: sens[k] for k in ('repositories', 'mrr_b1', 'mrr_g', 'delta', 'ci95_repository_bootstrap', 'p_two_sided', 'rescues@10', 'harms@10')},
                      'bnl_without_template2_G_vs_B1': {k: p[k] for k in ('repositories', 'mrr_b1', 'mrr_g', 'delta', 'ci95_repository_bootstrap', 'p_two_sided', 'transitions')}}, indent=1))


if __name__ == '__main__':
    main()
