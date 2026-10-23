# Progress manifest

The working directory is this folder. Every step refuses to overwrite its frozen outputs; to redo a step, write to a new folder.

| # | Step | Status | Resume command |
|---|---|---|---|
| 1 | Current evidence consolidated (Part A) | done | `python -I scripts/evaluation/consolidate_current_results.py` |
| 2 | Repository screening | done (31 repos) | `python -I scripts/repository_inventory/screen_repositories.py` |
| 3 | Mining feasibility | done (`candidate_events/feasibility_v2..v4`) | — |
| 4 | Harness equivalence (136/136 E2 ranks) | done | see `evaluation/harness_equivalence/` |
| 5 | Protocols pre-registered | done | `reports/evaluation_protocol.md`, `reports/ground_truth_protocol.md` |
| 6 | Mining, window 1500 | done (26 repositories) | `bash scripts/event_mining/run_mining_batch.sh <lang> 1500 name=path ...` (see the batch commands in the log header) |
| 7 | Verification | done | `python -I scripts/event_validation/verify_events.py` |
| 8 | Case building (freezes cases) | done | `node scripts/query_validation/build_cases.js` |
| 9 | Splits plus manifests (freeze) | done | `python -I scripts/split_generation/make_splits.py && python -I scripts/split_generation/write_manifests.py` |
| 10 | Review queue | done | `python -I scripts/event_validation/make_review_queue.py` |
| 11 | Benchmark runs | done (`*_BCA_v3`, `*_D_v3`; earlier runs superseded) | `node scripts/evaluation/run_benchmark_resumable.js --cases retrieval_cases/<split>/cases.jsonl --out evaluation/runs/<new> --tasks ...` |
| 12 | Analysis | done (`evaluation/analysis/BCA_v3`, `D_v3`) | `python -I scripts/evaluation/analyze_benchmark.py --runs evaluation/runs/* --out evaluation/analysis/v1` |
| 13 | Reports | done | `DATASET_STATUS.md`, `reports/final_results.md`, `reports/quality_audit.md`, `reports/exclusion_analysis.md` |
| 13b | Parser-fix re-measurement (v4): re-run aborted snapshots with the fixed parser, analyse into `evaluation/analysis/v4_parserfix/` | done (`reports/parserfix_remeasurement.md`, `reports/deviations_log.md`) | `python -I scripts/evaluation/parserfix_rerun.py run && python -I scripts/evaluation/parserfix_rerun.py merge`, then `analyze_benchmark.py` on `evaluation/runs/merged_v4_parserfix/*` |
| 14 | Owner review of `review_queue/review_queue.csv` (1,005 events) | **remaining** (not required for the external confirmation) | — |

The machine-readable version is `progress_manifest.json`. Results are provisional until the owner review is done.
