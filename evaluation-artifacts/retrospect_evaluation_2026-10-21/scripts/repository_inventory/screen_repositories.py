"""Screen locally available repository clones for dataset suitability (read-only git queries).

Writes REPOSITORY_INVENTORY.csv into the workspace root.
Usage: python -I screen_repositories.py
"""
import csv
import os
import re
import subprocess

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ROOTS = ['D:/clones', 'D:/base papers considered/phase_d_eval_repos', 'D:/base papers considered/laya testing/data/repos']
EXT = {'java': ('.java',), 'python': ('.py',), 'javascript': ('.js', '.jsx', '.mjs', '.cjs'), 'typescript': ('.ts', '.tsx', '.mts', '.cts')}
NONPROD = re.compile(r'(^|/)(tests?|__tests__|spec|specs|testing|test-data|testdata|fixtures?|examples?|docs?|benchmarks?|bench|node_modules|dist|build|vendor|third_party|scripts)(/|$)|\.d\.ts$|(_test|\.test|\.spec)\.\w+$|(^|/)test_[^/]+\.py$', re.I)
# Repositories used to design, tune or diagnose Retrospect: excluded from the held-out pool.
DEV_USED = {'checkstyle': 'Category B (E1/E3)', 'graphhopper': 'Category B (E1/E3)', 'undertow': 'Category B (E1/E3)',
            'datastax-java-driver': 'Category B (E1/E3)', 'zod': 'Phase B dev + TypeScript diagnosis',
            'guava': 'structural control in census (2 cases)', 'requests': 'structural control in census (1 case)'}


def git(repo, *args):
    r = subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return r.stdout.strip() if r.returncode == 0 else ''


def license_of(repo):
    for name in ('LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENCE', 'COPYING', 'license', 'LICENSE-MIT'):
        p = os.path.join(repo, name)
        if os.path.isfile(p):
            head = open(p, encoding='utf-8', errors='replace').read(3000)
            for key, label in (('Apache License', 'Apache-2.0'), ('MIT License', 'MIT'), ('Permission is hereby granted, free of charge', 'MIT'),
                               ('GNU LESSER GENERAL PUBLIC', 'LGPL'), ('GNU GENERAL PUBLIC', 'GPL'), ('Redistribution and use in source and binary', 'BSD'),
                               ('Mozilla Public License', 'MPL-2.0'), ('Eclipse Public License', 'EPL')):
                if key in head:
                    return label
            return f'unrecognised ({name})'
    return 'not found'


def main():
    rows = []
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for name in sorted(os.listdir(root)):
            repo = os.path.join(root, name).replace('\\', '/')
            if not os.path.isdir(os.path.join(repo, '.git')):
                continue
            files = git(repo, 'ls-files').splitlines()
            counts = {lang: sum(1 for f in files if f.endswith(ext) and not NONPROD.search(f)) for lang, ext in EXT.items()}
            primary = max(counts, key=counts.get)
            shallow = git(repo, 'rev-parse', '--is-shallow-repository') == 'true'
            rows.append({
                'repository': name, 'local_path': repo, 'remote_url': git(repo, 'config', '--get', 'remote.origin.url'),
                'primary_language': primary if counts[primary] else 'none',
                'prod_files_java': counts['java'], 'prod_files_python': counts['python'],
                'prod_files_javascript': counts['javascript'], 'prod_files_typescript': counts['typescript'],
                'license': license_of(repo), 'head': git(repo, 'rev-parse', 'HEAD'),
                'branch': git(repo, 'rev-parse', '--abbrev-ref', 'HEAD'), 'shallow': shallow,
                'commits': git(repo, 'rev-list', '--count', 'HEAD'), 'tags': len(git(repo, 'tag').splitlines()),
                'first_commit_date': git(repo, 'log', '-1', '--format=%as', (git(repo, 'rev-list', '--max-parents=0', 'HEAD').split() or ['HEAD'])[-1]) if not shallow else '',
                'last_commit_date': git(repo, 'log', '-1', '--format=%as'),
                'dev_usage': DEV_USED.get(name, ''),
                'held_out_eligible': name not in DEV_USED,
            })
    out = os.path.join(W, 'REPOSITORY_INVENTORY.csv')
    with open(out, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(f"{r['repository']:22s} {r['primary_language']:10s} files={max(r['prod_files_java'], r['prod_files_python'], r['prod_files_javascript'], r['prod_files_typescript']):5d} "
              f"commits={r['commits']:>6s} tags={r['tags']:4d} lic={r['license']:12s} {r['first_commit_date']}..{r['last_commit_date']} held_out={r['held_out_eligible']} {r['remote_url']}")


if __name__ == '__main__':
    main()
