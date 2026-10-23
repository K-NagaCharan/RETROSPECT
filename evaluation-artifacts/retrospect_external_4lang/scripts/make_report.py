"""Write REPORT.md and paper_tables.md. Run with python -I.

Every number about the external benchmark is read from analysis/<run>/results.json. paper_tables.md also reads the
main-benchmark findings (read-only) from retrospect_evaluation_2026-10-21/evaluation/analysis/v4_parserfix and the
fixed-code E3-Reach analysis. Usage: python -I make_report.py --results analysis/<run>/results.json
"""
import argparse
import json
import os

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OLD = 'D:/base papers considered/Test creation/retrospect_evaluation_2026-10-21'
E3 = 'D:/base papers considered/Retrospect/research_execution_2026-10-21/E3_reach_parserfix_analysis/e3_reach_results.json'
LANGS = ('java', 'python', 'javascript', 'typescript')
SYS = ('b1', 'b2', 'b3', 'b4', 'g')
NAMES = {'b1': 'B1 structural', 'b2': 'B2 historical', 'b3': 'B3 linear fusion', 'b4': 'B4 RRF fusion', 'g': 'G lineage gate'}


def fm(x, nd=3):
    if x is None:
        return '—'
    if isinstance(x, float):
        return f'{x:.{nd}f}'
    return str(x)


def ci(c):
    return f'[{c[0]:.3f}, {c[1]:.3f}]' if c else '—'


def pv(p):
    return '—' if p is None else (f'{p:.4f}' if p >= 0.0001 else f'{p:.1e}')


def tex_escape(s):
    return str(s).replace('\\', '\\textbackslash{}').replace('_', '\\_').replace('%', '\\%').replace('&', '\\&').replace('#', '\\#').replace('—', '--').replace('Δ', '$\\Delta$').replace('→', '$\\rightarrow$').replace('≥', '$\\geq$')


def table(header, rows, caption):
    md = ['| ' + ' | '.join(header) + ' |', '|' + '|'.join('---' for _ in header) + '|'] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    tex = ['\\begin{table}[t]', '\\centering', f'\\caption{{{tex_escape(caption)}}}', '\\begin{tabular}{' + 'l' * len(header) + '}', '\\hline',
           ' & '.join(tex_escape(h) for h in header) + ' \\\\', '\\hline'] + [' & '.join(tex_escape(c) for c in r) + ' \\\\' for r in rows] + ['\\hline', '\\end{tabular}', '\\end{table}']
    return md, tex


def cmp_rows(block, label):
    out = []
    for s in ('g', 'b2', 'b3', 'b4'):
        c = block[f'{s}_vs_b1']
        t = c['transitions']
        out.append([label, f'{NAMES[s]} vs B1', c['repositories'], fm(c['mrr_b1']), fm(c['mrr_' + s]), fm(c['delta']), ci(c['ci95_repository_bootstrap']), pv(c['p_two_sided']),
                    f"{t.get('rescue@10', 0)} / {t.get('harm@10', 0)}"])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--results', required=True)
    a = ap.parse_args()
    R = json.load(open(a.results, encoding='utf-8'))
    for p in (os.path.join(W, 'REPORT.md'), os.path.join(W, 'paper_tables.md')):
        if os.path.exists(p):
            raise SystemExit(f'refusing to overwrite {p}')
    c, h, d = R['confirmatory'], R['harm_check'], R['descriptive']
    sections = {}

    # Funnel
    f = R['funnel']
    rows = [[k.split('/')[0], k.split('/')[1], v['repositories_considered'], v['excluded'], v['clone_skipped'], v['no_valid_event'], v['candidate_events'],
             v['passed_extractor_check'], v['dropped_at_pin'], v['selected']] for k, v in f['by_language_source'].items()]
    rows.append(['total', '', '', '', '', '', '', '', '', f['total_selected']])
    sections['funnel'] = table(['Language', 'Source', 'Repos considered', 'Excluded', 'Clone skipped', 'No valid event', 'Candidate events', 'Passed extractor check',
                                'Dropped at pin', 'Selected'], rows, 'Case-set construction funnel (one event per repository)')

    # Confirmatory
    m = c['metrics']
    sections['confirmatory'] = table(['Task', 'Repos', 'MRR B1', 'MRR G', 'R@1 B1', 'R@1 G', 'R@10 B1', 'R@10 G', 'Δ (G − B1)', '95% CI', 'p (two-sided)', 'Rescues / harms @10', 'Decision'],
                                     [['B_id', c['repositories'], fm(m['b1']['MRR']), fm(m['g']['MRR']), fm(m['b1']['R@1']), fm(m['g']['R@1']), fm(m['b1']['R@10']), fm(m['g']['R@10']),
                                       fm(c['delta']), ci(c['ci95_repository_bootstrap']), pv(c['p_two_sided']), f"{c['rescues@10']} / {c['harms@10']}", c['decision']]],
                                     'Confirmatory test: Task B_id, G vs B1, pooled over repositories (Monte Carlo sign-flip, 100k, seed 20261023)')
    sections['harm'] = table(['Task', 'Repos', 'MRR B1', 'MRR G', 'Δ', 'Harms @10', 'Result'],
                             [['A', h['repositories'], fm(h['mrr_b1']), fm(h['mrr_g']), fm(h['delta']), h['harms@10'], h['result']]],
                             'Harm check (non-inferiority): Task A, G vs B1 (PASS if harms@10 = 0 and Δ ≥ −0.01)')
    hdr = ['Stratum', 'Comparison', 'Repos', 'MRR B1', 'MRR sys', 'Δ', '95% CI', 'p', 'Rescues / harms']
    sections['systems'] = table(hdr, cmp_rows(d['B_id'], 'B_id') + cmp_rows(d['B_nl'], 'B_nl (mean of 3 templates)') + cmp_rows(d['A'], 'A'),
                                'All systems vs B1 by task (descriptive; repository-bootstrap CIs)')
    rows = []
    for L in LANGS:
        for t in ('B_id', 'B_nl'):
            b = d['per_language'][L][t]
            if b['g_vs_b1']['repositories']:
                rows.append([L, t, b['g_vs_b1']['repositories'], *[fm(b['metrics'][s].get('MRR')) for s in SYS], fm(b['g_vs_b1']['delta']), ci(b['g_vs_b1']['ci95_repository_bootstrap'])])
    sections['per_language'] = table(['Language', 'Task', 'Repos', 'MRR B1', 'MRR B2', 'MRR B3', 'MRR B4', 'MRR G', 'Δ G − B1', '95% CI'], rows, 'Per-language results (descriptive)')
    rows = []
    for k, v in d['source_stratum'].items():
        for t in ('B_id', 'B_nl'):
            b = v[t]
            if b['g_vs_b1']['repositories']:
                rows.append([k, t, b['g_vs_b1']['repositories'], fm(b['metrics']['b1'].get('MRR')), fm(b['metrics']['g'].get('MRR')), fm(b['g_vs_b1']['delta']), ci(b['g_vs_b1']['ci95_repository_bootstrap'])])
    for k, v in d['per_template'].items():
        b = v
        rows.append([f'B_nl template {k}', 'B_nl', b['g_vs_b1']['repositories'], fm(b['metrics']['b1'].get('MRR')), fm(b['metrics']['g'].get('MRR')), fm(b['g_vs_b1']['delta']), ci(b['g_vs_b1']['ci95_repository_bootstrap'])])
    for k, v in d['name_overlap'].items():
        b = v['B_id']
        if b['g_vs_b1']['repositories']:
            rows.append([k.replace('_', ' '), 'B_id', b['g_vs_b1']['repositories'], fm(b['metrics']['b1'].get('MRR')), fm(b['metrics']['g'].get('MRR')), fm(b['g_vs_b1']['delta']), ci(b['g_vs_b1']['ci95_repository_bootstrap'])])
    sections['strata'] = table(['Stratum', 'Task', 'Repos', 'MRR B1', 'MRR G', 'Δ G − B1', '95% CI'], rows, 'Source, template and name-overlap strata (descriptive)')
    cost = d['cost_per_repository']
    rows = [[r, fm(v['clone_seconds'], 1), fm(v['index_seconds'], 1), fm(v['history_seconds_H400'], 1), v['history_profile_size_H400'], fm(v['median_latency_ms_b1'], 1), fm(v['median_latency_ms_g'], 1),
             f"{v['extraction_failures']['structural']} / {v['extraction_failures']['history_H400']}", v['parser_healthy_H400']] for r, v in sorted(cost.items())]
    sections['cost'] = table(['Repository', 'Clone s', 'Index s', 'History s (H400)', 'Profile size', 'Median latency B1 ms', 'Median latency G ms', 'Extraction failures (index / history)', 'Parser healthy'],
                             rows, 'Cost per repository')

    # Worked examples
    ex_lines = []
    for L in LANGS:
        e = R['worked_examples'].get(L)
        if not e:
            continue
        r = e['b_id_ranks']
        ex_lines += [f"### {L}: {e['repository']} ({e['source']})", '',
                     f"- **Commit:** {e['commit_url']}",
                     f"- **Rename:** `{e['old_name']}` → `{e['new_name']}`",
                     f"- **Target at pin `{e['pin'][:10]}`:** `{e['target']['qualifiedName']}` in `{e['target']['file']}`",
                     f"- **B_id query `{e['old_name']}`, ranks:** " + ', '.join(f"{s.upper()} {fm(r[s])}" for s in SYS) + f" (lineage matches: {e['g_lineage_matches']})",
                     '- **B_nl ranks by template:** ' + '; '.join(f"T{k}: B1 {fm(v['b1'])}, G {fm(v['g'])}" for k, v in sorted(e['b_nl_ranks_by_template'].items())), '']

    integ = R['integrity']
    rep = ['# External 4-language rename benchmark: report', '',
           'Pre-registered in `protocol.md` (deviations in §9). Code: Retrospect `eval-v1` (see `VERSION.md`). Every number below is read from `' + os.path.relpath(a.results, W).replace('\\', '/') + '`.', '',
           '## Funnel', '', *sections['funnel'][0], '',
           '## Confirmatory test', '', *sections['confirmatory'][0], '',
           '## Harm check', '', *sections['harm'][0], '',
           '## Descriptive results', '', *sections['systems'][0], '', *sections['per_language'][0], '', *sections['strata'][0], '',
           f"Identifiers were extracted from B_nl queries (per template): {d['b_nl_ids_extracted']}. A template without an extracted identifier gives G = B1 by construction.", '',
           '## Cost', '', *sections['cost'][0], '',
           '## Integrity', '',
           f"- **Skipped cases:** {R['skipped_cases']}.",
           f"- **Targets not indexed:** {len(integ['not_indexed'])}.",
           f"- **Parser unhealthy at H = 400:** {integ['parser_unhealthy_H400'] or 'none'}.",
           f"- **Events not in window or not diffed at H = 400:** {integ['not_in_window_or_not_diffed'] or 'none'}.",
           f"- **Violations of G == B1 when L is empty:** {len(integ['g_equals_b1_when_L_empty_violations'])}.", '',
           '## Worked examples (rule: per language, the B_id case with the largest RR_G − RR_B1; ties by repository name)', '', *ex_lines,
           '## Sensitivity (protocol §7)', '', 'Pending the owner review of `cases/review_sheet.csv`. The confirmatory decision above does not depend on it.', '']
    open(os.path.join(W, 'REPORT.md'), 'w', encoding='utf-8').write('\n'.join(rep) + '\n')

    # Paper tables: core external tables + main benchmark findings (read-only sources).
    a4 = json.load(open(os.path.join(OLD, 'evaluation', 'analysis', 'v4_parserfix', 'BCA', 'analysis_results.json'), encoding='utf-8'))
    d4 = json.load(open(os.path.join(OLD, 'evaluation', 'analysis', 'v4_parserfix', 'D', 'analysis_results.json'), encoding='utf-8'))
    e3 = json.load(open(E3, encoding='utf-8'))
    rows = []
    for key, lab in (('H400/held_out_test/pooled/B_identifier/in_window', 'Held-out B, in window, H=400'),
                     ('H400/held_out_test/pooled/B_identifier/all_indexed', 'Held-out B, all indexed, H=400'),
                     ('H50/held_out_test/pooled/B_identifier/all_indexed', 'Held-out B, all indexed, H=50')):
        s = a4['secondary'][key]
        t = s['b4_vs_b1']['transitions']
        rows.append([lab, f"{s['metrics']['b1']['n']} / {s['b4_vs_b1']['clusters']}", *[f"{s['metrics'][k]['MRR']:.3f}" for k in ('b1', 'b2', 'b3', 'b4')],
                     f"{s['b4_vs_b1']['delta_mrr_cluster_mean']:+.3f}", f"{t.get('rescue@10', 0)} / {t.get('harm@10', 0)}"])
    main_t = table(['Stratum', 'Cases / clusters', 'MRR B1', 'MRR B2', 'MRR B3', 'MRR B4', 'Δ B4 − B1', 'B4 rescues / harms'], rows,
                   'Main benchmark (4 languages, held-out, v4 parser-fix): structural vs historical vs fusion')
    rows = [[k.split('/')[2], k.split('/')[0][1:], v['cases'], v['clusters'], f"{v['false_lineage_claim_rate_top10']:.4f}"]
            for k, v in sorted(d4['secondary'].items()) if '/held_out_test/' in k and 'D_negative' in k]
    d_t = table(['Language', 'H', 'Cases', 'Clusters', 'False-lineage-claim rate (B2 top-10)'], rows, 'Main benchmark Task D (held-out): false lineage claims')
    p = e3['sets']['primary']
    e3_t = table(['Set', 'Cases', 'Clusters', 'MRR B1', 'MRR B4', 'Δ B4 − B1', 'p (exact)', 'Rescues / harms', 'Outcome'],
                 [['E3-Reach primary (Java, H=400, fixed code)', p['N'], p['clusters'], f"{p['b1_mrr']:.3f}", f"{p['b4_mrr']:.3f}",
                   f"{p['test_b4_minus_b1_mrr']['observed_mean_delta']:+.3f}", p['test_b4_minus_b1_mrr']['p_exact_two_sided'],
                   f"{len(p['fusion_rescues'])} / {len(p['fusion_harms'])}", e3['primary_outcome']['outcome']]], 'E3-Reach (pre-registered, Java)')
    pt = ['# Paper tables', '', 'Each table is given in Markdown and as a LaTeX `tabular`.',
          'Sources:',
          f"- External benchmark: `{os.path.relpath(a.results, W).replace(os.sep, '/')}`.",
          '- Main benchmark: `retrospect_evaluation_2026-10-21/evaluation/analysis/v4_parserfix/`.',
          '- E3-Reach: `Retrospect/research_execution_2026-10-21/E3_reach_parserfix_analysis/`.', '']
    for title, (md, tex) in (('Table 1. External benchmark funnel', sections['funnel']), ('Table 2. Confirmatory test', sections['confirmatory']),
                             ('Table 3. Harm check', sections['harm']), ('Table 4. All systems vs B1 (external)', sections['systems']),
                             ('Table 5. Per language (external)', sections['per_language']), ('Table 6. Main benchmark: in-window and all-indexed', main_t),
                             ('Table 7. Main benchmark Task D', d_t), ('Table 8. E3-Reach', e3_t)):
        pt += [f'## {title}', '', *md, '', '```latex', *tex, '```', '']
    open(os.path.join(W, 'paper_tables.md'), 'w', encoding='utf-8').write('\n'.join(pt) + '\n')
    print('wrote REPORT.md and paper_tables.md')


if __name__ == '__main__':
    main()
