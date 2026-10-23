"""Compare B1-B4 ranks of a run against a reference (reproduction gates).

Usage:
  python -I compare_ranks.py --ref <reference per_case CSV> --run <per_case_results.csv | case_results.jsonl> [--horizon 50] [--cases id1,id2]
The reference and a worker run are CSVs with case_id,b1_rank..b4_rank; a harness run is case_results.jsonl
(b1_rank, horizons[H].b2_rank..b4_rank). Empty rank = not ranked. Prints a PASS/FAIL line and every difference.
"""
import argparse
import csv
import json
import sys


def load(path, horizon):
    if path.endswith('.jsonl'):
        out = {}
        for line in open(path, encoding='utf-8'):
            r = json.loads(line)
            h = r['horizons'][str(horizon)]
            out[r['case_id']] = {'b1': r['b1_rank'], 'b2': h['b2_rank'], 'b3': h['b3_rank'], 'b4': h['b4_rank']}
        return out
    rows = {}
    for r in csv.DictReader(open(path, encoding='utf-8')):
        rows[r['case_id']] = {k: (int(float(r[f'{k}_rank'])) if r[f'{k}_rank'] not in ('', 'None', 'null') else None) for k in ('b1', 'b2', 'b3', 'b4')}
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', required=True)
    ap.add_argument('--run', required=True)
    ap.add_argument('--horizon', type=int, default=50)
    ap.add_argument('--cases')
    a = ap.parse_args()
    ref, run = load(a.ref, a.horizon), load(a.run, a.horizon)
    ids = a.cases.split(',') if a.cases else sorted(run)  # every case in the run must exist in the reference
    missing = [i for i in ids if i not in run or i not in ref]
    diffs, total = [], 0
    for i in ids:
        if i in missing:
            continue
        for k in ('b1', 'b2', 'b3', 'b4'):
            total += 1
            if ref[i][k] != run[i][k]:
                diffs.append((i, k, ref[i][k], run[i][k]))
    same = total - len(diffs)
    ok = not diffs and not missing
    print(f"{'PASS' if ok else 'FAIL'}: {same}/{total} ranks identical; cases compared {len(ids) - len(missing)}/{len(ids)}; missing {missing}")
    for d in diffs:
        print('  diff', *d)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
