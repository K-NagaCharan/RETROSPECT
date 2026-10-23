# Retrospect evaluation workspace (2026-10-21/22)

This workspace evaluates Retrospect's evolution-aware retrieval on a new, evidence-grounded, four-language dataset. It is separate from the Retrospect repository (`D:\base papers considered\Retrospect`) and never modifies it, its clones, or earlier results.

**Scope:** retrieval only. Retrospect's LLM response-generation layer is not implemented and is not evaluated here.

## Status (2026-10-23)

- **Complete.** Mining, verification, case freeze, splits, benchmark runs (`*_BCA_v3`, `*_D_v3`) and analysis are done.
- **Parser-fix re-measurement (v4).** The Tree-sitter memory-leak fix (Retrospect `ed02019`, merged into `eval-v1`) was applied, and the snapshots whose parser had aborted were re-run. See `reports/parserfix_remeasurement.md` and `reports/deviations_log.md` (Deviation 2).
- **Authoritative analysis:** `evaluation/analysis/v4_parserfix/` (`BCA/` and `D/`). `BCA_v3`/`D_v3` are the as-run v3 results.
- **Owner review still pending.** `review_queue/review_queue.csv` has not been reviewed, so labels remain **machine-verified**. This is not required for the external confirmation in `../retrospect_external_4lang/`.
- **LLM layer.** Since `cli-v1.0.0`, Retrospect has an LLM layer (`rtro ask`). It is not evaluated here; this workspace evaluates retrieval only.

## Start here

| File | Contents |
|---|---|
| `CURRENT_PROJECT_RESULTS.md` | Authoritative metrics from the experiments **before** this dataset (E1, E2, E3-Reach, E-Lineage) |
| `DATASET_STATUS.md` | What was collected, verified, excluded, and how many clusters per language and split |
| `reports/evaluation_protocol.md` | The pre-registered analysis |
| `reports/ground_truth_protocol.md` | How events and queries are derived and verified |
| `reports/final_results.md` | Results on the new dataset |
| `PROGRESS_MANIFEST.md` | Completed and remaining steps, with resume commands |

## Reproduce (read-only on repositories; outputs refuse to overwrite)

1. **Mine candidate events.**

   ```bash
   bash scripts/event_mining/run_mining_batch.sh <lang> 1500 name=path ...
   ```

2. **Verify events.**

   ```bash
   python -I scripts/event_validation/verify_events.py
   ```

3. **Build retrieval cases.**

   ```bash
   node scripts/query_validation/build_cases.js
   ```

4. **Generate splits.**

   ```bash
   python -I scripts/split_generation/make_splits.py
   ```

5. **Build the human review queue.**

   ```bash
   python -I scripts/event_validation/make_review_queue.py
   ```

6. **Run the benchmark.** Each repository must be clean at HEAD == pin.

   ```bash
   node scripts/evaluation/run_benchmark.js --cases retrieval_cases/held_out_test/cases.jsonl --out evaluation/runs/<new> --horizons 50,400
   ```

7. **Analyze the runs.**

   ```bash
   python -I scripts/evaluation/analyze_benchmark.py --runs evaluation/runs/<a> ... --out evaluation/analysis/<new>
   ```

8. **Run the statistics tests.**

   ```bash
   python -I tests/test_analysis_stats.py
   ```
