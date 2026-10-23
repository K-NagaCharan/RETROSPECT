# Experimental Protocol: Historical Retrieval Lookback Horizon & Traversal Strategy

**Protocol ID:** EXP-RETROSPECT-HIST-HORIZON-01  
**Target System:** Retrospect Historical Retriever (`HistoricalRetriever.js` / Git History Adapter)  
**Frozen Implementation Commit:** `17ea399217737f8d5fe2c32c310b69c2f812b84d`  
**Benchmark Suite:** Repaired Category B Benchmark (`category_b_repaired.json`, $N=29$)  
**Status:** PROPOSED EXPERIMENT (Execution deferred until approved)  

---

## 1. Scientific Objective & Problem Statement

The bounded evidence audit proved that **20 of the 29 Category B cases (69.0%)** have authentic refactoring origins located between 52 and 637 commits prior to the evaluation pin commit. 

Because Retrospect currently enforces a rigid, hardcoded lookback depth of $k=50$ commits:
1. The historical retriever encounters zero commits touching the target method in 20 cases, producing an artificial **62.1% abstention rate** in Category B.
2. Under linear fusion (B3), this zero-signal causes severe rank dilution.
3. Under RRF fusion (B4), query-level zero-signal gating fails whenever unrelated commits are retrieved in the 50-commit window, allowing recent commit distractors to leapfrog the true target.

This experimental proposal defines a controlled, reproducible methodology to evaluate extended and adaptive history traversal policies without changing candidate pools, queries, or retrieval algorithms.

---

## 2. Experimental Conditions

The experiment compares four distinct historical traversal policies:

```
+-------------------------------------------------------------------------------------------------+
|                                 HISTORICAL TRAVERSAL STRATEGIES                                 |
+-------------------------------------------------------------------------------------------------+
           |                                       |                                   |
           v                                       v                                   v
+-----------------------+               +-----------------------+           +---------------------+
| Condition 0 (Baseline)|               | Condition 1 (Parametric|          | Condition 2 (Path-  |
| - Fixed k=50 commits  |               |   Extended Horizons)  |          |   Following Traversal|
| - Current default     |               | - k in {100, 250,     |          | - git log --follow  |
|                       |               |         500, 750}     |          | - adaptive horizon  |
+-----------------------+               +-----------------------+           +---------------------+
                                                   |
                                                   v
                                        +-----------------------+
                                        | Condition 3 (Decay-   |
                                        |   Weighted Traversal) |
                                        | - Exponential distance|
                                        |   weighting: exp(-d/D)|
                                        +-----------------------+
```

### Condition 0: Baseline (Current Default)
- **Lookback Policy:** Fixed $k=50$ commits prior to the checked-out evaluation snapshot.
- **Traversal Scope:** `git log -n 50 --name-only` / `git diff-tree`.
- **Filtering:** Uniform candidate scoring within the 50-commit window; zero score beyond commit 50.

### Condition 1: Parametric Extended Horizons
- **Lookback Policy:** Configurable fixed commit horizon $k \in \{100, 250, 500, 750, 1000\}$.
- **Traversal Scope:** Extended git log traversal up to $k$ revisions.
- **Purpose:** Identifies the minimum fixed horizon necessary to capture 95% of Category B refactorings (specifically targeting the Datastax cases requiring 637 commits).

### Condition 2: Path/Symbol-Following Traversal (`git log --follow`)
- **Lookback Policy:** Rather than scanning all repository commits globally up to an arbitrary count, traversal executes targeted file-following:
  ```bash
  git log --follow -n 200 --stat -- <target_file_path>
  ```
- **Rationale:** Focuses git traversal computational budget strictly on files associated with top structural candidates, tracking renames across file moves without global history scanning overhead.

### Condition 3: Distance-Decayed Score Weighting
- **Lookback Policy:** Deep traversal ($k=750$), but historical candidate relevance scores $S_{hist}$ are scaled by an exponential distance penalty:
  $$S_{hist}^{decayed}(d) = S_{hist}(d) \cdot \exp\left(-\frac{\text{dist}(origin, pin)}{\tau}\right)$$
  where $\tau = 150$ commits.
- **Rationale:** Prevents ancient refactorings from overpowering recent structural signals while preventing complete zero-signal abstention.

---

## 3. Strict Control of Invariant Variables

To rigorously isolate the causal impact of the historical lookback policy, the following components **must remain strictly constant**:

| Component | Invariant Specification | Verification Method |
|---|---|---|
| **Codebase Commit** | Frozen at `17ea399217737f8d5fe2c32c310b69c2f812b84d`. | `git rev-parse HEAD` check before and after run. |
| **Benchmark Dataset** | Repaired Category B dataset (`category_b_repaired.json`, $N=29$). | SHA-256: `ACB2E388BF510B719E56F82263DEC349C2258194FC66DAC4E54038DE5FE2B94F`. |
| **Candidate Pools** | Full, un-truncated AST candidate pools for all 4 repositories: `datastax/java-driver` (f4240267), `checkstyle/checkstyle` (10a3a077), `graphhopper/graphhopper` (c7497d11), `undertow-io/undertow` (cf3abec9). | In-memory AST symbol cache loaded once; identical across conditions. |
| **Structural Retriever (B1)** | Identical BM25 lexical tokenization, AST weights ($w_{decl}=0.5, w_{doc}=0.3, w_{body}=0.2$), and score normalization. | B1 ranks must be bit-for-bit identical across all test runs. |
| **Fusion Parameters** | B3 Linear: $w_s=0.60, w_h=0.40$.<br>B4 RRF-v2: $k_{rrf}=60, w_s=0.60, w_h=0.40$. | Identical fusion formulas across all conditions. |
| **Evaluation Metrics** | Standardized formulas: MRR, Recall@1, Recall@5, Recall@10, Abstention Rate, Failure Rate, Latency. | Identical metric aggregation script. |

---

## 4. Testable Hypotheses & Success Criteria

1. **Abstention Elimination:**
   - *Hypothesis:* Extending lookback depth to $k=750$ (Condition 1) or using `--follow` (Condition 2) will reduce Category B historical abstention rate from **62.1% (18/29)** to **$\le 10.0\%$**.
2. **Historical Retriever (B2) MRR Gain:**
   - *Hypothesis:* B2 standalone MRR on Category B will increase from **0.1110** to **$\ge 0.3500$** as 20 unretrieved cases become discoverable.
3. **Fusion (B4) Rank Recovery:**
   - *Hypothesis:* Providing authentic historical signals to B4 on the 20 previously abstaining cases will improve B4 Recall@10 from **55.2%** to **$\ge 75.0\%$**.
4. **Latency Budget:**
   - *Constraint:* Historical query latency under Condition 2 (`--follow`) must remain under **500 ms per query** on repositories with $>30,000$ commits.

---

## 5. Execution Safeguards

- **NO EXECUTION IN THIS PASS:** In accordance with audit constraints, no git history parameters or retrieval scripts shall be modified during this benchmark repair phase.
- **Execution Prerequisite:** This experiment will only be executed after formal reviewer approval of the repaired Category B benchmark.
