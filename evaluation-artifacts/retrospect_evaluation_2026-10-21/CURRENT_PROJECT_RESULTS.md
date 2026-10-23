# Current project results (authoritative, 2026-10-21)

**How these numbers were produced.**
- Every number is recomputed from case-level ranks by `scripts/evaluation/consolidate_current_results.py`.
- Outputs: `CURRENT_PROJECT_RESULTS.json` (full detail, including per-transformation breakdowns, case IDs and input SHA-256) and `CURRENT_PROJECT_CASE_RESULTS.csv` (92 rows: E1 29 + E3 29 + E2 34).
- Nothing was rerun.

**Configurations** (worker names; semantics unchanged):

| Name | Method |
|---|---|
| `B1_structural_only` | `StructuralRetriever` |
| `B2_historical_only` | `HistoricalRetrievalAdapter` |
| `B3_linear_fusion_0.6S_0.4H` | Linear fusion, 0.6 structural + 0.4 historical |
| `B4_rrf_v2_k60_0.5_0.5` | RRF-v2, k = 60, weights 0.5 / 0.5, zero-signal gating |

There is **no LLM layer**: answer generation is not implemented.

**Metric definitions** (one target per case; rank among all indexed current symbols at the pin):
- **R@k**: target rank ≤ k.
- **MRR**: mean reciprocal rank; unranked counts as 0.
- **Median rank**: unranked counts as +∞. "—" means more than half the cases are unranked.
- **Not retrieved %**: the configuration gave the target no positive score.
- **Rescue / harm @10**: the target moves into / out of the top 10 compared with B1.
- **Improved / regressed**: the rank changes without changing top-10 status.
- **B2 no score**: no historical evidence reached the target.

## 1. Executive table

| Evaluation | Languages | Cases | Clusters | Primary metric | Result type | Main limitation |
|---|---|---:|---:|---|---|---|
| E1 reproduction (H = 50) | Java | 29 (4 configurations each) | 18 | Rank identity with the 2026-10-20 reference | **Reproducibility**: 116/116 identical in 3 code states | Uncommitted code (hash-identified) |
| E3-Reach (H = 400) | Java | 18 primary | 13 | Cluster-mean ΔMRR (B4 − B1), exact sign-flip | **Pre-registered: INCONCLUSIVE** (+0.107, p = 0.066) | One language; 13 clusters; templated queries; not pristine held-out |
| E2 Phase B (H = 50) | Java, Python, JavaScript, TypeScript | 34 | 32 | Per-language R@10 / MRR | **Development** (fusion designed on it) | 7–10 clusters per language; shallow clones; label issues |
| E-Lineage | Java, Python, JavaScript, TypeScript | 21 | 20 | Labelled commit attached to target | **Lineage correctness** (development) | 3–7 cases per language |
| LLM answers | — | 0 | 0 | — | **Not implemented** | — |

**No pooled four-language headline is reported.** The evaluations differ in estimand, data status, horizon and code state.

## 2. Four-language retrieval

Each cell is R@1 / R@5 / R@10 / MRR / median rank / not-retrieved %.

| Evaluation | Cases | Clusters | B1 | B2 | B3 | B4 | B4 vs B1: rescue / harm / improved / regressed | B2 rescues | B2 no score |
|---|---:|---:|---|---|---|---|---|---:|---:|
| E1 Java primary, H = 50 | 18 | 13 | 0.00/0.28/0.72/0.162/7.5/6% | 0.00/0.33/0.39/0.118/—/56% | 0.06/0.44/0.67/0.239/6.5/0% | 0.06/0.39/0.50/0.216/9.5/0% | 2/6/5/5 | 2 | 10 |
| **E3 Java primary, H = 400** | 18 | 13 | 0.00/0.28/0.72/0.162/7.5/6% | 0.06/0.72/0.83/0.279/3.5/0% | 0.00/0.61/**0.94**/0.286/4.0/0% | 0.00/0.61/0.83/0.282/3.5/0% | **4/2/9/1** | 5 | 0 |
| E2 Java (gson, dev) | 8 | 7 | 0.25/0.25/0.38/0.297/14/25% | 0.00/0.00/0.50/0.068/23/12% | 0.00/0.25/0.88/0.183/8/0% | 0.00/0.50/0.75/0.201/6/0% | 3/0/1/2 | 3 | 1 |
| E2 Python (bottle, dev) | 8 | 8 | 0.12/0.25/0.25/0.167/—/**75%** | 0.38/0.50/0.62/**0.460**/4.5/12% | 0.25/0.38/0.62/0.314/7.5/12% | 0.25/0.25/0.62/0.305/8.5/12% | 3/0/1/0 | 3 | 1 |
| E2 JavaScript (express, dev) | 10 | 10 | 0.20/0.40/0.40/0.275/—/60% | 0.10/0.10/0.10/0.100/—/**90%** | 0.20/0.40/0.40/0.245/—/60% | 0.20/0.40/0.40/0.250/—/60% | 0/0/0/1 | 0 | 9 |
| E2 TypeScript (zod, dev) | 8 | 7 | 0.12/0.38/0.38/0.204/—/50% | 0.00/0.00/0.00/**0.009**/—/62% | 0.12/0.25/0.25/0.173/129/38% | 0.25/0.38/0.38/0.280/51.5/38% | 0/0/1/2 | 0 | 5 |

**Notes:**
- **Phase B cluster counts:** 8/7/8/10/7 clusters are distinct evidence commits.
- **py_bot_01 is still counted with its original target here.** The owner decided to retarget it (`Route.get_callback_args`), but it has not been re-measured. Under the original target it is one of the 3 Python B2 rescues, and that rescue **does not stand**: its labelled commit modifies a different method.
- **Unretrieved targets.** High "not retrieved" rates for B1 in Python, JavaScript and TypeScript mean the structural scorer gave the target **no score** (below its 0.08 threshold). These are retrieval failures on the target, not indexing failures: all 34 targets are present in the index.

**Per-transformation breakdowns** are in the JSON (`E3_reach_java_H400.by_transformation`, `E2_phase_b_dev.<language>.by_transformation`). The key pattern (Java, H = 400):

| Category | Cases / clusters | B1 MRR | B4 MRR | Rescues |
|---|---|---|---|---|
| Strict renames | 8 / 4 | 0.118 | 0.323 | 3 |
| Template splits (0043, 0047) | 2 / 2 | — | — | — (B2 MRR 0.006; 1 harm) |

## 3. E3-Reach primary (reconstructed from raw `E3_reach/per_case_results.csv`)

**Recomputed independently; it matches the pre-registered analysis file exactly.**

| Item | Value |
|---|---|
| Primary cases / clusters | 18 / 13 origin commits |
| B1 MRR / R@10 | 0.162 / 0.72 |
| B4 MRR / R@10 | 0.282 / 0.83 |
| Cluster-mean ΔMRR (B4 − B1) | **+0.1068** |
| Test | Exact two-sided sign-flip over 2¹³ assignments: **p = 0.06641** (minimum attainable 0.00024) |
| Rescues / harms @10 | 4 (0049, 0097, 0099, 0001) / 2 (0047, 0078) |
| Reachability | All 18 origins at topological position ≤ 395 < 400. At H = 50, 10 of them were unreachable. |
| Validity | B1 identical to H = 50; all workers exit 0 |
| Pre-registered outcome | **INCONCLUSIVE** |

**Sensitivity analyses** (robustness only, not the result):
- without 0047: p = 0.043;
- without all flagged cases: p = 0.039;
- without 0046 / without 0043: p = 0.058 / 0.061;
- strict renames: 9 cases / 5 clusters, p = 0.0625, the minimum attainable.

## 4. Lineage and reproducibility (kept separate from retrieval)

| Measure | Java | Python | JavaScript | TypeScript |
|---|---|---|---|---|
| E-Lineage: labelled commit attached / cases (clusters) | 7/7 (6) | 6/7 (7) | 3/4 (4) | 2/3 (3) |

- **Explained misses:**
  - py_bot_01: a label error.
  - js_exp_09: the commit only edited a doc comment.
  - ts_zod_04: a revert/re-apply chain; under the owner's chain policy TypeScript is 3/3.
- **Exact reproduction:** E1 116/116 ranks in 3 code states.

## 5. Evidence classes

| Class | Evaluations |
|---|---|
| **Reproducibility** | E1 |
| **Confirmatory / pre-registered** | E3-Reach (inconclusive) |
| **Development** | E2, E-Lineage |
| **Exploratory** | per-transformation breakdowns; H = 50 vs H = 400 comparison (not pre-registered) |
| **Held-out** | **none** |

## 6. Conflicting reports and their resolution

All original reports are preserved.

| Conflict | Resolution |
|---|---|
| B1 = B4 = 60% (Oct 19 narrative) vs table (B4 40%) | Narrative error. The Oct 19 ranks are a different code version and are superseded. |
| MRR 0.4079 / 0.4285 | No raw source; unsupported |
| Pooled 45-case means (57.8 / 22.2 / 55.6 / 44.4 % R@10) | Correct arithmetic over mixed cohorts, invalid as a headline (`R\research_corrected_2026-10-21\discrepancy_log.md`) |
| E2 TypeScript before vs after the fixes | Different code states (extraction fixes); the fix2 values here are current |
| E-Lineage v1 vs final | v1 had a target-matching bug; superseded |

**No claim is made about statistical significance (beyond the reported test), generalization, or LLM answer quality.**
