# Retrospect — Research Question & Empirical Methodology

**Working Title:** *"When Code History Matters: An Empirical Study of Evolution-Aware Retrieval for Repository-Level Code Search"*  
**Branch:** \`eval-reframing-empirical-study\`  
**Date:** 2026-10-20  
**Methodology Standard:** IEEE/ACM Empirical Software Engineering Guidelines

---

## 1. Research Problem & Reframed Question

### 1.1 The Research Problem
Repository-level code search engines traditionally index the contemporary codebase at a single point in time (the latest commit or release checkout). However, software systems undergo continuous refactoring: functions are renamed, methods are relocated across files or packages, and implementations are rewritten. When developers query a codebase using terminology from legacy documentation, historical bug reports, obsolete APIs, or predecessor function names, contemporary structural search frequently fails because the query identifiers no longer exist in the contemporary Abstract Syntax Tree (AST).

While mining version control history provides a potential remedy, indexing full repository histories introduces substantial computational overhead, query latency, distractor competition, and the risk of ranking dilution on contemporary code.

### 1.2 The Core Research Question
This investigation reframes the evaluation around the empirical boundary conditions of history-aware search:

> **Primary RQ:** Under what conditions does historical code retrieval recover relevant code that current-repository structural retrieval misses, and what factors limit its effectiveness?

This primary question is operationalized through four empirical sub-questions:
- **EQ1 (Historical Rescue):** For code symbols that have undergone evolutionary renaming or relocation, can historical retrieval locate the modern target when contemporary structural retrieval fails?
- **EQ2 (Shared vs. Structural Sufficiency):** In what proportion of refactorings is contemporary structural search already sufficient, rendering historical search redundant?
- **EQ3 (Safe Abstention on Negatives):** Does the historical retrieval channel safely abstain (return zero score) when presented with unanswerable or non-lineage queries, avoiding false-positive hallucinations?
- **EQ4 (Rank Dilution & Horizon Decay):** Does fusing historical evidence into contemporary structural search degrade search precision on contemporary code, and how does retrieval performance decay as the commit distance to the refactoring event increases?

---

## 2. Experimental Configurations & Baselines

To rigorously measure incremental value, Retrospect evaluates four distinct retrieval configurations against identical candidate pools:

```
                      +---------------------------------------+
                      |             USER QUERY                |
                      +---------------------------------------+
                                   |             |
                   +---------------+             +---------------+
                   |                             |
                   v                             v
     +---------------------------+ +---------------------------+
     |   B1: STRUCTURAL SEARCH   | |   B2: HISTORICAL SEARCH   |
     | AST contemporary checkout | | Topological Git log diffs |
     | BM25 / token matching     | | Transitive lineage stitch |
     +---------------------------+ +---------------------------+
                   |                             |
                   +--------------+--------------+
                                  |
                   +--------------+--------------+
                   |                             |
                   v                             v
     +---------------------------+ +---------------------------+
     |     B3: LINEAR FUSION     | |    B4: CORMACK RRF-v2     |
     | Normalized score sum:     | | Channel-balanced RRF:     |
     | w_S * S_B1 + w_H * S_B2   | | sum(w_c / (k + rank_c))   |
     +---------------------------+ +---------------------------+
```

### 2.1 Baseline B1: Contemporary Structural Retrieval
- **Mechanism:** Indexes contemporary AST callable symbols (classes, methods, functions) at the checkout commit ($HEAD$).
- **Scoring Function:** Token overlap and subtoken Jaccard similarity across identifier names, parameter lists, docstrings, and file paths, augmented with call-graph adjacency boosts.
- **Hypothesis:** Highly effective for contemporary and unmodified code, but blind to historical identifiers.

### 2.2 Baseline B2: Evolution-Aware Historical Retrieval
- **Mechanism:** Executes merge-aware topological history traversal (`git log --topo-order -n 50`), parsing commit messages, author metadata, and patch diffs.
- **Lineage Stitching:** Applies [\`FunctionMatcher.js\`](file:///D:/base%20papers%20considered/Retrospect/src/matcher/FunctionMatcher.js) (Tier 1 hash/signature matching and Tier 2 body-token similarity $\ge 0.70$) to stitch multi-hop evolutionary lineages ($A \to B \to C$) forward to contemporary symbols.
- **Scoring Function:** Scored using predecessor name matches, diff token overlap, commit message terms, and lineage confidence discounts.

### 2.3 Baseline B3: Linear Score Fusion
- **Mechanism:** Weighted linear combination of structural and historical scores:
  $$S_{B3}(d) = w_S \cdot \tilde{S}_S(d) + w_H \cdot \tilde{S}_H(d)$$
  with active-channel normalization (Option A) to prevent penalizing candidates that possess evidence in only one channel. Weights: $w_S = 0.50, w_H = 0.50$.

### 2.4 Baseline B4 / System S1: Channel-Balanced Cormack RRF-v2
- **Mechanism:** Channel-balanced Reciprocal Rank Fusion with smoothing parameter $k = 60$:
  $$RRF_{v2}(d) = \sum_{c \in \{S, H\}} \mathbb{I}[S_c(d) > 0] \cdot \frac{w_c}{k + \text{rank}_c(d)}$$
- **Zero-Signal Gating:** $\mathbb{I}[S_c(d) > 0]$ guarantees that channels with zero evidence contribute exactly 0.0, eliminating fallback ranks and synthetic leakage.
- **Fractional Tie-Breaking:** Multi-tier ties share the average fractional rank, preventing arbitrary alphabetization artifacts.
- **Strict Weak Ordering:** Deterministic tie-breaking by candidate ID ensures 100% reproducible rankings.

---

## 3. Three-Stage Evaluation Framework

To isolate retrieval failures from tracking failures, Retrospect implements a 3-stage evaluation framework:

```
+-------------------------------------------------------------------------------------------------+
|                                3-STAGE HISTORICAL EVALUATION HARNESS                            |
+-------------------------------------------------------------------------------------------------+
| STAGE A: REACHABILITY                                                                           |
|   Verifies whether the origin refactoring commit was encountered during the topological        |
|   history traversal (window H = 50 commits).                                                   |
|   Outputs: REACHABLE | OUTSIDE_SEARCH_HORIZON | UNREPRESENTED_BRANCH                            |
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
| STAGE B: DETECTION / LINEAGE MATCHING                                                           |
|   Measures whether FunctionMatcher correctly matched the historical function to the modern     |
|   target symbol across AST diffs.                                                              |
|   Outputs: UNCHANGED | MODIFIED | RENAMED_SYMBOL | MOVED | REWRITTEN | AMBIGUOUS | UNMATCHED     |
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
| STAGE C: RETRIEVAL & RANKING                                                                    |
|   Evaluates the candidate rank of the verified modern symbol within the full repository pool.   |
|   Outputs: Rank in B1, B2, B3, B4; Success@1, Success@5, Success@10, Reciprocal Rank            |
+-------------------------------------------------------------------------------------------------+
```

---

## 4. Case-Level Outcome Taxonomy

Every evaluated case is categorized into one of four mutually exclusive outcomes at cutoff $K = 10$:

$$\text{Outcome}(c) = \begin{cases}
\mathbf{A:\text{ Historical Advantage}}, & \text{if } \text{rank}_{B2}(c) \le 10 \land (\text{rank}_{B1}(c) > 10 \lor \text{rank}_{B1}(c) = \text{null}) \\
\mathbf{B:\text{ Shared Success}},       & \text{if } \text{rank}_{B1}(c) \le 10 \land \text{rank}_{B2}(c) \le 10 \\
\mathbf{C:\text{ Structural-Only}},      & \text{if } \text{rank}_{B1}(c) \le 10 \land (\text{rank}_{B2}(c) > 10 \lor \text{rank}_{B2}(c) = \text{null}) \\
\mathbf{D:\text{ Neither Succeeds}},     & \text{if } \text{rank}_{B1}(c) > 10 \land \text{rank}_{B2}(c) > 10
\end{cases}$$

Additionally, fusion impact is classified as:
- **Fusion Rescue:** Target promoted into Top-10 ($\text{rank}_{B4} \le 10 \land \text{rank}_{B1} > 10$).
- **Fusion Neutral:** Target retained in Top-10 or unranked in both.
- **Fusion Harm (Dilution):** Target displaced from Top-10 by historical noise ($\text{rank}_{B1} \le 10 \land \text{rank}_{B4} > 10$).

---

## 5. Statistical Inference & Cluster Bootstrap

Because refactoring cases originating from the same Git commit share commit messages, authors, and file contexts, observations within the same commit are non-independent. To prevent sample clustering bias:
- Resampling is conducted via **Origin-Commit Cluster Bootstrapping** ($B = 1000$ iterations).
- Entire origin-commit clusters are resampled with replacement.
- Confidence intervals (95% CI) are computed via linear percentile interpolation.
- Paired differences ($\Delta \text{MRR} = \text{MRR}_{B4} - \text{MRR}_{B1}$) are evaluated across identical resamples.
- Split discipline is strictly enforced via [\`SplitGuard.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/SplitGuard.js).
