"""Read-only comparison of a case-study run against the reference ranks.

Compares B1-B4 ranks in <run>/per_case_results.csv (written by scratch/run_java_case_study.js)
with research_corrected_2026-10-21/per_case_results_corrected.csv for the 29 Category B cases.
E1 passes only if all 29 x 4 = 116 ranks are identical. Writes nothing.

Usage:
  python -I compare_with_reference.py --run <run dir> [--reference <csv>] [--dataset <json>] [--allow-partial]

--allow-partial  For dry runs on a subset of snapshots: compares only the cases present in the
                 run and never reports E1 as passed.
"""
import argparse
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REFERENCE = os.path.join(HERE, '..', 'research_corrected_2026-10-21', 'per_case_results_corrected.csv')
DEFAULT_DATASET = ('D:/base papers considered/Test creation/results/'
                   'category_b_benchmark_repair_2026-10-19/category_b_repaired.json')
METHODS = ['b1', 'b2', 'b3', 'b4']
EXPECTED_CASES = 29


def norm_rank(v):
    if v is None:
        return None
    s = str(v).strip()
    if s in ('', 'null', 'None', 'NaN'):
        return None
    return int(float(s))


def load_csv(path):
    with open(path, encoding='utf-8', newline='') as f:
        return {r['case_id']: r for r in csv.DictReader(f)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True)
    ap.add_argument('--reference', default=DEFAULT_REFERENCE)
    ap.add_argument('--dataset', default=DEFAULT_DATASET)
    ap.add_argument('--allow-partial', action='store_true')
    a = ap.parse_args()

    with open(a.dataset, encoding='utf-8') as f:
        catb_ids = [r['case_id'] for r in json.load(f)]
    ref = load_csv(os.path.abspath(a.reference))
    run = load_csv(os.path.join(os.path.abspath(a.run), 'per_case_results.csv'))

    missing_ref = [c for c in catb_ids if c not in ref]
    if missing_ref:
        sys.exit(f'Reference lacks Category B cases: {missing_ref}')
    extra = sorted(set(run) - set(catb_ids))
    expected = catb_ids if not a.allow_partial else [c for c in catb_ids if c in run]
    missing_run = [c for c in expected if c not in run]

    mismatches = []
    compared = 0
    for cid in expected:
        if cid not in run:
            continue
        for m in METHODS:
            compared += 1
            rv, fv = norm_rank(run[cid][m + '_rank']), norm_rank(ref[cid][m + '_rank'])
            if rv != fv:
                mismatches.append((cid, m, fv, rv))

    print(f'reference: {os.path.abspath(a.reference)}')
    print(f'run:       {os.path.abspath(a.run)}')
    print(f'cases compared: {len(expected) - len(missing_run)} / {EXPECTED_CASES}; ranks compared: {compared}')
    if extra:
        print(f'cases in run but not in Category B (ignored): {extra}')
    if missing_run:
        print(f'MISSING from run: {missing_run}')
    for cid, m, fv, rv in mismatches:
        print(f'MISMATCH {cid} {m.upper()}: reference={fv} run={rv}')

    identical = not mismatches and not missing_run
    if a.allow_partial:
        print(f'PARTIAL RESULT: {"identical" if identical else "DIFFERENT"} on {compared} ranks. '
              'This is not an E1 pass (E1 requires all 116 ranks).')
    else:
        full = identical and compared == EXPECTED_CASES * len(METHODS)
        print('E1 REPRODUCTION: ' + ('PASS (116/116 ranks identical)' if full else 'FAIL'))
        identical = full
    sys.exit(0 if identical else 1)


if __name__ == '__main__':
    main()
