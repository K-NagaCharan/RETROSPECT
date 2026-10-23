"""Build reports/parserfix_remeasurement.md (Deviation 2) from v3 vs v4_parserfix analyses and E3-Reach original vs fixed.

Materiality rule (from the request): "changed materially" if any MRR shifts by >= 0.02, or any decision or
rescue/harm count changes; otherwise "unchanged".
Usage: python -I parserfix_report.py   (refuses to overwrite the report)
"""
import csv
import glob
import json
import os

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R = 'D:/base papers considered/Retrospect/research_execution_2026-10-21'
LANGS = ('java', 'python', 'javascript', 'typescript')
OUT = os.path.join(W, 'reports', 'parserfix_remeasurement.md')
lines, material = [], []


def J(p):
    return json.load(open(p, encoding='utf-8'))


def f(x, nd=3):
    return '—' if x is None else (f'{x:.{nd}f}' if isinstance(x, float) else str(x))


def tr(t):
    return f"{t.get('rescue@10', 0)} / {t.get('harm@10', 0)}"


def judge(item, mrr_pairs, other_pairs):
    changed = any(a is not None and b is not None and abs(a - b) >= 0.02 for a, b in mrr_pairs) or any(a != b for a, b in other_pairs)
    s = f"{item}: {'changed materially' if changed else 'unchanged'}"
    material.append(s)
    return s


def gates():
    g3 = J(os.path.join(W, 'evaluation', 'gates_parserfix', 'g3_guava.json'))
    return [('G1', 'E1 reproduces 116/116 reference ranks', 'PASS (116/116 ranks, 29/29 cases)'),
            ('G2', 'Harness equivalence reproduces 136/136 E2 ranks', 'PASS (136/136 ranks, 34/34 cases)'),
            ('G3', 'guava 317 KB stress + full guava H=400 pass, healthy probe, extractionFailures=0',
             f"{'PASS' if g3['pass'] else 'FAIL'} (stress {6000 if g3['stress']['failed_at'] is None else g3['stress']['failed_at']}/6000; "
             f"index {g3['index']['symbols']} symbols, failures {g3['index']['extractionFailures']['count']}; "
             f"H=400 {g3['history_H400']['commitsAnalyzed']} commits, {g3['history_H400']['symbolsWithHistory']} symbols with history, "
             f"failures {g3['history_H400']['extractionFailures']['count']}; probe healthy {g3['history_H400']['probe_after']})")]


def snapshots():
    rows = []
    for v4 in sorted(glob.glob(os.path.join(W, 'evaluation', 'runs', '*_v3_v4_parserfix'))):
        name = os.path.basename(v4)[:-len('_v4_parserfix')]
        m3 = {s['repository']: s for s in J(os.path.join(W, 'evaluation', 'runs', name, 'run_manifest.json'))['snapshots']}
        for s in J(os.path.join(v4, 'run_manifest.json'))['snapshots']:
            o = m3[s['repository']]
            rows.append((name, s['repository'], o['symbols'], s['symbols'], o.get('parser_healthy_after_history_H400'), s.get('parser_healthy_after_history_H400'),
                         s.get('history_symbols_with_history_H50'), s.get('history_symbols_with_history_H400'),
                         (s.get('structural_extraction_failures') or {}).get('count'),
                         (s.get('history_extraction_failures_H50') or {}).get('count'), (s.get('history_extraction_failures_H400') or {}).get('count'),
                         s.get('clean_before') and s.get('clean_after') and s['head_before'] == s['head_after']))
    return rows


def main():
    if os.path.exists(OUT):
        raise SystemExit(f'refusing to overwrite {OUT}')
    a3 = {k: J(os.path.join(W, 'evaluation', 'analysis', d, 'analysis_results.json')) for k, d in (('BCA', 'BCA_v3'), ('D', 'D_v3'))}
    a4 = {k: J(os.path.join(W, 'evaluation', 'analysis', 'v4_parserfix', k, 'analysis_results.json')) for k in ('BCA', 'D')}
    L = lines.append
    L('# Parser-fix re-measurement (Deviation 2)')
    L('')
    L('**Re-measurement with corrected software; no parameters changed.** See `reports/deviations_log.md` (Deviation 2) for the code, commits and procedure.')
    L('')
    L('**Versions compared:**')
    L('- **v3:** `evaluation/analysis/BCA_v3`, `D_v3`.')
    L('- **v4:** `evaluation/analysis/v4_parserfix/{BCA,D}`, which is v3 with the aborted snapshots replaced by their re-runs.')
    L('')
    L('## Gates')
    L('')
    L('| Gate | Check | Result |')
    L('|---|---|---|')
    for g in gates():
        L(f'| {g[0]} | {g[1]} | {g[2]} |')
    L('')
    L('## Re-run snapshots')
    L('')
    L('**History-profile size** is the number of current symbols with at least one history record. v3 did not record it; it was added to the harness by this fix. **Failures** are counted as structural / history H=50 / history H=400.')
    L('')
    L('| v3 run | Repository | Symbols v3 → v4 | Parser healthy after H400, v3 → v4 | Profile size v4 (H50 / H400) | Failures v4 | Clean at pin before and after |')
    L('|---|---|---|---|---|---|---|')
    for r in snapshots():
        L(f'| {r[0]} | {r[1]} | {r[2]} → {r[3]} | {r[4]} → {r[5]} | {r[6]} / {r[7]} | {r[8]} / {r[9]} / {r[10]} | {r[11]} |')
    L('')
    L('## Primary analysis (pre-registered; held-out, B_identifier, target indexed, in window and diffed at H = 400; B4 vs B1)')
    L('')
    L('| Language | Version | Cases | Clusters | MRR B1 | MRR B4 | ΔMRR | p (exact) | p (Holm) | Rescues / harms | Decision |')
    L('|---|---|---|---|---|---|---|---|---|---|---|')
    for lang in LANGS:
        rows = []
        for v, a in (('v3', a3['BCA']), ('v4', a4['BCA'])):
            p = a['primary'][lang]
            c = p['b4_vs_b1']
            rows.append((p['metrics']['b1'].get('MRR'), p['metrics']['b4'].get('MRR'), c['delta_mrr_cluster_mean'], c['decision'], c['transitions']))
            L(f"| {lang} | {v} | {p['population']} | {c['clusters']} | {f(p['metrics']['b1'].get('MRR'))} | {f(p['metrics']['b4'].get('MRR'))} | "
              f"{f(c['delta_mrr_cluster_mean'])} | {f(c['p_two_sided'], 4)} | {f(c.get('p_holm'), 4)} | {tr(c['transitions'])} | {c['decision']} |")
        x, y = rows
        L(f"| {lang} | sensitivity (parser-healthy only) v3 → v4 | {a3['BCA']['sensitivity_parser_healthy_only'][lang]['population']} → {a4['BCA']['sensitivity_parser_healthy_only'][lang]['population']} | | | | "
          f"{f(a3['BCA']['sensitivity_parser_healthy_only'][lang]['b4_vs_b1']['delta_mrr_cluster_mean'])} → {f(a4['BCA']['sensitivity_parser_healthy_only'][lang]['b4_vs_b1']['delta_mrr_cluster_mean'])} | "
          f"{f(a3['BCA']['sensitivity_parser_healthy_only'][lang]['b4_vs_b1']['p_two_sided'], 4)} → {f(a4['BCA']['sensitivity_parser_healthy_only'][lang]['b4_vs_b1']['p_two_sided'], 4)} | | | |")
        judge(f'Primary {lang}', [(x[0], y[0]), (x[1], y[1]), (x[2], y[2])],
              [(x[3], y[3]), (x[4].get('rescue@10', 0), y[4].get('rescue@10', 0)), (x[4].get('harm@10', 0), y[4].get('harm@10', 0))])
    L('')
    L('## Pooled held-out Task B (descriptive)')
    L('')
    L('| Stratum | Version | Cases / clusters | MRR B1 | B2 | B3 | B4 | B4 − B1 (cluster) | p | Rescues / harms |')
    L('|---|---|---|---|---|---|---|---|---|---|')
    for key, label in (('H400/held_out_test/pooled/B_identifier/in_window', 'in window, H = 400'),
                       ('H400/held_out_test/pooled/B_identifier/all_indexed', 'all indexed, H = 400'),
                       ('H50/held_out_test/pooled/B_identifier/all_indexed', 'all indexed, H = 50')):
        vals = []
        for v, a in (('v3', a3['BCA']), ('v4', a4['BCA'])):
            s = a['secondary'][key]
            m, c = s['metrics'], s['b4_vs_b1']
            vals.append(([m[k]['MRR'] for k in ('b1', 'b2', 'b3', 'b4')] + [c['delta_mrr_cluster_mean']], c['transitions']))
            L(f"| {label} | {v} | {m['b1']['n']} / {c['clusters']} | {m['b1']['MRR']:.3f} | {m['b2']['MRR']:.3f} | {m['b3']['MRR']:.3f} | {m['b4']['MRR']:.3f} | "
              f"{c['delta_mrr_cluster_mean']:+.3f} | {c['p_two_sided']:.3g} | {tr(c['transitions'])} |")
        judge(f'Pooled held-out Task B, {label}', list(zip(vals[0][0], vals[1][0])),
              [(vals[0][1].get('rescue@10', 0), vals[1][1].get('rescue@10', 0)), (vals[0][1].get('harm@10', 0), vals[1][1].get('harm@10', 0))])
    L('')
    L('## Task D false-lineage-claim rate (B2 top-10 lists the deleted name)')
    L('')
    L('| Split / language | H | Cases / clusters | v3 | v4 |')
    L('|---|---|---|---|---|')
    dchanges = []
    for key in sorted(k for k in a3['D']['secondary'] if 'D_negative' in k):
        x, y = a3['D']['secondary'][key], a4['D']['secondary'][key]
        H, split, lang = key.split('/')[:3]
        L(f"| {split} / {lang} | {H[1:]} | {y['cases']} / {y['clusters']} | {x['false_lineage_claim_rate_top10']:.4f} | {y['false_lineage_claim_rate_top10']:.4f} |")
        dchanges.append((x['false_lineage_claim_rate_top10'], y['false_lineage_claim_rate_top10']))
    judge('Task D false-claim rates', dchanges, [])
    L('')
    L('## E3-Reach (Java, H = 400, 18 primary cases), original vs fixed code')
    L('')
    e0 = J(os.path.join(R, 'E3_reach_analysis', 'e3_reach_results.json'))
    e1 = J(os.path.join(R, 'E3_reach_parserfix_analysis', 'e3_reach_results.json'))
    pc0 = {r['case_id']: r for r in csv.DictReader(open(os.path.join(R, 'E3_reach_analysis', 'e3_reach_per_case.csv'), encoding='utf-8'))}
    pc1 = {r['case_id']: r for r in csv.DictReader(open(os.path.join(R, 'E3_reach_parserfix_analysis', 'e3_reach_per_case.csv'), encoding='utf-8'))}
    prim = J(os.path.join(R, 'e3_reach_case_sets.json'))['sets']['primary']['case_ids']
    L('| Case | B1 original → fixed | B2 original → fixed | B3 original → fixed | B4 original → fixed |')
    L('|---|---|---|---|---|')
    nchg = 0
    for cid in prim:
        a, b = pc0[cid], pc1[cid]
        cells = []
        for m in ('b1_H400', 'b2_H400', 'b3_H400', 'b4_H400'):
            x, y = a[m] or '—', b[m] or '—'
            cells.append(f'{x}' if x == y else f'**{x} → {y}**')
            nchg += x != y
        L(f"| {cid} | {' | '.join(cells)} |")
    p0, p1 = e0['sets']['primary'], e1['sets']['primary']
    L('')
    L(f'Rank changes: {nchg} of {len(prim) * 4} (case, configuration) cells.')
    L('')
    L('| Headline | Original | Fixed |')
    L('|---|---|---|')
    L(f"| Valid | {e0['valid']} | {e1['valid']} |")
    L(f"| MRR B1 | {p0['b1_mrr']:.4f} | {p1['b1_mrr']:.4f} |")
    L(f"| MRR B4 | {p0['b4_mrr']:.4f} | {p1['b4_mrr']:.4f} |")
    L(f"| ΔMRR B4 − B1 (cluster mean) | {p0['test_b4_minus_b1_mrr']['observed_mean_delta']:+.4f} | {p1['test_b4_minus_b1_mrr']['observed_mean_delta']:+.4f} |")
    L(f"| Exact two-sided p | {p0['test_b4_minus_b1_mrr']['p_exact_two_sided']} | {p1['test_b4_minus_b1_mrr']['p_exact_two_sided']} |")
    L(f"| Fusion rescues / harms @10 | {len(p0['fusion_rescues'])} / {len(p0['fusion_harms'])} | {len(p1['fusion_rescues'])} / {len(p1['fusion_harms'])} |")
    L(f"| Outcome | {e0['primary_outcome']['outcome']} | {e1['primary_outcome']['outcome']} |")
    judge('E3-Reach primary', [(p0['b1_mrr'], p1['b1_mrr']), (p0['b4_mrr'], p1['b4_mrr']),
                               (p0['test_b4_minus_b1_mrr']['observed_mean_delta'], p1['test_b4_minus_b1_mrr']['observed_mean_delta'])],
          [(e0['primary_outcome']['outcome'], e1['primary_outcome']['outcome']), (len(p0['fusion_rescues']), len(p1['fusion_rescues'])),
           (len(p0['fusion_harms']), len(p1['fusion_harms']))])
    L('')
    L('## Materiality')
    L('')
    L('An item **changed materially** if any MRR moved by at least 0.02, or any decision, rescue count or harm count changed.')
    L('')
    for s in material:
        L(f'- {s}')
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    for g in gates():
        print(f'{g[0]}: {g[2]}')
    for s in material:
        print(s)


if __name__ == '__main__':
    main()
