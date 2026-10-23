"""Convert the Phase B lineage benchmark into the record format read by scratch/run_java_case_study.js.

Read-only on its inputs. Writes one derived dataset (cases with a ground-truth target) and one
exclusion list into --out-dir. No labels, queries, targets or commits are created: every field is
copied from data/evaluation_lineage_queries_v4.json and data/benchmark_lineage_audited_v3.json.

Pin = HEAD of the shallow clone in data/external_repos/<repo> (Phase B evaluated the clone HEAD;
the dataset records no separate pin). Query = query_sanitized if present, else query (as in
scripts/evaluate_phase_b_fusion.js:95).

Usage: python -I convert_phase_b_for_case_study.py --out-dir <dir>
"""
import argparse
import json
import os
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
QUERIES = os.path.join(ROOT, 'data', 'evaluation_lineage_queries_v4.json')
BENCH = os.path.join(ROOT, 'data', 'benchmark_lineage_audited_v3.json')
REPOS = os.path.join(ROOT, 'data', 'external_repos')


def head(repo):
    return subprocess.run(['git', '-C', os.path.join(REPOS, repo), 'rev-parse', 'HEAD'],
                          capture_output=True, text=True, check=True).stdout.strip()


def truthy(v):
    return v is True or str(v).lower() == 'true'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out-dir', required=True)
    a = ap.parse_args()
    out_dir = os.path.abspath(a.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_cases = os.path.join(out_dir, 'phase_b_case_study_input.json')
    out_excl = os.path.join(out_dir, 'phase_b_excluded.json')
    for p in (out_cases, out_excl):
        if os.path.exists(p):
            raise SystemExit(f'refusing to overwrite {p}')

    with open(QUERIES, encoding='utf-8') as f:
        queries = json.load(f)
    with open(BENCH, encoding='utf-8') as f:
        bench = {b['case_id']: b for b in json.load(f)}

    pins = {r: head(r) for r in sorted({q['repository'] for q in queries})}
    cases, excluded = [], []
    for q in queries:
        b = bench[q['case_id']]
        ev = b.get('evidence') or {}
        if not truthy(q['has_answer']) or not q.get('target_symbol_name') or not q.get('target_file_path'):
            excluded.append({'case_id': q['case_id'], 'repository': q['repository'], 'language': q['language'],
                             'evolution_type': q['evolution_type'],
                             'reason': 'no ground-truth target (has_answer=False or target missing); not rankable'})
            continue
        cases.append({
            'case_id': q['case_id'],
            'repository_id': q['repository'],
            'target_language': q['language'],
            'source_revision_sha': pins[q['repository']],
            'query': {'query_text': q.get('query_sanitized') or q['query']},
            'target_symbols': [{'symbol_name': q['target_symbol_name'], 'file_path': q['target_file_path']}],
            'historical_evidence': {'origin_commit_sha': ev.get('commit_hash'), 'change_type': q['evolution_type']},
            'phase_b_metadata': {
                'evolution_type': q['evolution_type'],
                'predecessor_name': q.get('predecessor_name'),
                'is_valid_predecessor': b.get('is_valid_predecessor'),
                'verification_status': b.get('verification_status'),
                'query_was_sanitized': truthy(q.get('has_sanitization'))
            }
        })
    with open(out_cases, 'w', encoding='utf-8') as f:
        json.dump(cases, f, indent=2)
    with open(out_excl, 'w', encoding='utf-8') as f:
        json.dump(excluded, f, indent=2)
    print(f'{len(cases)} rankable cases, {len(excluded)} excluded; pins {pins}')


if __name__ == '__main__':
    main()
