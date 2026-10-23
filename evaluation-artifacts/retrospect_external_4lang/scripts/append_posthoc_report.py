"""Append the sensitivity and post-hoc rows (from analysis/external_v1_posthoc/results_posthoc.json) to REPORT.md and
paper_tables.md. Every number comes from results_posthoc.json. Run with python -I; refuses to append twice."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_report import table, fm, ci, pv  # noqa: E402
W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
P = json.load(open(os.path.join(W, 'analysis', 'external_v1_posthoc', 'results_posthoc.json'), encoding='utf-8'))
src = 'analysis/external_v1_posthoc/results_posthoc.json'
s = P['sensitivity_owner_confirmed']
ov = s['owner_verdicts']
sens = table(['Set', 'Repos', 'MRR B1', 'MRR G', 'Δ (G − B1)', '95% CI', 'p (two-sided)', 'Rescues / harms @10'],
             [['S1 + S2 + owner-confirmed S3/S3b (B_id)', s['repositories'], fm(s['mrr_b1']), fm(s['mrr_g']), fm(s['delta']), ci(s['ci95_repository_bootstrap']),
               pv(s['p_two_sided']), f"{s['rescues@10']} / {s['harms@10']}"]],
             'Sensitivity (protocol §7): confirmatory statistic with owner-rejected S3/S3b cases removed')
names = {'g': 'G lineage gate', 'b2': 'B2 historical', 'b3': 'B3 linear fusion', 'b4': 'B4 RRF fusion'}
nl = P['posthoc_bnl_without_template2']
rows = []
for k in ('g', 'b2', 'b3', 'b4'):
    c = nl[f'{k}_vs_b1']; t = c['transitions']
    rows.append(['B_nl, templates 1 and 3', f'{names[k]} vs B1', c['repositories'], fm(c['mrr_b1']), fm(c['mrr_' + k]), fm(c['delta']), ci(c['ci95_repository_bootstrap']), pv(c['p_two_sided']),
                 f"{t.get('rescue@10', 0)} / {t.get('harm@10', 0)}"])
for task in ('B_id', 'B_nl'):
    c = P['posthoc_s1_only'][task]; t = c['transitions']
    rows.append([f'S1 only (RefactoringMiner, Java), {task}', 'G lineage gate vs B1', c['repositories'], fm(c['mrr_b1']), fm(c['mrr_g']), fm(c['delta']), ci(c['ci95_repository_bootstrap']),
                 pv(c['p_two_sided']), f"{t.get('rescue@10', 0)} / {t.get('harm@10', 0)}"])
post = table(['Stratum', 'Comparison', 'Repos', 'MRR B1', 'MRR sys', 'Δ', '95% CI', 'p', 'Rescues / harms'], rows,
             'Post-hoc descriptive rows (added after the confirmatory result)')
rep = os.path.join(W, 'REPORT.md'); r = open(rep, encoding='utf-8').read()
if '## Post-hoc descriptive' in r:
    raise SystemExit('already appended')
old = "## Sensitivity (protocol §7)\n\nPending the owner review of `cases/review_sheet.csv`. The confirmatory decision above does not depend on it.\n"
assert old in r
new = ("## Sensitivity (protocol §7)\n\n"
       f"Owner verdicts (`owner_review/review_sheet_owner.csv`): {ov['confirm']} confirmed, {ov['reject']} rejected ({', '.join(ov['rejected_repositories'])}). "
       f"The confirmatory statistic was recomputed on S1 + S2 + owner-confirmed S3/S3b. This is sensitivity only; the confirmatory decision (§4) is unchanged. Source: `{src}`.\n\n"
       + '\n'.join(sens[0]) + "\n\n"
       "## Post-hoc descriptive\n\n"
       "**Post hoc: computed after the confirmatory result; descriptive only.**\n"
       "- **B_nl rows:** template 2 excluded because B1 returns no candidates above its 0.08 threshold.\n"
       "- **S1-only rows:** RefactoringMiner oracle, Java. 12 repositories, so p comes from exact sign-flip enumeration (≤ 20 units).\n\n"
       f"Source: `{src}`.\n\n" + '\n'.join(post[0]) + "\n")
open(rep, 'w', encoding='utf-8').write(r.replace(old, new))
pt = os.path.join(W, 'paper_tables.md')
with open(pt, 'a', encoding='utf-8') as f:
    for title, (md, tex) in (('Table 9. Sensitivity (owner-confirmed cases)', sens), ('Table 10. Post-hoc descriptive (template 2 excluded; S1 only)', post)):
        f.write('\n'.join([f'## {title}', '', f'Source: `{src}`. Computed after the confirmatory result.', '', *md, '', '```latex', *tex, '```', '']) + '\n')
print('appended to REPORT.md and paper_tables.md')
