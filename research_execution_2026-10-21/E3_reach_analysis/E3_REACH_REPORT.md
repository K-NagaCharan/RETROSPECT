# E3-Reach — result (run 2026-10-21, analysed as pre-registered)

| Item | Value |
|---|---|
| Pre-registration | `../E3_REACH_PREREGISTRATION.md`; case sets `../e3_reach_case_sets.json` (SHA-256 `29cbfc0a3d6bdb5c…`, verified unchanged by the analysis script) |
| Run | `../E3_reach/`: `scratch/run_java_case_study.js --horizon 400`; 29 cases, 4 snapshots, no cache; isolated clones `D:/clones_eval_2026-10-22` |
| Code | Uncommitted working tree at HEAD `17ea399`, fingerprinted in `../E3_reach/run_manifest.json` |
| Analysis | `../E3_reach_analyze.py`, written before the results existed. Outputs: `e3_reach_results.json`, `e3_reach_per_case.csv` |

## Validity: VALID

- All 4 workers exited 0 (graphhopper 241 s, java-driver 161 s, checkstyle 270 s, undertow 223 s).
- `search_horizon` = 400.
- **All B1 ranks are identical to the reproduced H = 50 ranks.**
- The isolated clones were restored, clean, on their branches.

## Primary outcome: **INCONCLUSIVE**

| | Value |
|---|---|
| Set | 18 cases / **13 origin-commit clusters** |
| Cluster-mean ΔMRR (B4 − B1) | **+0.107** |
| Exact two-sided sign-flip test | **p = 0.066** (minimum attainable p = 0.00024) |
| Fusion rescues / harms (B4 vs B1, top 10) | 4 (0049, 0097, 0099, 0001) / 2 (0047, 0078) |
| Pre-registered rule | ΔMRR > 0, p ≥ 0.05, harms ≤ rescues → **INCONCLUSIVE** |

**Per-cluster deltas** (13 clusters): +0.077, +0.429, +0.139, −0.094, +0.083, +0.400, +0.159, +0.179, −0.292, −0.018, +0.159, 0.000, +0.167. That is 9 positive, 3 negative and 1 zero.

## All pre-registered analyses (H = 400)

| Analysis | N / clusters | B1 R@10 / MRR | B2 R@10 / MRR | B3 R@10 / MRR | B4 R@10 / MRR | ΔMRR B4−B1 (p) | ΔMRR B2−B1 (p) | B2 rescues / fusion rescues / fusion harms |
|---|---|---|---|---|---|---|---|---|
| **Primary** | 18 / 13 | 0.72 / 0.162 | 0.83 / 0.279 | 0.94 / 0.286 | 0.83 / 0.282 | **+0.107 (0.066)** | +0.115 (0.157) | 5 / 4 / 2 |
| Previously in window | 8 / 6 | 0.75 / 0.128 | 0.88 / 0.265 | 0.88 / 0.305 | 0.75 / 0.292 | +0.172 (0.125) | +0.159 (0.125) | 2 / 1 / 1 |
| Previously outside window | 10 / 7 | 0.70 / 0.190 | **0.80** / 0.291 | 1.00 / 0.271 | 0.90 / 0.275 | +0.051 (0.375) | +0.079 (0.578) | 3 / 3 / 1 |
| Strict renames (descriptive only) | 9 / 5 | 0.56 / 0.105 | 1.00 / 0.280 | 1.00 / 0.269 | 0.89 / 0.296 | +0.206 (0.0625 = the minimum attainable) | +0.207 (0.0625) | 4 / 3 / 0 |
| Without 0047 | 17 / 12 | 0.71 / 0.165 | 0.88 / 0.295 | 1.00 / 0.302 | 0.88 / 0.297 | +0.123 (0.043) | +0.135 (0.117) | 5 / 4 / 1 |
| Without 0046 | 17 / 13 | 0.71 / 0.166 | 0.82 / 0.286 | 0.94 / 0.293 | 0.82 / 0.291 | +0.111 (0.058) | +0.116 (0.154) | 5 / 4 / 2 |
| Without 0043 | 17 / 12 | 0.71 / 0.164 | 0.88 / 0.295 | 0.94 / 0.296 | 0.82 / 0.292 | +0.117 (0.061) | +0.137 (0.116) | 5 / 4 / 2 |
| Without all three flagged | 15 / 11 | 0.67 / 0.170 | 0.93 / 0.323 | 1.00 / 0.323 | 0.87 / 0.319 | +0.141 (0.039) | +0.160 (0.079) | 5 / 4 / 1 |

**On the sensitivity results.** Two of them cross p < 0.05: without 0047 (p = 0.043) and without all three flagged cases (p = 0.039). Under the pre-registration these are **robustness checks, not the primary test**, so they do not change the outcome. The primary is not significant, and the strict-rename set cannot reach significance with 5 clusters.

**Reported separately (not tested):**
- Specialization 0039: B1 = B2 = B4 = rank 1.
- Split 0005: B1 2, B4 13 (a fusion harm).
- Framework migration 0035/0036/0038: B2 top-10 for 2 of 3, where B1 found none.
- Query-leak exclusions 0019/0020: B2 ranks 3 and 1.

## Secondary observations

- **Reachability effect** (descriptive, *not pre-registered*). On the same 18 primary cases, going from H = 50 to H = 400 moved B2 Recall@10 from **0.39 to 0.83** and B4 Recall@10 from **0.50 to 0.83**. B1 was unchanged at 0.72. For the 10 previously unreachable cases, history now places the target in the top 10 in 8.
- **Window-noise cost.** For the 8 previously in-window cases, B2 ranks are unchanged except 0047 (147 → 166). B4 worsened slightly for 0013 (8 → 13; no longer a fusion rescue), 0049 (1 → 2) and 0105 (2 → 3).
- **B2 rescues** in the primary set: 0013, 0049, 0097, 0099, 0001. The last three were unreachable at H = 50.
- **B3 (linear fusion) has the highest Recall@10 (0.94)**, with MRR similar to B4. B3 is not the pre-registered comparison.

## What the result supports

- **Supported (descriptive):** when the evolution commit is reachable, the historical channel finds the renamed or refactored target far more often (B2 Recall@10 0.83 vs 0.39 at H = 50). Fusion improves MRR over structural retrieval in 9 of 13 commit clusters.
- **Not established:** a statistically significant improvement of fusion over structural retrieval on the pre-registered primary set (p = 0.066).
- **Limits:**
  - Java only.
  - 13 clusters is all the eligible Category B data there is.
  - Category B is not pristine held-out data.
  - Queries are templated and include the class name.
  - The outside-window cases are classified automatically plus by diff checks, not adjudicated by a human.
  - The code is uncommitted.

## Decision (per pre-registration, INCONCLUSIVE branch)

Existing Java data is exhausted (all 13 eligible clusters were used). The paper-scope decision should rest on the measured effect: ΔMRR +0.107 with p = 0.066 in the primary analysis; the descriptive reachability effect; and fusion harms ≤ rescues. The uncertainty must be stated.

**No further Java experiment on existing data can resolve the significance question.** It would need new independent clusters. Building held-out Python/JavaScript/TypeScript data was gated on SUCCESS; under INCONCLUSIVE it is your decision, not an automatic next step.
