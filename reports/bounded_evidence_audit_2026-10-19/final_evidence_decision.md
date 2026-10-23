# Final Evidence Decision & Audit Adjudication

**Audit Date:** 2026-10-19  
**Frozen Implementation Commit:** `17ea399217737f8d5fe2c32c310b69c2f812b84d`  
**Overall Benchmark Decision:** `LIMITED DESCRIPTIVE USE ONLY`  

---

## 1. Explicit Answers to the Seven Core Mandated Questions

### Question 1: Can we trust the original raw retrieval outputs as records of what the implementation returned?
**Answer: YES.**
- **Evidence:** The raw JSON logs in `execution_log_2026-10-19.jsonl` and individual CSV outputs in `results/benchmark_runs/` are authentic, untampered records of the frozen codebase.
- **Verification:** An isolated execution trace of `CASE-HIST-JAVA-002` on the frozen commit (`17ea399217`) against all 66,297 candidates in `D:/clones/guava` at commit `db74bd2fda` independently reproduced the exact reported ranks:
  - B1 (Structural): **Rank 4**
  - B2 (Historical): **unretrieved** (score 0.0000)
  - B3 (Combined Linear): **Rank 45**
  - B4 (Combined RRF-v2): **Rank 15**
- The raw output files accurately record what the implementation computed.

---

### Question 2: Can we trust the reported metrics as calculations over the stated cases?
**Answer: YES (subject to documented metric definitions and measurement scopes).**
- **Evidence:** The metric aggregation logic in `run_full_diagnostic.js` accurately implemented Mean Reciprocal Rank (MRR), Recall@K, Abstention Rate, and Retrieval Failure Rate across the evaluated sets ($N=5$ for Category A, $N=29$ for Category B).
- **Nuances Documented:**
  - Abstentions (zero candidate score) and unretrieved targets (rank `null` or $>10$) were correctly assigned reciprocal rank $0.0000$.
  - `Success@10` is mathematically redundant with `Recall@10` in this implementation.
  - Reported latency values reflect execution step timers rather than uniform end-to-end retrieval pipelines (B1 timed over full 66k candidate scans, while B3/B4 timed only candidate array merging).

---

### Question 3: Can we trust the benchmark labels as valid ground truth?
**Answer: NO for confirmatory claims; PARTIALLY for diagnostic analysis.**
- **Category A ($N=5$):**
  - 4 cases (`CASE-STRUCT-JAVA-001`, `CASE-STRUCT-PY-002`, `CASE-STRUCT-TS-004`, `CASE-HIST-JAVA-001`) are fully `VERIFIED`.
  - 1 case (`CASE-HIST-JAVA-002`) is `PARTIALLY VERIFIED`: its evolutionary transition is authentic and verified in Git, but the JSON card referenced a synthetic commit hash (`7dc1a9e...`), requiring translation to the authentic historical commit (`5de36fdaf4`).
- **Category B ($N=29$):**
  - 0 cases are `VERIFIED`.
  - 29 cases are `PARTIALLY VERIFIED`: 100% of pin commits and RefactoringMiner origin commits were verified in authentic Git DAGs, but 0% have undergone manual human adjudication, 0% provide schema-compliant hard negative distractors, and 100% fail schema validation on 9 rules. They represent heuristic automated mining artifacts rather than certified gold-standard ground truth.

---

### Question 4: Can the current results support a descriptive diagnostic comparison of B1–B4?
**Answer: YES.**
- **Evidence:** The evaluation data provides valid, actionable diagnostic evidence regarding specific architectural mechanisms:
  1. *Sibling Module Shadowing:* B1 degrades to Rank 117 on Guava due to identical builder signatures in `android/guava` and `guava-gwt`.
  2. *Historical Horizon Exhaustion:* B2 abstains on 62.1%–80.0% of cases because historical refactorings occurred beyond the rigid 50-commit lookback window.
  3. *Destructive Linear Dilution:* B3 reliably degrades target ranks when one channel abstains (e.g. Guava dropping from Rank 4 to Rank 45).
  4. *RRF Distractor Leapfrogging:* B4 reliably protects targets when the historical channel returns 0 candidates, but allows historical distractors to leapfrog structural targets when query-level gating fails.

---

### Question 5: Can the current results support a confirmatory claim that one configuration outperforms another?
**Answer: NO.**
- **Evidence:**
  - **Statistical Power Failure:** Category A ($N=5$) has a standard error of $\pm 22\%$ and lacks the sample size to achieve statistical significance on any metric.
  - **Empirical Contradiction of B4 Superiority:** In Category A, B1 actually outperformed B4 on Recall@10 (60.0% vs 40.0%) and Recall@5 (60.0% vs 40.0%). The claim in Section 7 that B4 achieved 60.0% Recall@10 was an artifact of confusing truncated exploratory pilot outputs (Rank 9) with full-scale benchmark results (Rank 15).
  - **Unadjudicated Category B Suite:** Category B lacks human curation and negative distractor modeling, rendering its aggregate metrics (+0.015 MRR delta) provisional.

---

### Question 6: Does the schema-validation failure invalidate the actual evaluated Category B cases, all of them, some of them, or none of them?
**Answer: SOME OF THEM (Partially invalidates their benchmark rigor, but does NOT invalidate their underlying Git lineage).**
- **Exact Breakdown:**
  - Evaluated Category B cases: **29**
  - Cases matched to schema-invalid records: **29 of 29 (100%)**
  - Cases with errors in lineage-critical fields: **29 of 29 (100% fail `hard_negatives`)**
  - Cases with errors confined solely to ancillary metadata: **0**
  - Cases whose underlying Git commits and refactoring diffs are verified: **29 of 29 (100%)**
- **Impact:** The evaluator was able to parse target symbols and execute retrieval without crashing. However, because `hard_negatives` was absent, the benchmark could not evaluate distractor discrimination. The schema errors do not make the cases fictional, but they disqualify them from serving as gold-standard benchmark data until normalized.

---

### Question 7: What is the minimum next action required before proceeding?
**Answer:**
**The single minimum, bounded next action is to normalize and adjudicate the Category B benchmark suite:**
1. Update the 29 JSON records in `historical-cases.json` to conform to `retrieval-case.schema.json` (correcting the 9 schema violations and populating verified hard-negative distractors from sibling modules).
2. Configure adaptive Git history lookback depth ($k > 50$ or `git log --follow`) so that historical retrieval can evaluate the 20 cases whose lineage transitions lie beyond the arbitrary 50-commit horizon.

Do not collect new repositories or modify retrieval algorithms until this benchmark normalization is completed.

---

## 2. Overall Status Declaration

```
================================================================================
                    FINAL AUDIT STATUS CLASSIFICATION:
                     LIMITED DESCRIPTIVE USE ONLY
================================================================================
```

### Justification:
- **Why NOT `STOP — EVIDENCE NOT TRUSTWORTHY`:** The raw execution logs, Git commits, RefactoringMiner diffs, and isolated trace results are authentic and reproducible. The results are not fabricated, and the diagnostic failure modes identified (sibling shadowing, commit distance horizon, linear dilution) are genuine software phenomena.
- **Why NOT `SUFFICIENT FOR A CONFIRMATORY COMPARISON`:** The sample size of verified cases ($N=5$) is statistically negligible, the claim that B4 outperforms B1 is contradicted by the empirical data in Category A, and 100% of Category B cases fail schema validation and lack human adjudication.
- **Why `LIMITED DESCRIPTIVE USE ONLY`:** The artifacts provide valuable qualitative and exploratory guidance for engineering Retrospect, but cannot be published as scientific proof of superior retrieval performance.
