# Finalization Plan — Retrospect paper (2026-10-21)

**Labels used:** **[V]** verified in this workspace · **[R]** reported by an existing artifact, not re-checked · **[U]** unresolved · **[P]** proposed action.

**Recommendation:** proceed with a **narrow Java method-rename case study** built on the 29 Category B cases. Drop cross-language, abstention and "current-code safety" claims from the paper.

**Rephrased research question.** Retrospect ranks *current* symbols. It never returns historical implementations **[V]**. The research question must therefore read:

> Given a query phrased with a method's pre-rename vocabulary, does Git-history retrieval rank the method's **current successor** where structural retrieval misses it or ranks it poorly?

---

## A. Which existing results can legitimately be reported?

All of the results below come from a single run on uncommitted code. They are reportable as **preliminary**, and must be labelled as such until step G4 reproduces them.

| Result | Status | Source |
|---|---|---|
| Per-case B1–B4 ranks for the 29 Category B Java cases | **[V]** measured; audit ranks = raw run ranks (builder check) | `per_case_results_corrected.csv` |
| Rescue cases where B2 is in the top-10 and B1 is not | **[V]** 3 cases: 0013 (B1 —, B2 2, B4 8), 0049 (14, 4, 1), 0019 (27, 3, 5); 2 distinct origin commits | same |
| Primary role (5 audit-verified renames): S@10 B1 60% / B2 60% / B3 80% / B4 80%; MRR 0.1893 / 0.2186 / 0.3213 / 0.3652; fusion 2 rescues, 1 harm | **[V]** recomputed | `results_by_group.csv` |
| B4 − B1 on the primary role: ΔMRR +0.176, exact sign-flip p = 0.56; ΔS@10 +0.20, p = 1.0. **Not significant.** | **[V]** recomputed | `results.json` |
| Reachability cut-off, rejected cases excluded: in window, B2 S@10 9/11; outside window, 0/17; fusion harm 7 of 17 outside | **[V]** | `results_by_group.csv` |
| Window membership of every case (rev-list count and topological position) | **[V]** measured with git; agrees with the audit | `per_case_results_corrected.csv` |

**Not reportable:**

- **Cross-language results:** 8 of 11 origin commits are missing **[V]**.
- **"Category D" as negatives:** these are rejected ground truth **[V]**.
- **Phase B "0% false positives":** a threshold artefact **[R]**.
- **Pooled 45-case means as headline numbers.**
- **"Current-code safety":** N = 3 controls is too few.
- **Any statistical significance.**

## B. Which cases need manual ground-truth verification, and why?

No case has been human-adjudicated **[V]**. The Category B "verified / needs_review / rejected" status comes from an automated audit **[R]** (`Test creation\audits\category_b_java_audit_2026-10-19\case_audit_results.csv`).

| Priority | Cases | Why |
|---|---|---|
| **Must** (they carry every rescue claim) | 0013, 0049, 0005, 0047, 0105 (primary); 0019, 0020, 0101, 0044, 0045, 0046 (needs_review, origin inside the window) | These 11 in-window cases are the only ones where history can contribute. For each, confirm: (1) the target is the true successor of the old method in the origin commit's diff; (2) the query is realistic and does not leak the target. 0019 and 0020 use the post-rename class name (`Violation`) **[R]**, and 0019's query contains the target token. 0101 and 0044–0046 are rated "complex / signature change" **[R]**. |
| Should | 0035, 0036, 0038 | Netty 3 → 4 framework migration, not an internal rename **[R]**. Decide whether to keep them as "rename" cases. They are outside the window, so they affect B1 numbers and fusion-harm counts only. |
| Already decided | 0031, 0034, 0048, 0050 | Rejected with documented reasons (`quarantine_manifest.json`) **[R]**. Report them as excluded; do not evaluate them as positives or negatives. |
| Not needed | The other 11 outside-window cases | They serve only as reachability failures; the git facts are mechanically verified **[V]**. |

**Output of verification [P]:** a new file `research_corrected_2026-10-21/ground_truth_adjudication.csv` with columns `case_id, target_is_successor (Y/N/unsure), query_acceptable (Y/N), note, adjudicator, date`. The owner fills it in; Claude must not.

## C. Can the current code and configuration run one reproducible final evaluation?

**Not yet. There are three essential blockers. Each has a small fix, and none needs an algorithm change.**

1. **No source revision.** **[V]** The evaluation code is uncommitted: `RRFv2.js`, `RetrospectEvaluator.js`, the worker, and the modified `GitHistoryReader.js`, `HistoricalRetrievalAdapter.js` and `QueryProcessor.js`. Since the 2026-10-20 run, the files the run used have changed in two places:
   - `GitHistoryReader.js`: the argument builder was extracted (identical arguments, asserted by a test);
   - `scratch/evaluate_snapshot_worker.js`: the Stage A label (labels only).

   **Minimum action [P]:** the owner commits the working tree on `eval-reframing-empirical-study`. This is the owner's decision; Claude does not commit without explicit instruction.
2. **The existing runner is unsafe to rerun.** **[V]** `scratch/run_full_multirepo_evaluation.js`:
   - writes into the original results folder `…\final_multirepo_evaluation_merge_aware_2026-10-20` (line 8), so it would overwrite results;
   - returns cached ranks from `scratch/snapshot_cache/*.json` when present (line 528), so it would not actually rerun;
   - hard-codes the cohorts and the invalid pilot cases.

   The worker runs `git checkout --detach <pin>` in whatever repository it is given (worker line 58), and running it against `D:\clones` would change their checked-out state.

   **Minimum action [P]:** write one small new driver, `scratch/run_java_case_study.js`. It should:
   - build the worker's input from `category_b_repaired.json`, using the same case shape as runner lines 243–275;
   - call `scratch/evaluate_snapshot_worker.js` directly, with no cache;
   - use **isolated local clones**;
   - write to a **new** output folder.
3. **Two harnesses exist.** **[V]** The measured results came from `evaluate_snapshot_worker.js`, not `src/evaluation/RetrospectEvaluator.js`. The two have separate but near-identical target-matching functions. **Decision [P]:** the paper's evaluation uses the worker path, because it produced the existing measurements and can be checked for exact rank reproduction. `RetrospectEvaluator` is not used for paper numbers.

**Not blocking:** the configuration is unambiguous **[V]**:

- H = 50, merge-aware `--topo-order`;
- B3 = 0.60 S + 0.40 H;
- B4 = RRF k = 60, weights 0.5 / 0.5;
- all 29 pins and origins exist in `D:\clones`.

## D. Minimum experiment for the narrowed research question

**E1 — Reproduction run (the only required experiment).**

- **Inputs:** B1–B4 on all 29 Category B Java cases. There are 4 snapshots: checkstyle `10a3a07`, graphhopper `c7497d1`, undertow `cf3abec`, java-driver `f424026`.
- **Configuration:** H = 50, exactly as above.
- **Purpose:** reproduce the 2026-10-20 measurements from a committed revision. **Success criterion: every rank identical to `per_case_results_corrected.csv`.** If any rank differs, stop and report it; do not choose between the two runs.
- **Reporting:** results reported by role. The primary claim uses the 11 in-window cases that pass section B's adjudication, with 7 origin-commit clusters if all pass. The 14 outside-window cases are the reachability and fusion-harm analysis. The 4 rejected cases are listed as excluded.

**E2 — Optional, B2-only depth check.** Add it only if the paper wants to claim that reachability, not matching, limits rescue.

- **Cases:** the 7 clean renames outside the window flagged by the Category B audit [R]: 0096, 0097, 0099, 0055, 0058, 0078, 0039.
- **Settings:** H = 100 and H = 700.
- **Rule:** a separate output folder, clearly labelled as a different configuration.
- **Skip it** if the paper reports the cut-off descriptively.

**Out of scope:** cross-language cases, new cases, the 3 current-code controls, the Phase D repositories, and the fix for the window's last commit never being diffed (no case sits at position 50 **[V]**).

## E. Exact commands and input files

Commands marked **[P]** are proposed; none has been run. The driver in E-3 does not exist yet.

**Input files:**
- `D:\base papers considered\Test creation\results\category_b_benchmark_repair_2026-10-19\category_b_repaired.json` (SHA-256 `acb2e388…`)
- `research_corrected_2026-10-21\per_case_results_corrected.csv` (reference ranks)
- `quarantine_manifest.json` (exclusions)

**E-1. Commit the working tree.** Owner, after review.

**E-2. Isolated clones.** These are local hard-linked clones; `D:\clones` is not modified:

```bash
git clone --no-checkout D:/clones/checkstyle D:/clones_eval_2026-10-22/checkstyle
```

```bash
git clone --no-checkout D:/clones/graphhopper D:/clones_eval_2026-10-22/graphhopper
```

```bash
git clone --no-checkout D:/clones/undertow D:/clones_eval_2026-10-22/undertow
```

```bash
git clone --no-checkout D:/clones/datastax-java-driver D:/clones_eval_2026-10-22/datastax-java-driver
```

**E-3. Run the case study.** The driver calls the worker once per snapshot:

```bash
node scratch/run_java_case_study.js --dataset "D:/base papers considered/Test creation/results/category_b_benchmark_repair_2026-10-19/category_b_repaired.json" --clones D:/clones_eval_2026-10-22 --horizon 50 --out research_final_2026-10-22/E1_reproduction
```

**E-4. Check reproduction.** The comparison script is new and read-only:

```bash
python -I research_final_2026-10-22/compare_with_reference.py
```

It compares the E1 ranks with `per_case_results_corrected.csv` and must report 29 × 4 identical ranks.

**E-5. Final tables.** Re-point `build_corrected_reporting.py` (copied, not edited in place) at the E1 output and the adjudication CSV, write into `research_final_2026-10-22/`, then run `validate_outputs.py`.

**Safe tests only:**

```bash
npx jest --runInBand tests/unit/history_window.test.js tests/unit/git_history_reader.test.js tests/evaluation/new_evaluator.test.js tests/unit/historical_retrieval_adapter.test.js tests/integration/history_tracking.test.js
```

Never run `npm test`.

## F. Outputs and statistical analyses required for the paper

**1. Per-case table (29 rows).** Columns:
- case, repository, old name → new name;
- rev-list count and window position;
- adjudication result;
- B1–B4 ranks;
- outcome A/B/C/D;
- fusion rescue or harm.

**2. Group table.** For each of the adjudicated in-window cases, the 5 primary cases alone, the outside-window cases, and the excluded cases:
- N and number of clusters;
- Success@1, @5 and @10;
- MRR for B1–B4.

**3. Rescue analysis.** List the outcome-A cases, with the mechanism traced from stored Stage B fields (lineage matched or ambiguous). B2's top-1 candidate is not logged, so "wrong historical candidate" cannot be reported **[V]**; say so.

**4. Inference.**
- Use an exact two-sided cluster-level sign-flip test of B4 − B1 and B2 − B1 for MRR and Success@10. Clusters are origin commits, with each cluster's case deltas averaged.
- With 7 clusters the minimum attainable p is 0.0156; with 5, it is 0.0606.
- **Fix the test and metric before E1 runs** (pre-registration line in the E1 manifest).
- Report effect sizes with the per-cluster deltas. No bootstrap CIs on 5–7 clusters.

**5. Reachability figure.** B2 success in and outside the window (descriptive; outside the window is 0 by construction).

**6. Fusion-harm table.** Cases where B1 is in the top-10 but B4 is not, mostly outside the window (6 of 14 currently **[V]**). This supports "fuse only when history has evidence" as a limitation.

**7. Threats to validity:**
- templated queries containing the old name and the class name;
- a single automated audit plus the owner's adjudication;
- one researcher;
- 4 Java repositories, renames only;
- 5–7 clusters;
- the last window commit is never diffed;
- uncommitted code before E-1.

## G. Shortest task sequence to a paper draft ready for verification

| # | Task | Concerns | Who | Gate |
|---|---|---|---|---|
| G1 | Adjudicate the 11 in-window cases (and decide on 0035/0036/0038) | `ground_truth_adjudication.csv` (new) | **Owner** | Required before final tables |
| G2 | Commit the working tree on `eval-reframing-empirical-study` | git | **Owner decision** | Required before E1 |
| G3 | Write `scratch/run_java_case_study.js` (worker driver, no cache, new output folder) and `compare_with_reference.py`; dry-run on one snapshot | new files only | Claude | — |
| G4 | Create the isolated clones; run E1; compare with the reference ranks | `D:\clones_eval_2026-10-22`, `research_final_2026-10-22/E1_reproduction` | Claude, after G2 | All 116 ranks identical, or stop |
| G5 | Build the final tables and statistics (section F) from E1 plus G1 | `research_final_2026-10-22/` | Claude | Validator passes |
| G6 | Draft the paper: problem, method (actual implementation), dataset (29 cases, provenance, exclusions), setup, results (F1–F6), limitations, related work (CodeTracker FSE'22; Hasan et al., arXiv 2409.16185; RefactoringMiner; Cormack RRF) | `paper/draft.md` (new) | Claude | Every number traced to `research_final_2026-10-22/results.json` |
| G7 | Verification pass: a script cross-checks every number in the draft against `results.json` | `paper/verify_numbers.py` (new) | Claude | 0 mismatches |
| (opt) | E2 depth check | new folder | Claude | Only if the owner wants the reachability claim tested |

**Decisions needed from the owner:**
- G1 adjudication;
- G2 commit;
- approval to create `D:\clones_eval_2026-10-22` (about the size of 4 hard-linked clones);
- E2 yes or no.
