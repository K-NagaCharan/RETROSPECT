"""Pre-registered analysis of benchmark runs (reports/evaluation_protocol.md). Written before any result existed.

Usage: python -I analyze_benchmark.py --runs <run_dir> [<run_dir> ...] --out <new dir>
Joins case_results.jsonl rows with retrieval_cases/<split>/cases.jsonl (split membership, labels, difficulty).
"""
import argparse
import itertools
import json
import os
import random
import statistics
from collections import Counter, defaultdict

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SEED = 20261021
LANGS = ('java', 'python', 'javascript', 'typescript')


def rr(r):
    return 1.0 / r if r else 0.0


def in10(r):
    return r is not None and r <= 10


def metrics(ranks):
    n = len(ranks)
    if not n:
        return {'n': 0}
    srt = sorted(r if r else float('inf') for r in ranks)
    med = srt[n // 2] if n % 2 else (srt[n // 2 - 1] + srt[n // 2]) / 2
    return {'n': n, 'R@1': round(sum(1 for r in ranks if r == 1) / n, 4), 'R@5': round(sum(1 for r in ranks if r and r <= 5) / n, 4),
            'R@10': round(sum(1 for r in ranks if in10(r)) / n, 4), 'MRR': round(sum(rr(r) for r in ranks) / n, 4),
            'median_rank': med if med != float('inf') else 'not_retrieved', 'not_retrieved': round(sum(1 for r in ranks if not r) / n, 4)}


def transitions(base, comp):
    t = Counter()
    for b, c in zip(base, comp):
        if not in10(b) and in10(c):
            t['rescue@10'] += 1
        elif in10(b) and not in10(c):
            t['harm@10'] += 1
        elif b and c and c < b:
            t['improved'] += 1
        elif b and c and c > b:
            t['regressed'] += 1
        else:
            t['unchanged'] += 1
    return dict(t)


def cluster_deltas(rows, comp):
    by = defaultdict(list)
    for r in rows:
        by[r['cluster_id']].append(rr(r[comp]) - rr(r['b1']))
    return [statistics.mean(v) for v in by.values()]


def sign_flip(d):
    m = len(d)
    if m == 0:
        return None
    obs = abs(statistics.mean(d))
    if m <= 20:
        cnt = tot = 0
        for signs in itertools.product((1, -1), repeat=m):
            tot += 1
            cnt += abs(sum(s * x for s, x in zip(signs, d)) / m) >= obs - 1e-12
        return {'method': 'exact', 'p': cnt / tot}
    rng = random.Random(SEED)
    n = 100000
    cnt = sum(abs(sum(x if rng.random() < .5 else -x for x in d) / m) >= obs - 1e-12 for _ in range(n))
    return {'method': 'monte_carlo_100000', 'p': (cnt + 1) / (n + 1)}


def bootstrap_ci(d):
    if len(d) < 2:
        return None
    rng = random.Random(SEED)
    bs = sorted(statistics.mean(rng.choices(d, k=len(d))) for _ in range(10000))
    return [round(bs[249], 4), round(bs[9749], 4)]


def holm(ps):
    items = sorted((p, k) for k, p in ps.items() if p is not None)
    out, run = {}, 0.0
    for i, (p, k) in enumerate(items):
        run = max(run, min(1.0, p * (len(items) - i)))
        out[k] = run
    return out


def compare(rows, comp):
    d = cluster_deltas(rows, comp)
    t = transitions([r['b1'] for r in rows], [r[comp] for r in rows])
    sf = sign_flip(d)
    return {'cases': len(rows), 'clusters': len(d), 'delta_mrr_cluster_mean': round(statistics.mean(d), 4) if d else None,
            'delta_mrr_case_mean': round(statistics.mean(rr(r[comp]) - rr(r['b1']) for r in rows), 4) if rows else None,
            'p_two_sided': sf and sf['p'], 'test': sf and sf['method'], 'ci95_bootstrap': bootstrap_ci(d), 'transitions': t}


def load(runs):
    split = {}
    meta = {}
    for s in ('development', 'validation', 'held_out_test'):
        p = os.path.join(W, 'retrieval_cases', s, 'cases.jsonl')
        for line in open(p, encoding='utf-8'):
            c = json.loads(line)
            split[c['case_id']] = s
            meta[c['case_id']] = c
    rows, skipped = [], []
    for rd in runs:
        for line in open(os.path.join(rd, 'case_results.jsonl'), encoding='utf-8'):
            r = json.loads(line)
            if r.get('skipped'):
                skipped.append(r)
                continue
            r['split'] = split[r['case_id']]
            r['name_subtoken_overlap'] = meta[r['case_id']].get('name_subtoken_overlap')
            rows.append(r)
    ids = [r['case_id'] for r in rows]
    assert len(ids) == len(set(ids)), 'case evaluated twice across runs'
    return rows, skipped


def flat(r, H):
    h = r['horizons'][str(H)]
    return {'case_id': r['case_id'], 'cluster_id': r['cluster_id'], 'language': r['language'], 'repository': r['repository'], 'task': r['task'],
            'split': r['split'], 'lineage_label': r['lineage_label'], 'target_indexed': r['target_indexed'], 'b1': r['b1_rank'],
            'b2': h['b2_rank'], 'b3': h['b3_rank'], 'b4': h['b4_rank'], 'reach': h['reach_status'], 'diffed': h['origin_diff_analyzed'],
            'false_claim': h.get('b2_false_lineage_claim_top10'), 'overlap': r['name_subtoken_overlap'],
            'parser_ok': (r.get('parser_healthy_after_history') or {}).get(str(H))}


def block(rows):
    return {'metrics': {k: metrics([r[k] for r in rows]) for k in ('b1', 'b2', 'b3', 'b4')},
            'b4_vs_b1': compare(rows, 'b4'), 'b2_vs_b1': compare(rows, 'b2'), 'b3_vs_b1': compare(rows, 'b3')}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', nargs='+', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    if os.path.exists(a.out):
        raise SystemExit(f'refusing to overwrite {a.out}')
    raw, skipped = load(a.runs)
    res = {'protocol': 'reports/evaluation_protocol.md', 'runs': a.runs, 'skipped_cases': len(skipped), 'primary': {}, 'secondary': {}}

    # Primary: held-out, B_identifier, target indexed, in-window and diffed at H=400; B4 vs B1 per language, Holm over 4.
    p400 = [flat(r, 400) for r in raw]
    prim = {}
    for L in LANGS:
        rows = [r for r in p400 if r['language'] == L and r['split'] == 'held_out_test' and r['task'] == 'B_identifier'
                and r['target_indexed'] and r['reach'] == 'IN_WINDOW' and r['diffed']]
        prim[L] = {'population': len(rows), **block(rows)}
    adj = holm({L: prim[L]['b4_vs_b1']['p_two_sided'] for L in LANGS})
    for L in LANGS:
        c = prim[L]['b4_vs_b1']
        c['p_holm'] = adj.get(L)
        tr = c['transitions']
        if c['clusters'] < 6:
            dec = 'NOT_TESTABLE (<6 clusters)'
        elif c['delta_mrr_cluster_mean'] <= 0 or tr.get('harm@10', 0) > tr.get('rescue@10', 0):
            dec = 'NOT_SUPPORTED'
        elif c['p_holm'] < 0.05:
            dec = 'SUPPORTED'
        else:
            dec = 'INCONCLUSIVE'
        c['decision'] = dec
    res['primary'] = prim

    # Sensitivity (deviation, added after the parser-abort finding and before any result was read): the primary
    # population restricted to snapshots whose parser stayed healthy through the H=400 history pass.
    sens = {}
    for L in LANGS:
        rows = [r for r in p400 if r['language'] == L and r['split'] == 'held_out_test' and r['task'] == 'B_identifier'
                and r['target_indexed'] and r['reach'] == 'IN_WINDOW' and r['diffed'] and r['parser_ok'] is True]
        sens[L] = {'population': len(rows), 'b4_vs_b1': compare(rows, 'b4')}
    res['sensitivity_parser_healthy_only'] = sens

    # Secondary / descriptive
    sec = {}
    for H in (50, 400):
        fl = [flat(r, H) for r in raw]
        for s in ('held_out_test', 'validation', 'development'):
            for L in LANGS + ('pooled',):
                for task in ('B_identifier', 'C_docstring', 'A_current_doc'):
                    rows = [r for r in fl if r['split'] == s and r['task'] == task and (L == 'pooled' or r['language'] == L) and r['target_indexed']]
                    if rows:
                        sec[f'H{H}/{s}/{L}/{task}/all_indexed'] = block(rows)
                    rin = [r for r in rows if r['reach'] == 'IN_WINDOW' and r['diffed']]
                    if rin:
                        sec[f'H{H}/{s}/{L}/{task}/in_window'] = block(rin)
                negs = [r for r in fl if r['split'] == s and r['task'] == 'D_negative' and (L == 'pooled' or r['language'] == L)]
                if negs:
                    sec[f'H{H}/{s}/{L}/D_negative'] = {'cases': len(negs), 'clusters': len({r['cluster_id'] for r in negs}),
                                                       'false_lineage_claim_rate_top10': round(sum(1 for r in negs if r['false_claim']) / len(negs), 4)}
    res['secondary'] = sec

    # Diagnostics and breakdowns (H=400, B_identifier, all splits)
    b = [r for r in p400 if r['task'] == 'B_identifier']
    diag = {'parser_aborted_during_H400_history_by_language': {L: sorted({r['repository'] for r in p400 if r['language'] == L and r['parser_ok'] is False}) for L in LANGS},
            'not_indexed_by_language': dict(Counter(r['language'] for r in b if not r['target_indexed'])),
            'reach_by_language': {L: dict(Counter(r['reach'] for r in b if r['language'] == L)) for L in LANGS},
            'by_repository_heldout_inwindow': {}, 'by_label_heldout_inwindow': {}, 'by_overlap_heldout_inwindow': {}, 'by_b1_success_heldout_inwindow': {}}
    hb = [r for r in b if r['split'] == 'held_out_test' and r['target_indexed'] and r['reach'] == 'IN_WINDOW' and r['diffed']]
    for key, f in (('by_repository_heldout_inwindow', lambda r: r['repository']), ('by_label_heldout_inwindow', lambda r: r['lineage_label']),
                   ('by_overlap_heldout_inwindow', lambda r: 'zero_subtoken_overlap' if not r['overlap'] else 'some_overlap'),
                   ('by_b1_success_heldout_inwindow', lambda r: 'b1_top10' if in10(r['b1']) else 'b1_miss')):
        g = defaultdict(list)
        for r in hb:
            g[f(r)].append(r)
        diag[key] = {k: {'cases': len(v), 'clusters': len({x['cluster_id'] for x in v}),
                         **{c: metrics([x[c] for x in v])['MRR'] for c in ('b1', 'b2', 'b3', 'b4')}} for k, v in sorted(g.items())}
    res['diagnostics'] = diag

    os.makedirs(a.out)
    with open(os.path.join(a.out, 'analysis_results.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, indent=2)
    with open(os.path.join(a.out, 'per_case_H400.jsonl'), 'w', encoding='utf-8') as f:
        for r in p400:
            f.write(json.dumps(r) + '\n')
    print(json.dumps({L: {'population': prim[L]['population'], 'clusters': prim[L]['b4_vs_b1']['clusters'],
                          'MRR_b1': prim[L]['metrics']['b1'].get('MRR'), 'MRR_b4': prim[L]['metrics']['b4'].get('MRR'),
                          'dMRR': prim[L]['b4_vs_b1']['delta_mrr_cluster_mean'], 'p': prim[L]['b4_vs_b1']['p_two_sided'],
                          'p_holm': prim[L]['b4_vs_b1']['p_holm'], 'tr': prim[L]['b4_vs_b1']['transitions'],
                          'decision': prim[L]['b4_vs_b1']['decision']} for L in LANGS}, indent=1))


if __name__ == '__main__':
    main()
