# Dataset design

## Purpose

This dataset tests whether adding Git history to Retrospect's structural retrieval helps find the **current** code for a query phrased in terms of **historical** code. It does so across Java, Python, JavaScript and TypeScript, on repositories not used during development.

## Unit of analysis

The unit is a **verified evolution event**: one function or method lineage change in one commit, checked against the source at the parent and child commits. Queries are derived from events.

- An event yields at most one query per task. Paraphrases are never generated.
- The independent statistical unit is the **cluster**: a commit, merged along evolution chains of identity-changing events.

Clusters are counted, never query volume.

## Layers

| Layer | File | Produced by |
|---|---|---|
| Repository inventory | `REPOSITORY_INVENTORY.csv` | `scripts/repository_inventory/screen_repositories.py` |
| Candidate events (unverified) | `candidate_events/<lang>/<repo>.jsonl` | `scripts/event_mining/mine_events.js` |
| Verified events + exclusion ledger | `ground_truth/evolution_events.jsonl`, `ground_truth/exclusions.jsonl` | `scripts/event_validation/verify_events.py` |
| Retrieval cases (frozen) | `ground_truth/retrieval_cases.jsonl`, `accepted_targets.jsonl`, `negative_cases.jsonl`, `case_exclusions.jsonl` | `scripts/query_validation/build_cases.js` |
| Splits (frozen) | `retrieval_cases/{development,validation,held_out_test}/cases.jsonl`, `manifests/split_manifest.json` | `scripts/split_generation/make_splits.py` |
| Human review queue | `review_queue/review_queue.csv` | `scripts/event_validation/make_review_queue.py` |
| Benchmark runs | `evaluation/runs/<name>/` | `scripts/evaluation/run_benchmark.js` |
| Analysis | `evaluation/analysis/<name>/` | `scripts/evaluation/analyze_benchmark.py` |

## Tasks

See `reports/evaluation_protocol.md` §2.

| Task | Role |
|---|---|
| **B** (old identifier → current successor) | Primary |
| C (old docstring → current successor) | Secondary |
| A (current docstring → current symbol) | Structural reference |
| D (deleted name with no successor) | Negative / false-lineage check |

## Splits

- **Grouping:** all cases of a cluster share a split.
- **Seeded hash:** about 20% development, 15% validation, 65% held-out test.
- Repositories used during earlier development (guava, requests, zod) are forced into development.
- Held-out results were not used to change anything. No parameter of Retrospect is tuned in this study.

## Design limitations

1. **Event discovery uses Retrospect's own Tree-sitter extractors**, so symbols the extractor misses cannot become targets. Indexing failures at the pin are still measured separately.
2. **Labels are machine-verified, not human-adjudicated**; the review queue lists the held-out events for review. Generalisation, specialisation and framework migration are not separately labelled.
3. **Only the most recent ~1,500 topo-ordered commits per repository are mined** (a feasibility bound). Older events are not represented.
4. **Task B uses the old identifier verbatim.** It measures one realistic but narrow query form.
5. **The pin is each clone's current HEAD.** Results are for those snapshots only.
