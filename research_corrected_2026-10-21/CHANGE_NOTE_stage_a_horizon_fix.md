# Change note — Stage A horizon labelling fix (2026-10-21)

**Scope.** This changes the reachability label only. Retrieval, ranking, scoring, fusion, matching, query processing, candidate selection, the horizon (H = 50) and its ordering are unchanged. No experiment was rerun, and no dataset, result or report was modified. The corrected-reporting outputs in this folder were not regenerated.

## Bug and cause

Historical retrieval reads exactly the commits listed by:

```
git -c core.longpaths=true log --format=%H --topo-order -n 50 <rev-parse(pin)>
```

That is `HistoricalRetrievalAdapter.indexRepositoryHistory` → `GitHistoryReader.getCommitHistory`, in merge-aware mode (`firstParentOnly: false`), with hashes deduplicated.

Stage A did not use that list:

- `RetrospectEvaluator.evaluateStageA` labelled horizon status with `git rev-list --count origin..pin` ≤ 50.
- `scratch/evaluate_snapshot_worker.js` used `commit_distance_k`, which the runner also computes with `rev-list --count`.

`rev-list --count` counts every commit on every merged branch. In topological order a merged branch is listed before the mainline, so an origin can sit inside the 50-commit window while its rev-list distance is above 50. In the audit:

| Case | rev-list distance | Window position | Old label |
|---|---:|---:|---|
| 0101 | 62 | 35 | `OUTSIDE_SEARCH_HORIZON` |
| 0044–0046 | 52 | 34 | `OUTSIDE_SEARCH_HORIZON` |

Their B2 ranks of 3–6 contradicted the label.

## Files changed

| File | Change |
|---|---|
| `src/git/historyWindow.js` (new) | `buildHistoryWindowLogArgs`, the single definition of the window's `git log` arguments; `getHistoryWindowSync`; `classifyOriginInWindow`; `stageAStatusFromWindow` |
| `src/git/GitHistoryReader.js` | `getCommitHistory` now builds its arguments with `buildHistoryWindowLogArgs`. The arguments are identical to before (asserted by a test); there is no behaviour change. This lets retrieval and labelling share one definition. |
| `src/evaluation/RetrospectEvaluator.js` | `evaluateStageA` classifies the origin against the retrieval window when a repository path is available. Adds output fields. |
| `scratch/evaluate_snapshot_worker.js` | Stage A uses the same classifier for the snapshot's `pinSha` and `searchHorizon`. Adds output fields. Ranking code is untouched. |
| `tests/unit/history_window.test.js` (new) | 14 regression tests on temporary Git repositories |

## Corrected horizon definition

The checks below run in this order. The first one that applies decides the status.

| Condition | `reachability_status` | `origin_within_budget` |
|---|---|---|
| No origin | `NO_ORIGIN_SPECIFIED` (worker: `STRUCTURAL_PILOT_NO_ORIGIN`, unchanged) | false |
| Pin cannot be resolved | **`REACHABILITY_UNVERIFIABLE`** (new) | false |
| Origin commit does not exist | `NOT_IN_DAG` | false |
| Origin exists but is not an ancestor of the pin | **`NOT_ANCESTOR_OF_PIN`** (new; previously misjudged by rev-list) | false |
| Ancestor, not among the window's commits | `OUTSIDE_SEARCH_HORIZON` (meaning changed: "not read by retrieval", no longer "rev-list > 50") | false |
| In the window, but retrieval does not diff it (the last listed commit, a root commit, or a merge commit in merge-aware mode) | **`IN_WINDOW_DIFF_NOT_ANALYZED`** (new) | true |
| In the window and diffed, but no evidence extracted | `NO_HISTORICAL_EVIDENCE` | true |
| In the window, diffed, evidence extracted | `REACHABLE` | true |

**What changed in the output fields:**

- `commit_distance` stays the rev-list distance, as information only.
- New fields: `origin_is_ancestor`, `history_window_position` (1-based) and `origin_diff_analyzed` (in both the evaluator and the worker), plus `horizon_basis` (evaluator only).
- Short origin SHAs are now resolved; before, a non-40-hex origin was labelled `NOT_IN_DAG` even when it existed.
- **Compatibility path:** when `evaluateStageA` is called without a repository path (unit-test or simulated mode), the window cannot be computed. The old supplied-distance rule is kept and marked `horizon_basis: 'supplied_distance_no_repository'`. `evaluateCase` always passes the snapshot path, so real evaluations never take this path.

## Regression tests

`tests/unit/history_window.test.js` builds two temporary repositories:

- a linear one with 55 commits plus an unmerged branch;
- a merge fixture with the origin on a short merged branch and 48 mainline commits after the fork.

| # | Case | Asserted result |
|---|---|---|
| — | Window args equal the old `GitHistoryReader` args (three option combinations) | equal |
| — | Labelling window equals `getCommitHistory()` hashes on the merge fixture | equal, length 50 |
| 1 + 7 | Origin = pin | position 1, rev-list 0, `REACHABLE` |
| 1 | Origin at position 2 | `REACHABLE` |
| 2 | Origin at position 50 | in window, not diffed → `IN_WINDOW_DIFF_NOT_ANALYZED` |
| 3 | Origin at rev-list 50, first commit outside the window | `OUTSIDE_SEARCH_HORIZON` |
| 4 | rev-list > 50 (asserted as a precondition) but position ≤ 50 | `REACHABLE` |
| 4b | Same, with a supplied distance of 62 | `REACHABLE`; the supplied distance no longer overrides |
| 4c | Mainline ancestor pushed past position 50 by the merged branch | `OUTSIDE_SEARCH_HORIZON` |
| 5 | Missing origin | `NOT_IN_DAG`, never outside-horizon |
| 6 | Origin on an unmerged branch | `NOT_ANCESTOR_OF_PIN`, never outside-horizon |
| 8 | Merge commit as origin | in window, not diffed → `IN_WINDOW_DIFF_NOT_ANALYZED` |
| — | Unresolvable pin | `REACHABILITY_UNVERIFIABLE` |
| — | In window, no evidence | `NO_HISTORICAL_EVIDENCE` |

## Commands run and results

```bash
npx jest --runInBand tests/unit/history_window.test.js tests/unit/git_history_reader.test.js tests/evaluation/new_evaluator.test.js tests/unit/historical_retrieval_adapter.test.js tests/integration/history_tracking.test.js
```

Result: 5 suites, 71 tests, all passed (14 of them new). These suites write only to OS temp directories. `npm test` was not run, because `tests/unit/author_pack_blinding.test.js` rewrites 20 tracked Phase C files.

A read-only check against `D:\clones` ran `classifyOriginInWindow` only (`rev-parse`, `merge-base`, `rev-list`, `log`; nothing was checked out):

| Case | Status | Position | rev-list | Diffed |
|---|---|---:|---:|---|
| 0101 | IN_WINDOW | 35 | 62 | true |
| 0044 | IN_WINDOW | 34 | 52 | true |
| 0096 | OUTSIDE_WINDOW | — | 64 | — |

This agrees with the audit's reconciled labels and with `per_case_results_corrected.csv`.

**Git status:** the only new entries are `?? src/git/historyWindow.js` and `?? tests/unit/history_window.test.js`. The other edited files were already modified or untracked. The Phase C file timestamps are unchanged (18:30:41). `validate_outputs.py` in this folder still passes, and the clones are clean on their branches.

## Remaining limitations (separate tasks)

1. **The window's last commit is never diffed.** `indexRepositoryHistory` loops `i < commits.length - 1`, so the commit at position 50 of a full window is read but never diffed: effectively 49 commits are analysed. This is now reported (`IN_WINDOW_DIFF_NOT_ANALYZED`), not fixed, because fixing it would change retrieval behaviour. No audited case sits at position 50 (the maximum is 48).
2. **The old labels remain in the stored outputs.** The 2026-10-20 results files still carry the old rev-list labels. They were not regenerated. The corrected per-case labels are in `per_case_results_corrected.csv`.
3. **The runner still computes `commit_distance_k` with rev-list.** `scratch/run_full_multirepo_evaluation.js` does this (now informational only), and its summary tables key on `stage_a_status`, which will use the new labels on any future run.
4. **There was no mutation test of the old code.** `RetrospectEvaluator.js` is untracked, so no prior version exists in git. Test 4 instead asserts the precondition that rev-list > 50, under which the old rule necessarily returned `OUTSIDE_SEARCH_HORIZON`.
