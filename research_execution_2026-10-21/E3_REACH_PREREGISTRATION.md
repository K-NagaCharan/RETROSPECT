# E3-Reach — pre-registration and ground-truth decision record (2026-10-21)

**Status:** fixed **before** E3-Reach runs. No H = 400 result had been produced or seen when this was written. The machine-readable case sets are in `e3_reach_case_sets.json`; the analysis must use that file unchanged.

## 1. Research question

When the evolution commit of a renamed or refactored Java method is **reachable**, does history-aware retrieval (B4, RRF fusion) rank the current successor better than structural retrieval alone (B1)?

## 2. Fixed configuration

| Item | Setting |
|---|---|
| Dataset | `Test creation\results\category_b_benchmark_repair_2026-10-19\category_b_repaired.json` (SHA-256 `acb2e388…`), the 29 Category B Java cases |
| Pins | As recorded per case (checkstyle `10a3a07`, graphhopper `c7497d1`, undertow `cf3abec`, java-driver `f424026`) |
| Configurations | Existing B1, B2, B3 (linear 0.6/0.4), B4 (RRF k = 60, 0.5/0.5), unchanged. **Only the history window changes: H = 400.** |
| Why H = 400 | The deepest primary origin is at topological position 395 (0028). Every primary origin therefore lies inside the window and before its final position, which is never diffed. |
| Code | Current working tree, identified by SHA-256 in the run manifest. Retrieval code, ranking and parameters are frozen; no tuning. |
| Tooling | `scratch/run_java_case_study.js --horizon 400` (no cache) on the isolated clones in `D:/clones_eval_2026-10-22`, writing to a **new** folder `research_execution_2026-10-21/E3_reach/` |
| Run scope | All 29 cases are run; the sets below are selected at analysis time. |
| Validity check | B1 does not depend on H. **If any B1 rank differs from the reproduced H = 50 ranks, the run is invalid.** |

## 3. Estimands and analyses

Clusters are origin commits. The unit of inference is the cluster mean of the per-case difference.

| Analysis | Cases / clusters | Role |
|---|---|---|
| **Primary** | **18 / 13**: 0013, 0049, 0044, 0045, 0046, 0047, 0105, 0101, 0096, 0097, 0099, 0055, 0058, 0078, 0043, 0001, 0028, 0029 | Confirmatory test |
| Strict-rename sensitivity | 9 / 5: 0013, 0049, 0044, 0045, 0096, 0097, 0099, 0055, 0058 | Descriptive only: the minimum attainable p with 5 clusters is 0.0625 |
| Leave-one-out sensitivity on flagged cases | without 0047: 17/12; without 0046: 17/13; without 0043: 17/12; without all three: 15/11 | Robustness |
| Previously in window / outside window at H = 50 | 8/6 and 10/7 | Separates the effect of reachability from the cost of a larger window |
| Reported separately (not in any test) | Specialization 0039 (1/1); split 0005 (1/1); framework migration 0035/0036/0038 (3/1) | Descriptive |
| Excluded | Query leak 0019, 0020; rejected by the existing audit rule 0031, 0034, 0048, 0050 | — |

**Primary statistic:** mean over the 13 clusters of (MRR_B4 − MRR_B1), with an exact two-sided sign-flip test over 2¹³ sign assignments. The minimum attainable p is 0.00024.

**Secondary measures (same clusters, descriptive):**
- B2 − B1 ΔMRR;
- Recall@1/5/10 for B1–B4;
- rescues (B2 ≤ 10 and B1 > 10 or unranked);
- fusion rescues and harms (B4 vs B1 top-10);
- for the 8 previously in-window cases, the change in B2/B4 ranks between H = 50 and H = 400 (the window-noise cost).

## 4. Decision criteria (fixed now)

| Outcome | Criterion (primary analysis) |
|---|---|
| **Success** | ΔMRR > 0 **and** p < 0.05 **and** fusion harms ≤ fusion rescues |
| **Failure** | ΔMRR ≤ 0 **or** fusion harms > fusion rescues |
| **Inconclusive** | ΔMRR > 0, p ≥ 0.05, harms ≤ rescues |
| **Invalid** | Any B1 rank differs from the H = 50 reproduction; or any worker fails |

**Decision each outcome enables:**
- **Success:** build the held-out Python/JavaScript/TypeScript evaluation set (at least 6 independent evolution commits per language) and test the four-language claim.
- **Failure:** do not invest in non-Java data; scope the paper as a limited or negative result.
- **Inconclusive:** the existing Java data is exhausted; decide the paper scope on the effect size, with the uncertainty stated.

## 5. Ground-truth decision record (owner decisions, 2026-10-21)

**Java cases inside the window.** Recorded in `research_corrected_2026-10-21/ground_truth_adjudication.csv` (11 rows; adjudicator = project owner).

| Case | Decision |
|---|---|
| 0013, 0049, 0044, 0045 | Accept |
| 0047 | Accept `sendInternal` (template-method split; sensitivity flag) |
| 0105 | Accept (generalized successor) |
| 0101 | Accept (signature and semantics changed) |
| 0019, 0020 | Successor valid; query N; excluded from the primary estimand and from rescue claims |
| 0005 | Excluded from strict rename analysis (split); preserved for split analysis |
| 0046 | Accept `processFrameData` (competing inherited `updateFrameDataRemaining`; sensitivity flag; not a second target) |

**Java cases outside the window.** These were **not individually adjudicated by a human**. They are classified by the owner-approved, pre-declared rule using the **automated Category B audit plus read-only diff checks** (2026-10-21). The checks covered:
- one old declaration removed and one new declaration added in the target class;
- the old name absent from the target class at the pin;
- the query class existing before the commit;
- the query containing no new name.

| Class | Cases | Decision |
|---|---|---|
| Strict rename | 0096, 0097, 0099, 0055, 0058 | Primary + strict sensitivity |
| Signature change | 0078, 0001 | Primary |
| Template split | 0043 (accept `flushQueuedData`; sensitivity flag) | Primary |
| Transformation | 0028, 0029 | Primary; excluded from strict sensitivity |
| Specialization | 0039: the old body delegated to `instance.setSlowQueryLatencyThresholdMillis(...)`; the new body stores the value and sets a `constantThreshold` mode flag. The implementation was **not** carried forward. | Reported separately |
| Framework migration | 0035, 0036, 0038 (Netty 3 → 4) | Separate migration category |

**Phase B decisions.** These are recorded here; the Phase B data files in `data/` were **not** modified, and the decisions don't affect E3-Reach.
- **py_bot_01:** retarget to `Route.get_callback_args`, because that is what the labelled commit `750fcbe` and both query versions describe. The original target `Route.get_undecorated_callback` was **never validated** and must not be cited as a rescue. Its new ranks are unmeasured.
- **ts_zod_04:** policy — any commit in the verified add/revert/re-apply chain (`d6bc1e3`, `ca0229a`, `cc4cd4e`; the function body is byte-identical) counts as correct lineage. Under this policy the E-Lineage TypeScript result becomes 3/3.
- **ts_zod_08:** the factory `$ZodArray` (line 1882) is the sole target. `capSize` is not added, because the benchmark specifies a single target.

## 6. Threats to state with any result

- Category B is not pristine held-out data: some cases appeared in earlier diagnostics.
- Queries are templated and include the class name.
- The outside-window classification is automated plus diff-based, not human-adjudicated.
- A larger window adds commit-message noise; this is part of what is measured and must not be tuned.
- The evaluated code is uncommitted and identified only by hashes unless the owner commits before running.
