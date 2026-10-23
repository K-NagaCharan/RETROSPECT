# Corrected Experiment Report — Retrospect 45-case census (run of 2026-10-20)

Generated 2026-10-21T14:35:42+00:00 by `build_corrected_reporting.py`. All numbers are **recomputed** from the measured per-case ranks of the 2026-10-20 run. **No retrieval was rerun.** Reachability fields were **newly measured** with read-only git commands. This report corrects reporting defects; it does not establish that the experiment is scientifically valid.

## Configuration (copied from the run's `experiment_config.json`)

- **B1**: B1 Structural only (StructuralRetriever)
- **B2**: B2 Historical only (HistoricalRetrievalAdapter, merge-aware --topo-order, H=50)
- **B3**: B3 Linear fusion 0.60*S + 0.40*H (HistoricalRetrievalAdapter.fuseScores)
- **B4**: B4 RRF-v2 k=60, wS=0.50, wH=0.50, zero-signal gating (fuseRRFv2)
- Search horizon H = 50 commits of `git log --topo-order -n 50 <pin>`; merge commits' composite diffs skipped.
- Target = the current successor symbol; rank among all indexed symbols at the pin; unranked = miss / reciprocal rank 0.

## Results by evaluation role (headline grouping)

Roles are assigned by documented criteria (see README). Roles marked ineligible are shown for transparency only.

| Group | N | Clusters | B1 S@10 % | B2 S@10 % | B3 S@10 % | B4 S@10 % | B1 MRR | B2 MRR | B3 MRR | B4 MRR | Rescue / Harm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `primary_verified_rename_in_window` | 5 | 5 | 60.0 | 60.0 | 80.0 | 80.0 | 0.1893 | 0.2186 | 0.3213 | 0.3652 | 2 / 1 |
| `needs_review_reachable` | 6 | 3 | 83.3 | 100.0 | 100.0 | 100.0 | 0.1228 | 0.3944 | 0.5417 | 0.4321 | 1 / 0 |
| `needs_review_unreachable` | 14 | 9 | 57.1 | 0.0 | 42.9 | 14.3 | 0.2083 | 0.0000 | 0.1167 | 0.0625 | 0 / 6 |
| `rejected_ground_truth` (INELIGIBLE) | 4 | 3 | 25.0 | 0.0 | 25.0 | 25.0 | 0.0566 | 0.0018 | 0.0368 | 0.0441 | 0 / 0 |
| `current_code_control` | 3 | 3 | 66.7 | 33.3 | 66.7 | 66.7 | 0.5025 | 0.1667 | 0.5021 | 0.5012 | 0 / 0 |
| `anchor_origin_is_pin` | 2 | 2 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0072 | 0.0000 | 0.0050 | 0.0039 | 0 / 0 |
| `cross_language_origin_verified` | 3 | 2 | 66.7 | 0.0 | 66.7 | 33.3 | 0.2545 | 0.0000 | 0.0883 | 0.0930 | 0 / 1 |
| `cross_language_origin_missing` (INELIGIBLE) | 8 | 8 | 62.5 | 0.0 | 50.0 | 50.0 | 0.2389 | 0.0096 | 0.1747 | 0.1282 | 0 / 1 |

## Historical rescue (outcome A: B2 ≤ 10 and B1 > 10 or unranked)

| Case | Role | Repo | Reachability | rev-list k / topo pos | B1 | B2 | B3 | B4 | Stage B |
|---|---|---|---|---|---:|---:|---:|---:|---|
| CASE-HIST-JAVA-0019 | needs_review_reachable | checkstyle/checkstyle | IN_TOPO50_WINDOW | 36 / 37 | 27 | 3 | 3 | 5 | RENAMED_SYMBOL |
| CASE-HIST-JAVA-0013 | primary_verified_rename_in_window | checkstyle/checkstyle | IN_TOPO50_WINDOW | 36 / 37 | — | 2 | 2 | 8 | RENAMED_SYMBOL |
| CASE-HIST-JAVA-0049 | primary_verified_rename_in_window | undertow-io/undertow | IN_TOPO50_WINDOW | 23 / 22 | 14 | 4 | 4 | 1 | RENAMED_SYMBOL |

3 cases; languages: Java; reachability: IN_TOPO50_WINDOW; distinct origin commits: 2; in the primary role: 2. All are Category B rename cases; none is human-adjudicated.

## Primary role: B4 vs B1, exact sign-flip permutation test (recomputed)

| Metric | M | Observed mean Δ (B4−B1) | p exact | p (count+1)/(2^M+1) | Audit-reported p | Min attainable p |
|---|---:|---:|---:|---:|---:|---:|
| MRR | 5 | 0.1759 | 0.5625 | 0.5758 | 0.5758 | 0.0606 |
| Success@10 | 5 | 0.2 | 1.0 | 1.0 | 1.0 | 0.0606 |

No result in this report is statistically significant. With M = 5 clusters, significance at α = 0.05 is unattainable.

## Reachability (reference grouping, rejected cases excluded)

| Group | N | Clusters | B1 S@10 % | B2 S@10 % | B3 S@10 % | B4 S@10 % | B1 MRR | B2 MRR | B3 MRR | B4 MRR | Rescue / Harm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `reachability_IN_TOPO50_WINDOW_excl_rejected` | 11 | 7 | 72.7 | 81.8 | 90.9 | 90.9 | 0.1530 | 0.3145 | 0.4415 | 0.4017 | 3 / 1 |
| `reachability_NOT_IN_TOPO50_WINDOW_excl_rejected` | 17 | 11 | 58.8 | 0.0 | 47.1 | 17.6 | 0.2164 | 0.0000 | 0.1117 | 0.0679 | 0 / 7 |

Historical success outside the window is 0 by construction (the origin commit is never read). This is a reachability cut-off, not a measured decay curve.

## Reconciliation with prior outputs

Original cohort labels, recomputed (should equal the audit's `corrected_results.csv`; see validation checks):

| Group | N | Clusters | B1 S@10 % | B2 S@10 % | B3 S@10 % | B4 S@10 % | B1 MRR | B2 MRR | B3 MRR | B4 MRR | Rescue / Harm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `in_policy_primary` | 5 | 5 | 60.0 | 60.0 | 80.0 | 80.0 | 0.1893 | 0.2186 | 0.3213 | 0.3652 | 2 / 1 |
| `verified_structural_pilot` | 3 | 3 | 66.7 | 33.3 | 66.7 | 66.7 | 0.5025 | 0.1667 | 0.5021 | 0.5012 | 0 / 0 |
| `quarantined_negative` | 4 | 3 | 25.0 | 0.0 | 25.0 | 25.0 | 0.0566 | 0.0018 | 0.0368 | 0.0441 | 0 / 0 |
| `distance_stratified_diagnostic` | 20 | 12 | 65.0 | 30.0 | 60.0 | 40.0 | 0.1826 | 0.1183 | 0.2442 | 0.1734 | 1 / 6 |
| `cross_language_exploratory` | 11 | 10 | 63.6 | 0.0 | 54.5 | 45.5 | 0.2431 | 0.0070 | 0.1512 | 0.1186 | 0 / 2 |
| `verified_historical_pilot` | 2 | 2 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0072 | 0.0000 | 0.0050 | 0.0039 | 0 / 0 |
| `all_45_evaluated_reference_only` | 45 | 33 | 57.8 | 22.2 | 55.6 | 44.4 | 0.2005 | 0.0899 | 0.2181 | 0.1841 | 3 / 9 |

Validation checks performed by the builder:

- PASS: audit per-case ranks == raw run per-case ranks (all 4 methods)
- PASS: measured rev-list distance and topo position == audit case_reconciliation.csv values (where audit defines them)
- PASS: recomputed original-cohort S@10 and MRR == audit corrected_results.csv (tolerance 0.01 pct-pt, 0.00011 MRR)

## Excluded before evaluation

- CASE-HIST-JS-004 (lodash/lodash): exclusion copied from audit case_reconciliation.csv: Pinned commit f299b52ff3 absent from local git clone DAG

## Claims this report does NOT support

- General superiority of fusion or history over structural retrieval (pooled B4 < B1; harms exceed rescues).
- Safe abstention on negatives: there is no valid negative set; the former "Category D" cases are rejected ground truth.
- Cross-language historical rescue: 8 of 11 cross-language cases cite origin commits absent from the clones; the 3 verified ones lie outside the window.
- Any statistical significance.
- Recovery of predecessor implementations: only current successors are ranked.
