"""Before/after comparison for the extraction fixes (factory-call symbols, overload collapse).

Read-only on inputs; writes before_after_e2.csv and before_after_e2.json into this folder.
Before = E2_phase_b_four_language (code before the fixes); after = E2_after_fix.
Same 34 cases, same pins, same configuration (B1-B4, H=50); only src/languages/{JavaScript,TypeScript}Adapter.js differ.
"""
import csv
import glob
import json
import os

D = os.path.dirname(os.path.abspath(__file__))
METHODS = ['b1', 'b2', 'b3', 'b4']


def load(run):
    with open(os.path.join(D, run, 'per_case_results.csv'), encoding='utf-8', newline='') as f:
        rows = {r['case_id']: r for r in csv.DictReader(f)}
    meta = {}
    for p in glob.glob(os.path.join(D, run, 'worker_output__*.json')):
        with open(p, encoding='utf-8') as f:
            o = json.load(f)
        meta[o['snapshotMetadata']['repository_id']] = o['snapshotMetadata']
    return rows, meta


def rank(v):
    v = (v or '').strip()
    return None if v in ('', 'null', 'None') else int(float(v))


def metrics(rows):
    n = len(rows)
    out = {'N': n}
    for m in METHODS:
        rs = [rank(r[f'{m}_rank']) for r in rows]
        for k in (1, 5, 10):
            out[f'{m}_recall@{k}'] = round(sum(1 for x in rs if x is not None and x <= k) / n, 4)
        out[f'{m}_mrr'] = round(sum(1 / x for x in rs if x is not None) / n, 4)
    h = lambda r, m: rank(r[f'{m}_rank']) is not None and rank(r[f'{m}_rank']) <= 10
    out['b2_rescues'] = sum(1 for r in rows if h(r, 'b2') and not h(r, 'b1'))
    out['b4_fusion_harms'] = sum(1 for r in rows if h(r, 'b1') and not h(r, 'b4'))
    return out


def main():
    with open(os.path.join(D, 'phase_b_input', 'phase_b_case_study_input.json'), encoding='utf-8') as f:
        lang = {c['case_id']: c['target_language'] for c in json.load(f)}
    before, mb = load('E2_phase_b_four_language')
    after, ma = load('E2_after_fix')
    assert set(before) == set(after), 'case sets differ'
    result = {'snapshots': {}, 'by_language': {}, 'changed_cases': []}
    for repo in sorted(mb):
        result['snapshots'][repo] = {
            'symbols_before': mb[repo]['symbol_count'], 'symbols_after': ma[repo]['symbol_count']}
    for lg in ('java', 'python', 'javascript', 'typescript'):
        ids = [c for c in before if lang[c] == lg]
        result['by_language'][lg] = {'before': metrics([before[c] for c in ids]), 'after': metrics([after[c] for c in ids])}
    rows = []
    for cid in sorted(before):
        b, a = before[cid], after[cid]
        row = {'case_id': cid, 'language': lang[cid]}
        for m in METHODS:
            row[f'{m}_before'] = rank(b[f'{m}_rank'])
            row[f'{m}_after'] = rank(a[f'{m}_rank'])
        row['stage_a_before'] = b['stage_a_status']
        row['stage_a_after'] = a['stage_a_status']
        row['changed'] = any(row[f'{m}_before'] != row[f'{m}_after'] for m in METHODS) or row['stage_a_before'] != row['stage_a_after']
        rows.append(row)
        if row['changed']:
            result['changed_cases'].append(row)
    with open(os.path.join(D, 'before_after_e2.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(D, 'before_after_e2.json'), 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)

    print('symbols per snapshot (before -> after):', {k: f"{v['symbols_before']}->{v['symbols_after']}" for k, v in result['snapshots'].items()})
    for lg, v in result['by_language'].items():
        b, a = v['before'], v['after']
        print(f"{lg:10s} N={b['N']:2d} " + ' | '.join(
            f"{m.upper()} R@10 {b[f'{m}_recall@10']:.2f}->{a[f'{m}_recall@10']:.2f} MRR {b[f'{m}_mrr']:.3f}->{a[f'{m}_mrr']:.3f}" for m in METHODS)
            + f" | rescues {b['b2_rescues']}->{a['b2_rescues']} harms {b['b4_fusion_harms']}->{a['b4_fusion_harms']}")
    print('\nchanged cases:')
    for r in result['changed_cases']:
        print(' ', r['case_id'], ' '.join(f"{m.upper()} {r[f'{m}_before']}->{r[f'{m}_after']}" for m in METHODS),
              '| stageA', r['stage_a_before'], '->', r['stage_a_after'])


if __name__ == '__main__':
    main()
