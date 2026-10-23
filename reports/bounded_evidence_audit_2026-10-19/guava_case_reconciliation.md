# Guava Case Reconciliation: `CASE-HIST-JAVA-002`

**Audit Date:** 2026-10-19  
**Case ID:** `CASE-HIST-JAVA-002`  
**Repository:** `google/guava` @ `db74bd2fdac443223d45e6fc5c66548542be1081` (Release v32.1.2)  
**Target Class & Method:** `com.google.common.collect.CollectPreconditions.checkNonnegative`  
**Canonical File Path:** `guava/src/com/google/common/collect/CollectPreconditions.java` (Line 37)  
**Evaluation Query Text:** `"Multisets.checkNonnegative"`  
**Task Track:** Historical Name Lookup (Finding code previously known under a historical identifier)  

---

## 1. Ground Truth Specification & Clarification of Query vs. Target

A critical ambiguity in earlier audit discussions arose from confusing the **query text** with the **target function**:
* **Query Text:** `"Multisets.checkNonnegative"` (The developer specifies the historical method name from pre-refactoring API versions).
* **Ground Truth Target:** `CollectPreconditions.checkNonnegative` (The current method implementation relocated into the package-private utility class `CollectPreconditions`).
* **Source Definition:** `benchmarks/splits/dev_cases.json` (Line 1,482).

The retrieval system is asked: *"Where did `Multisets.checkNonnegative` go in the current codebase?"* The ground truth answer is `CollectPreconditions.checkNonnegative`.

---

## 2. Forensic Reconciliation Table

| Configuration | Original Reported Rank | Rank in Raw Output (`CASE-HIST-JAVA-002.json`) | Isolated Trace Rank (`scratch/trace_case_hist_002.js`) | Candidate Pool Evaluated | Status | Detailed Explanation |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **B1 (Structural Only)** | **4** | **4** | **4** (Mode: `endsWith`)<br>*7 (Mode: `exact`)* | 66,297 symbols (Full repo) | **RECONCILED** | Exact score $0.2000$. Matches `android/guava/.../CollectPreconditions.java` at Rank 4 under harness `endsWith` matching, or `guava/.../CollectPreconditions.java` at Rank 7 under exact path matching. |
| **B2 (Historical Only)** | **Unretrieved** (Score 0) | **Unretrieved** (Score 0) | **Unretrieved** (Score 0, Rank 21,834) | 66,297 symbols (Full repo) | **RECONCILED** | Historical adapter traversed $k=50$ commits prior to release tag. Real refactoring occurred 4,149 commits earlier (commit `5de36fdaf4` in 2013). Historical score was $0.0000$ (abstention). |
| **B3 (Combined Linear)** | **45** | **45** | **45** (Mode: `endsWith`)<br>*48 (Mode: `exact`)* | 66,297 symbols (Full repo) | **RECONCILED** | Linear dilution: $S = 0.60 \times 0.2000 + 0.40 \times 0.0000 = 0.1200$. Exactly 44 other symbols (mostly `Multisets` methods with positive historical tokens) scored $>0.1200$, plunging target to Rank 45. |
| **B4 (Combined RRF-v2)** | **15** | **15** | **15** (Mode: `endsWith`)<br>*18 (Mode: `exact`)* | 66,297 symbols (Full repo) | **RECONCILED** | Zero-signal historical gating activated ($\mathbb{I}(S_h > 0) = 0$). Score = $\frac{0.60}{60 + 4} = 0.009375$. Preserved target near top-10, achieving Rank 15 across 66,297 candidates. |

---

## 3. Discrepancy Analysis: Where Did Ranks 3, 24, and 9 Originate?

In the diagnostic evaluation report (`evaluation_report.md` Section 5.3) and earlier exploratory scripts (`scratch/test_all_verified.js`), an alternative set of ranks appeared:
* **Exploratory Ranks:** B1 = 3, B3 = 24, B4 = 9 (Yielding an exploratory MRR of `0.2669 ≈ 0.267`).
* **Official Evaluation Ranks:** B1 = 4, B3 = 45, B4 = 15 (Yielding the official MRR of `0.2528998 ≈ 0.2529`).

### Root Cause of the Rank Difference
1. **Candidate Pool Truncation in Exploratory Pilot:**
   In `scratch/test_all_verified.js` (lines 176 & 192), `UnifiedSearch.search` was invoked with `limit: 50`. Candidates were truncated to top-50 before cross-channel fusion was finalized. Because competing candidates were artificially restricted to 50 items, the diluted score ($0.1200$) placed the target at **Rank 24**. Under RRF, it placed at **Rank 9**.
2. **Exhaustive Candidate Space in Full Benchmark Harness:**
   In `scratch/run_full_diagnostic.js` (the official evaluation harness), candidate parity was enforced across the **entire repository** (all 66,297 symbols). Without artificial truncation, all 44 symbols scoring $>0.1200$ across Guava were retained, placing the target at **Rank 45** (B3) and **Rank 15** (B4).
3. **Multi-Module Sibling Shadowing:**
   In Guava, `android/guava/src/.../CollectPreconditions.java` and `guava/src/.../CollectPreconditions.java` both contain the identical static method `checkNonnegative(int, String)` at line 37, producing identical structural scores ($0.19999999999999998$). Under alphabetical tie-breaking by symbol ID, the `android/guava` symbol (`D:\clones\guava\android\...`) sorts before `D:\clones\guava\guava\...`, placing at Rank 4. The canonical `guava/` symbol places at Rank 7.

---

## 4. Origin Commit Lineage Audit

The ground-truth record in `dev_cases.json` cites:
* `origin_commit_sha`: `7dc1a9e34c9c1b9b5a8e0f146f8eb06cf22b8214`
* `change_type`: `move`
* `commit_message`: `"Factor out CollectPreconditions from Multisets and collections."`

### Forensic Git Findings
1. **`git cat-file -e 7dc1a9e34c9c1b9b5a8e0f146f8eb06cf22b8214` fails** with `fatal: bad object`. **The commit does not exist in Google Guava's Git repository.**
2. This hash is a **synthetic mock SHA** created during prototype development by concatenating string fragments (`5a8e0f146f8eb06cf22b82`).
3. An authentic Git search (`git log --grep="CollectPreconditions" --oneline`) reveals the true origin commits:
   * **Commit `5de36fdaf4` (MOE_MIGRATED_REVID=50631776, Aug 2013):** *"Extract CollectPreconditions with some common checks. Use those checks more widely, especially checkRemove..."*
   * **Commit `adc5bb87fb` (MOE_MIGRATED_REVID=56097311, Nov 2013):** *"Use CollectPreconditions.checkNonnegative more widely in common.collect."*
4. **Distance to Evaluation Pin:**
   $$\text{Distance} = \text{git rev-list --count } 5\text{de}36\text{fdaf}4..\text{db}74\text{bd}2\text{fda} = \mathbf{4,149\text{ commits}}$$
   Because the refactoring took place in 2013 (4,149 commits prior to the 2023 release tag), Retrospect's 50-commit horizon could not possibly locate the refactoring event.

---

## 5. Final Reconciliation Conclusion

### **VERDICT: RECONCILED**

1. The reported diagnostic ranks (**B1: 4, B2: unretrieved, B3: 45, B4: 15**) are **100% verified and reproducible** from the frozen implementation when evaluated against the full repository candidate pool using the harness matching rules.
2. The alternative ranks (**B1: 3, B3: 24, B4: 9**) are verified as artifacts of an earlier exploratory test script with top-50 candidate pool truncation, and were erroneously transcribed into the narrative text of the report.
3. The historical abstention is explained by the 4,149-commit distance to the true refactoring origin (`5de36fdaf4`), compounded by a synthetic origin commit SHA in the benchmark card metadata.
