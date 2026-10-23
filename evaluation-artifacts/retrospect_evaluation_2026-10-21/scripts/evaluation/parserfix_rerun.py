"""Deviation 2 (parser memory-leak fix): re-run only the v3 snapshots whose parser aborted, then build merged inputs.

  python -I parserfix_rerun.py plan     -> lists aborted (run, repository, H) snapshots from the v3 per-case probes
  python -I parserfix_rerun.py run      -> for each affected v3 run, writes evaluation/runs/<run>_v4_parserfix/input_cases.jsonl
                                           (the affected repositories' cases, copied from the frozen split file) and runs
                                           run_benchmark_resumable.js on it (one process per repository)
  python -I parserfix_rerun.py merge    -> evaluation/runs/merged_v4_parserfix/<run>/case_results.jsonl:
                                           v3 rows for unaffected repositories + v4 rows for re-run repositories
Never writes into *_v3, retrieval_cases/, manifests/ or reports/evaluation_protocol.md.
"""
import glob
import json
import os
import subprocess
import sys

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RUNS = os.path.join(W, 'evaluation', 'runs')
TASKS = {'BCA': 'B_identifier,C_docstring,A_current_doc', 'D': 'D_negative'}


def plan():
    out = {}
    for d in sorted(glob.glob(os.path.join(RUNS, '*_v3'))):
        name = os.path.basename(d)
        bad = {}
        for line in open(os.path.join(d, 'case_results.jsonl'), encoding='utf-8'):
            r = json.loads(line)
            for H, ok in (r.get('parser_healthy_after_history') or {}).items():
                if ok is False:
                    bad.setdefault(r['repository'], set()).add(H)
        if bad:
            out[name] = {repo: sorted(hs) for repo, hs in sorted(bad.items())}
    return out


def split_and_kind(name):
    base = name[:-len('_v3')]
    kind = 'BCA' if base.endswith('_BCA') else 'D'
    return base[:-len('_' + kind)], kind


def run():
    for name, repos in plan().items():
        split, kind = split_and_kind(name)
        out = os.path.join(RUNS, f'{name}_v4_parserfix')
        os.makedirs(out, exist_ok=True)
        cases_path = os.path.join(out, 'input_cases.jsonl')
        tasks = set(TASKS[kind].split(','))
        rows = [l for l in open(os.path.join(W, 'retrieval_cases', split, 'cases.jsonl'), encoding='utf-8')
                if json.loads(l)['repository'] in repos and json.loads(l)['task'] in tasks]
        if not os.path.exists(cases_path):
            with open(cases_path, 'w', encoding='utf-8') as f:
                f.writelines(rows)
        print(f'{name}: repos={sorted(repos)} cases={len(rows)} -> {out}', flush=True)
        subprocess.run(['node', os.path.join(W, 'scripts', 'evaluation', 'run_benchmark_resumable.js'), '--cases', cases_path,
                        '--out', out, '--tasks', TASKS[kind]], cwd=W)


def merge():
    p = plan()
    for name, repos in p.items():
        v4 = os.path.join(RUNS, f'{name}_v4_parserfix')
        if not os.path.exists(os.path.join(v4, 'case_results.jsonl')):
            raise SystemExit(f'{v4} incomplete; run first')
    for d in sorted(glob.glob(os.path.join(RUNS, '*_v3'))):
        name = os.path.basename(d)
        out = os.path.join(RUNS, 'merged_v4_parserfix', name)
        if os.path.exists(os.path.join(out, 'case_results.jsonl')):
            raise SystemExit(f'refusing to overwrite {out}')
        os.makedirs(out, exist_ok=True)
        repos = set(p.get(name, {}))
        rows = [l for l in open(os.path.join(d, 'case_results.jsonl'), encoding='utf-8') if json.loads(l)['repository'] not in repos]
        n3 = len(rows)
        if repos:
            rows += open(os.path.join(RUNS, f'{name}_v4_parserfix', 'case_results.jsonl'), encoding='utf-8').readlines()
        with open(os.path.join(out, 'case_results.jsonl'), 'w', encoding='utf-8') as f:
            f.writelines(rows)
        with open(os.path.join(out, 'SOURCE.json'), 'w', encoding='utf-8') as f:
            json.dump({'v3_run': name, 'v3_rows_kept': n3, 'replaced_repositories': sorted(repos),
                       'v4_run': f'{name}_v4_parserfix' if repos else None, 'total_rows': len(rows)}, f, indent=2)
        print(f'{name}: kept {n3} v3 rows, replaced {sorted(repos)}, total {len(rows)}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    if cmd == 'plan':
        print(json.dumps(plan(), indent=1))
    elif cmd == 'run':
        run()
    elif cmd == 'merge':
        merge()
