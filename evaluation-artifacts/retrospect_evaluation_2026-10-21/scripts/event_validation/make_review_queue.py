"""Human review queue for held-out test cases (machine-verified labels are not authoritative until reviewed).

Every held-out B_identifier event and every held-out D_negative event is queued; a seeded 20% sample of the others
(development/validation B events) is added for an audit estimate. Verdict columns are left blank for the reviewer.
Output: review_queue/review_queue.csv (refuses to overwrite).
Usage: python -I make_review_queue.py
"""
import csv
import hashlib
import json
import os

W = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SEED = 'retrospect-review-2026-10-22'


def main():
    out = os.path.join(W, 'review_queue', 'review_queue.csv')
    if os.path.exists(out):
        raise SystemExit(f'refusing to overwrite {out}')
    inv = {r['repository']: r for r in csv.DictReader(open(os.path.join(W, 'REPOSITORY_INVENTORY.csv'), encoding='utf-8'))}
    events = {}
    for line in open(os.path.join(W, 'ground_truth', 'evolution_events.jsonl'), encoding='utf-8'):
        e = json.loads(line)
        events[e['event_id']] = e
    queued = {}
    for split in ('held_out_test', 'validation', 'development'):
        for line in open(os.path.join(W, 'retrieval_cases', split, 'cases.jsonl'), encoding='utf-8'):
            c = json.loads(line)
            if c['task'] not in ('B_identifier', 'D_negative') or c['event_id'] in queued:
                continue
            if split == 'held_out_test':
                reason = 'held_out_test (all)'
            elif int(hashlib.sha256((SEED + c['event_id']).encode()).hexdigest(), 16) % 5 == 0:
                reason = f'{split} (20% audit sample)'
            else:
                continue
            e = events[c['event_id']]
            remote = (inv.get(e['repository'], {}).get('remote_url') or '').removesuffix('.git')
            b, a = e['before'] or {}, e['after'] or {}
            queued[c['event_id']] = {
                'event_id': e['event_id'], 'queue_reason': reason, 'split': split, 'task': c['task'], 'language': e['language'],
                'repository': e['repository'], 'commit': e['commit'],
                'commit_url': f"{remote}/commit/{e['commit']}" if remote.startswith('https://github.com') else '',
                'commit_subject': e.get('commit_subject', ''), 'machine_label': e['lineage_label'],
                'before': f"{b.get('file')}::{b.get('qualifiedName')} L{b.get('startLine')}" if b else '',
                'after': f"{a.get('file')}::{a.get('qualifiedName')} L{a.get('startLine')}" if a else '',
                'similarity': e.get('similarity'), 'best_successor_containment': e.get('best_successor_containment'),
                'reviewer_verdict (confirm|relabel|reject)': '', 'reviewer_label_if_relabel': '', 'reviewer_note': '', 'reviewer': ''}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    rows = sorted(queued.values(), key=lambda r: (r['split'] != 'held_out_test', r['language'], r['repository'], r['commit']))
    with open(out, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f'{len(rows)} events queued ->', out)


if __name__ == '__main__':
    main()
