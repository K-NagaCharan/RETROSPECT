# Corrected reporting outputs — Retrospect 45-case census (run of 2026-10-20)

This folder holds **corrected reporting artifacts** for the multi-repository evaluation run on 2026-10-20. It replaces nothing: every original result, dataset, audit file and earlier report is left unchanged. The superseded paper-facing files in `../research/` are listed in `discrepancy_log.md`.

**What this is:** a correct relabelling and recomputation of measured per-case ranks, with reachability measured directly from Git.
**What this is not:** a rerun of retrieval, new data, a changed algorithm, or evidence that the experiment design is valid.

## Files

| File | Content | Value status |
|---|---|---|
| `per_case_results_corrected.csv` | 46 rows: 45 evaluated cases + 1 excluded before evaluation. Ranks and scores for B1–B4, corrected roles, reachability, outcomes, failure modes. | Ranks and scores **copied** (measured in the 2026-10-20 run). Reachability **newly measured** (read-only git). Outcomes and labels **recomputed**. |
| `results_by_group.csv` | Success@1/5/10 and MRR for B1–B4, outcome counts, fusion rescues and harms, case IDs, for every grouping | **Recomputed** |
| `results.json` | Same groups plus metric definitions, method labels, the exact permutation test, builder checks, and measured defects of the superseded CSV | **Recomputed** |
| `corrected_experiment_report.md` | Concise report generated from `results.json` | Generated |
| `provenance_manifest.json` | SHA-256 of all 14 inputs and 4 generated outputs; run configuration; git commands; case counts; role definitions | Generated |
| `discrepancy_log.md` | What was corrected, what was not, and why | Written by hand |
| `build_corrected_reporting.py` | Builder. Reads inputs, writes only into this folder. | — |
| `validate_outputs.py` | Independent read-only validator | — |

## How to reproduce

From this folder, with Python 3 and git on PATH and `D:\clones` present:

```bash
python -I build_corrected_reporting.py
```

```bash
python -I validate_outputs.py
```

- The builder runs only read-only git commands (`cat-file -e`, `merge-base --is-ancestor`, `rev-list --count`, `log --topo-order -n 50`, `rev-parse`). It never checks out anything.
- It aborts if an input is missing or if the run's `search_horizon` is not 50.
- It refuses to write outside this folder.
- Rebuilding rewrites the `generated_utc` timestamps in `results.json`, `corrected_experiment_report.md` and the manifest; the metric values do not change.

## Inputs (hashes in `provenance_manifest.json`)

- **Per-case ranks:** `Test creation\experiments\final_multirepo_evaluation_audit_2026-10-20\corrected_per_case_results.csv`. The builder checks these against the raw run file `final_multirepo_evaluation_merge_aware_2026-10-20\per_case_results.csv`: all 45 × 4 ranks are identical.
- **Exclusions and the audit's own reconciled distances:** `…\final_multirepo_evaluation_audit_2026-10-20\case_reconciliation.csv`.
- **Run configuration:** `…\final_multirepo_evaluation_merge_aware_2026-10-20\experiment_config.json`.
  - H = 50, merge-aware `--topo-order`.
  - B1 structural; B2 historical; B3 linear 0.60·S + 0.40·H; B4 RRF-v2 with k = 60, wS = wH = 0.50, zero-signal gating.
  - The source-file fingerprints of the run are in that audit folder's `reproducibility_manifest.txt`. No git commit contains that code.
- **Ground-truth status:** `Test creation\audits\category_b_java_audit_2026-10-19\case_audit_results.csv` (verified / needs_review / rejected) and `Test creation\datasets\exploratory_java_v1_reconciled\quarantine_manifest.json` (rejection reasons).
- **Repositories:** `D:\clones\<repo>`, used read-only to measure pin and origin existence, ancestry, distance and topological position.

## Evaluation roles (inclusion and exclusion criteria)

Roles are assigned mechanically by these rules; no case was moved because of its results. The original hard-coded cohort label is kept in the column `original_cohort_label`.

| Role | Rule | N | Eligible for historical claims |
|---|---|---:|---|
| `primary_verified_rename_in_window` | Category B audit status `verified` | 5 | yes |
| `needs_review_reachable` | Category B status `needs_review` and origin within the first 50 commits of `git log --topo-order <pin>` | 6 | yes (not adjudicated) |
| `needs_review_unreachable` | Category B status `needs_review`; origin is an ancestor of the pin but outside that window | 14 | yes, as reachability failures |
| `rejected_ground_truth` | Category B status `rejected` (spurious RefactoringMiner match, algorithm rewrite, class/file mismatch, malformed query). The audit (§3.2) directs exclusion from all evaluation runs. | 4 | **no**. Ranks shown for transparency only; **not negatives**. |
| `current_code_control` | Structural pilot with no origin commit | 3 | as controls only |
| `anchor_origin_is_pin` | Origin commit equals the pin (k = 0) | 2 | yes, but there is no history to traverse |
| `cross_language_origin_verified` | Cross-language pilot whose origin exists in the clone and is an ancestor of the pin | 3 | yes |
| `cross_language_origin_missing` | Cross-language pilot whose recorded origin commit does not exist in the full clone | 8 | **no**. Provenance invalid. Not inferred to be outside the horizon. |
| `excluded_before_evaluation` | Already excluded by the audit (pin missing): `CASE-HIST-JS-004` | 1 | no |

## Reachability field (`history_reachability_h50`)

The field is measured, not inferred. Priority order: `PIN_NOT_FOUND` → `NO_ORIGIN_RECORDED` → `ORIGIN_NOT_FOUND_IN_CLONE` → `ORIGIN_NOT_ANCESTOR_OF_PIN` → `ORIGIN_IS_PIN` (rev-list distance 0) → `IN_TOPO50_WINDOW` (origin among the 50 commits returned by `git log --topo-order -n 50 <pin>`, which is exactly the set the historical channel reads) → `NOT_IN_TOPO50_WINDOW`.

Counts: 13 in window, 19 outside, 8 origin missing, 3 no origin, 2 origin = pin, 1 pin missing.

- Both distances are reported: `rev_list_distance` (`git rev-list --count origin..pin`) and `topo_order_position`. They differ for 0101 (62 vs 35) and 0044–0046 (52 vs 34). This difference is the cause of the original `OUTSIDE_SEARCH_HORIZON` contradiction.
- The run's original Stage A label is kept in `original_run_stage_a_status`.
- The audit's reconciled label is kept in `audit_stage_a_status_reconciled`.
- **The horizon itself was not changed.**

## Metric definitions

- **Success@k:** fraction of cases in the group whose target rank is ≤ k. Unranked counts as a miss. Denominator = N of the group.
- **MRR:** mean of 1/rank over the group. Unranked contributes 0. Denominator = N.
- **Outcome at k = 10:**
  - A = B2 ≤ 10 and B1 > 10 or unranked (historical rescue).
  - B = both ≤ 10.
  - C = B1 only.
  - D = neither.
- **Fusion impact:** rescue = B4 ≤ 10 and B1 not; harm = B1 ≤ 10 and B4 not.
- **Clusters:** distinct origin commits (the case ID is used when there is no origin).
- **Permutation test:** exact two-sided sign-flip over the 2^5 sign assignments of per-case B4 − B1 differences in the primary role. Each case has a distinct origin commit. Both the plain and the (count + 1)/(2^M + 1) p-value are reported. The latter matches the audit's value.

`historical_failure_mode` precedence:
1. rejected → `NOT_INTERPRETABLE_REJECTED_GROUND_TRUTH`
2. B2 ≤ 10 → `NONE_B2_TOP10`
3. origin missing → `NOT_INTERPRETABLE_ORIGIN_MISSING`
4. no origin → `NOT_APPLICABLE_NO_REFACTORING`
5. k = 0 → `NO_PRIOR_HISTORY_K0`
6. outside window → `ORIGIN_OUTSIDE_TOPO50_WINDOW`
7. otherwise by Stage B: `IN_WINDOW_AMBIGUOUS_MATCH`, `IN_WINDOW_UNMATCHED`, `IN_WINDOW_RANKED_BELOW_10`, `IN_WINDOW_NO_B2_SCORE`

`query_form` is taken from the query text: `templated_with_historical_identifier` (starts with "Locate current implementation corresponding to historical method"), `identifier_only` (no spaces), or `natural_language`. It replaces the never-populated `contains_historical_identifier` field.

## Limitations

These outputs are only as good as the run behind them.

- Queries in 29 cases are templated and contain the historical name and the enclosing class name.
- No case is human-adjudicated.
- The primary role has 5 clusters, so no test can reach p < 0.05.
- Only Java rename cases are reachable and valid.
- Ranks were measured once, with uncommitted code.
- B2's top-1 identity was not recorded, so "incorrect historical candidate" cannot be measured.

See `discrepancy_log.md` for the open items.
