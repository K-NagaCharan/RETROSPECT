# Discrepancy Log — corrected reporting, 2026-10-21

Scope: the paper-facing reporting layer for the 2026-10-20 census. IDs D1–D17 refer to `../Report_change.md` §19.2.

**Status key:**
- **Corrected here**: a corrected version exists in this folder; the original file is unchanged.
- **Documented**: not repairable without changing the design or the evidence, or out of scope.
- **Not reproduced**: the claim could not be traced to measured data.

## A. Corrected here

| # | Defect (original location) | Evidence | Correction in this folder |
|---|---|---|---|
| C1 (D6) | `research/per_case_empirical_results.csv`: `commit_distance` and `stage_a_reachability` empty in all 45 rows | `scratch/generate_research_deliverables.js` reads `commit_distance` / `stage_a_reachability`; the source CSV names them `commit_distance_k` / `stage_a_status_reconciled`. `results.json` → `superseded_research_csv_defects_measured`: 45/45 empty. | `rev_list_distance`, `topo_order_position` and `history_reachability_h50` are measured from git. Both of the audit's columns are carried along for comparison. The builder checks that the measured values equal the audit's wherever the audit defines them (PASS). |
| C2 (D6) | `contains_historical_identifier` empty, so `category_breakdown.csv` reports all 45 as "Behavioral-Only" and all 45 as "No Distance" | The field does not exist in the source CSV | Replaced by `query_form`, derived from the query text: 29 templated with the historical identifier, 14 natural language, 2 identifier-only. `category_breakdown.csv` is not reproduced. Its groupings are superseded by the role and reachability groupings. |
| C3 (D6) | Failure mode `LOOKBACK_HORIZON_EXCEEDED` never assigned (0/45); horizon failures labelled `VOCABULARY_OR_DIFF_MISMATCH` | Same column bug | `historical_failure_mode` with documented precedence: 17 `ORIGIN_OUTSIDE_TOPO50_WINDOW`; 8 `NOT_INTERPRETABLE_ORIGIN_MISSING`; and so on |
| C4 (D3) | Run's Stage A label `OUTSIDE_SEARCH_HORIZON` for 0101 and 0044–0046, although their origins are at topo positions 35 and 34 | Stage A used `git rev-list --count`; retrieval reads `git log --topo-order -n 50` | Reachability is defined by the commit set the retrieval actually reads. The original label is kept in `original_run_stage_a_status`. **The code defect is not fixed** (see B1). |
| C5 (D7) | Cases 0031, 0034, 0048 and 0050 reported as "Category D: Quarantined Negatives", with failure mode `INTENDED_ABSTENTION_NEGATIVE`, supporting a "0% false-positive / safe abstention" claim | `quarantine_manifest.json` and the Category B audit: rejected for spurious matches, a rewrite, a class/file mismatch and a malformed query; the audit directs exclusion from evaluation runs. All four have real target symbols. 0048 and 0050 are inside the window and B2 *does* score them (ranks 708, 173). | Role `rejected_ground_truth`, ineligible. Ranks are shown for transparency; no negative-control or abstention claim is made. **No valid negative set exists**, so the abstention question is unanswered (B2). |
| C6 | Cohort `distance_stratified_diagnostic` was defined by a hard-coded set, not by distance. It contains 0019 and 0020 (k = 36) and four topo-reachable cases. | `scratch/run_full_multirepo_evaluation.js:239-255` | Replaced by `needs_review_reachable` (6) and `needs_review_unreachable` (14), using the audit status plus measured reachability. The original label is kept. |
| C7 (D8) | 8 cross-language cases treated as valid historical cases. The pilot's `lineage_verification.md` says "Verified" ancestry; `limitations.md` blames shallow clones. | `git cat-file -e` fails for 8 origins; all clones are full | Role `cross_language_origin_missing`, ineligible, reachability `ORIGIN_NOT_FOUND_IN_CLONE`. **No distance or horizon status is inferred** for them. Pins were not repaired and no commit IDs were invented. |
| C8 (D5) | `research/evaluation_results_report.md` (hand-written; no generator found): B3 column copies B4 in every cohort; anchors "2 shared success"; census totals 9 shared / 14 neither | Per-case ranks: B3 values differ (e.g. primary B3 MRR 0.3213 vs B4 0.3652; S@5 80% vs 40%); anchors are 2 × D; totals 7 shared / 16 neither | `corrected_experiment_report.md` is generated from `results.json`. `validate_outputs.py` checks every table row against it (17 rows, PASS). |
| C9 | Inconsistent cluster counts (M): `evaluation_results_report.md` gives Category D 4, distance 13, cross-language 11, total 38. The audit's statistics CSV gives the pooled M as 33. | Distinct origin commits in the per-case data: Category D 3 (0048 and 0050 share `b62c3f1`), distance 12, cross-language 10 (PY-001 and PY-002 share `2ba9c1e`), total 33. The audit's own `cluster_id` column also gives 33. | Clusters recomputed per group from origin commits |
| C10 (D10) | Horizon "decay" 60 / 33.3 / 0 % (`research/evaluation_results_report.md`) and 60 / 30 / 0 % (Antigravity) | Not derivable from any band of the per-case data | Replaced by the reachability groups, excluding rejected cases: in window, B2 S@10 81.8% (9/11); outside window, 0% (0/17). Stated as a reachability cut-off, not a decay curve. |
| C11 | Method descriptions: B1 described as "BM25/TF-IDF" in some reports | `StructuralRetriever.js` uses a weighted feature score | `results.json → methods` uses the code-accurate labels |
| C12 (D11) | Two different primary ΔMRR uncertainty statements (research bootstrap CI vs audit permutation) | — | Exact sign-flip test recomputed: ΔMRR 0.1759, p = 0.5625 (plain) or 0.5758 ((c+1)/(2^M+1), equal to the audit's); ΔS@10 0.20, p = 1.0. Bootstrap CIs are not reported. |

## B. Documented, not corrected (outside reporting scope, or would change design or evidence)

| # | Item | Why not corrected | What would resolve it |
|---|---|---|---|
| B1 (D3) | `src/evaluation/RetrospectEvaluator.js:216-242` and `scratch/evaluate_snapshot_worker.js:191-204` still compute Stage A with `rev-list --count` | This task forbids changing evaluation or retrieval code | A separate, test-covered fix to use the topological position from the same `git log` call |
| B2 (D7) | No valid negative or abstention test set | Constructing one is new data collection | Out of scope; drop the abstention research question (EQ3) from the paper or defer it |
| B3 (D8) | True origin commits of PY-003, PY-004, JS-001, JS-002 and TS-001–TS-004 unknown | Inventing or repairing SHAs is forbidden | The pilot's authors or event files must supply verifiable SHAs; otherwise the cases stay ineligible |
| B4 | No case is human-adjudicated; Category B "verified" is an automated audit status | Requires a human | Owner adjudicates the 5 primary cases plus 0019 and 0020 |
| B5 | 29 templated queries embed the historical name and the enclosing class name (a structural cue) | Changing queries changes the experiment | Report as a construct-validity threat |
| B6 | The run is not reproducible from a git commit (uncommitted code; fingerprints only) | Committing is forbidden in this task | Owner commits the working tree; fingerprints in `reproducibility_manifest.txt` still match |
| B7 (D9) | `research/reproducibility_record.md` pin table: 9/11 SHAs do not exist in the clones | Original file preserved | The correct pins per case are in `per_case_results_corrected.csv` (`pin_sha`, `pin_exists_in_clone` = True for all 45) |
| B8 | `research/*.csv/json/md` and `scratch/generate_research_deliverables.js` still contain the defects above | Must not be overwritten | Treat them as superseded by this folder; do not rerun that generator (it overwrites `research/`) |
| B9 | B2's top-1 candidate was not stored, so "incorrect historical candidate" is unmeasurable | Needs a rerun with logging | Optional future B2-only rerun on worktrees |
| B10 (D14) | Engineering-diagnostic narrative ranks disagree with its CSV for DIAG-01/02 | Separate experiment, not in this census | Unresolved |
| B11 | Oct 19 vs Oct 20 per-case differences (e.g. 0049 B2 abstained → rank 4) | No ablation exists | Unresolved; attribute only to "code changes between runs" |
| B12 | README Phase B "0% FP" and "RRF superior" claims | Original docs not edited in this task | Mark as superseded when the README is next updated |

## C. Not reproduced (no measured source found)

- MRR 0.4079 / 0.4285 (appear only in the earlier Antigravity hand-off).
- "B1 and B4 both 60% Success@10" (narrative error in `reports/RETROSPECT_EXPERIMENTAL_RESULTS.md` §7; its own table says B4 40%).
- Median latencies B1 599.5 ms / B2 114.5 / B3 816.5 / B4 838.5.

## D. Values confirmed as reproducible from the documented inputs

- **All 45 × 4 per-case ranks:** audit CSV = raw run CSV (builder check PASS).
- **Original-cohort S@10 and MRR in the audit's `corrected_results.csv`:** recomputed exactly, within rounding (builder check PASS). This includes the pooled 57.8 / 22.2 / 55.6 / 44.4 % Success@10.
- **Audit `rev_list_distance` and `topo_log_position`:** remeasured from git and identical.
- **Audit primary permutation p-values** (0.5758 MRR, 1.0 S@10): recomputed and identical.
