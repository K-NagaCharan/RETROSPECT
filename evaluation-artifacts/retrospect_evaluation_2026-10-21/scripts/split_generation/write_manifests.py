"""Freeze manifests: repository pins, ground-truth/case checksums, environment. Refuses to overwrite.
Usage: python -I write_manifests.py
"""
import csv
import glob
import hashlib
import json
import os
import platform
import subprocess

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R = 'D:/base papers considered/Retrospect'


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def out(name, obj):
    p = os.path.join(W, 'manifests', name)
    if os.path.exists(p):
        raise SystemExit(f'refusing to overwrite {p}')
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2)


def run(cmd, cwd=None):
    try:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True).stdout.strip()
    except OSError:
        return None


def main():
    os.makedirs(os.path.join(W, 'manifests'), exist_ok=True)
    events = [json.loads(l) for l in open(os.path.join(W, 'ground_truth', 'evolution_events.jsonl'), encoding='utf-8')]
    used = sorted({e['repository'] for e in events})
    inv = {r['repository']: r for r in csv.DictReader(open(os.path.join(W, 'REPOSITORY_INVENTORY.csv'), encoding='utf-8'))}
    out('repository_commits.json', {r: {'path': inv[r]['local_path'], 'remote': inv[r]['remote_url'], 'pin': inv[r]['head'],
                                        'current_head': run(['git', '-C', inv[r]['local_path'], 'rev-parse', 'HEAD']),
                                        'license': inv[r]['license']} for r in used})
    files = [os.path.join(W, 'REPOSITORY_INVENTORY.csv')] + sorted(glob.glob(os.path.join(W, 'ground_truth', '*.jsonl'))) + \
        sorted(glob.glob(os.path.join(W, 'retrieval_cases', '*', 'cases.jsonl'))) + sorted(glob.glob(os.path.join(W, 'candidate_events', '*', '*.jsonl')))
    out('event_checksums.json', {os.path.relpath(p, W).replace('\\', '/'): sha(p) for p in files})
    out('environment_manifest.json', {
        'os': platform.platform(), 'python': platform.python_version(), 'node': run(['node', '--version']), 'git': run(['git', '--version']),
        'retrospect_head': run(['git', 'rev-parse', 'HEAD'], cwd=R),
        'retrospect_uncommitted_entries': len((run(['git', 'status', '--porcelain'], cwd=R) or '').splitlines()),
        'retrospect_source_sha256': {p: sha(os.path.join(R, p)) for p in (
            'src/retrieval/HistoricalRetrievalAdapter.js', 'src/retrieval/RRFv2.js', 'src/git/GitHistoryReader.js', 'src/git/historyWindow.js',
            'src/structural/retrieval/StructuralRetriever.js', 'src/structural/query/QueryProcessor.js',
            'src/languages/JavaScriptAdapter.js', 'src/languages/TypeScriptAdapter.js')},
        'gpu': 'not used', 'paid_api_calls': 'none'})
    print('manifests written for', len(used), 'repositories,', len(files), 'checksummed files')


if __name__ == '__main__':
    main()
