# Research Paper Outline

**Title:** When Code History Matters: An Empirical Study of Evolution-Aware Retrieval for Repository-Level Code Search  
**Target Venue:** IEEE Transactions on Software Engineering (TSE) / ACM SIGSOFT FSE / ICSE 2027  
**Branch:** \`eval-reframing-empirical-study\`  
**Date:** 2026-10-20  

---

## Abstract
Contemporary repository-level code search engines index codebases at a single point in time, implicitly assuming that query vocabulary aligns with the latest commit snapshot. In practice, software systems undergo continuous refactoring: functions are renamed, extracted, and relocated across files. When developers query a codebase using terminology from legacy documentation, historical bug reports, or predecessor APIs, contemporary structural search frequently fails because the query identifiers no longer exist in the modern Abstract Syntax Tree (AST). While mining version control history offers a potential remedy, indexing full repository histories risks high indexing latency, false-positive hallucinations, and ranking dilution on contemporary code.

In this paper, we present **Retrospect**, an evolution-aware code retrieval engine that couples contemporary AST structural indexing with merge-aware Git history traversal, transitive lineage tracking, and channel-balanced Reciprocal Rank Fusion (RRF-v2) with zero-signal gating. We conduct an empirical multi-repository evaluation across 45 verified benchmark cases, 14 open-source repositories, and 4 programming languages (Java, Python, JavaScript, TypeScript), decoupling cases into distinct analytical strata to isolate evolutionary rescue from contemporary search performance. Our findings reveal that: (1) for in-policy refactorings where contemporary search fails due to name or signature changes, historical retrieval achieves a **40.0% incremental recovery rate**, rescuing symbols to top-10 ranks; (2) on contemporary, unmodified code, RRF-v2 with zero-signal gating causes **zero rank dilution** ($\Delta \text{MRR} = -0.0013$); (3) on unanswerable negative controls, the historical channel cleanly abstains (**0.0% false-positive rate**); and (4) historical effectiveness exhibits a sharp horizon boundary, decaying from 60.0% Success@10 within 50 commits to 0.0% beyond 100 commits. These results demonstrate that historical retrieval is not a general replacement for structural search, but a powerful, precision-guarded rescue mechanism for evolution-induced query mismatches.

---

## 1. Introduction
- **1.1 Context & Motivation:** Code search in evolving software repositories; the prevalence of API drift and refactoring.
- **1.2 The Historical Vocabulary Problem:** Why developers query using obsolete identifiers (reading legacy stack traces, porting old client code, investigating regressions).
- **1.3 Failure of Contemporary Structural Search:** Syntactic and lexical blindness to renamed or deleted identifiers.
- **1.4 Reframing the Research Question:** Moving from general superiority claims to empirical boundary conditions: *Under what conditions does historical code retrieval recover relevant code that current-repository structural retrieval misses, and what factors limit its effectiveness?*
- **1.5 Contributions:**
  1. *Architecture:* Retrospect, a multi-channel code search engine integrating merge-aware Git DAG traversal, multi-hop function lineage stitching, and channel-balanced Cormack RRF-v2 with zero-signal gating.
  2. *Empirical Methodology:* A 3-stage evaluation framework (Reachability, Detection, Retrieval) with cluster-bootstrap statistical inference.
  3. *Empirical Evidence:* A 45-case multi-repository study across 14 repositories demonstrating 40% incremental recovery on refactored symbols with zero rank dilution on contemporary code.
  4. *Boundary Taxonomy:* Empirical characterization of failure modes (horizon decay, overload ambiguity, dynamic language vocabulary gaps).

---

## 2. Related Work
- **2.1 Repository-Level Code Search:** Lexical approaches (Lucene, BM25), structural approaches (AST/Tree-sitter, symbol graphs), and neural dense retrieval (CodeBERT, GraphCodeBERT, UniXcoder).
- **2.2 Mining Software Repositories & Refactoring Tracking:** RefactoringMiner, Git history analysis, method lineage tracking across commits.
- **2.3 Retrieval Fusion & Reciprocal Rank Fusion:** CombSUM/CombMNZ, linear score interpolation, Cormack RRF, rank dilution phenomena in hybrid retrieval.

---

## 3. The Retrospect Architecture
- **3.1 Structural Retrieval Channel (B1):** AST callable symbol extraction, tokenization, subtoken Jaccard similarity, call-graph proximity boosting.
- **3.2 Evolution-Aware Historical Channel (B2):**
  - *Merge-Aware History Traversal:* \`git log --topo-order\` with merge branch exploration.
  - *AST Diff & Commit Message Parsing:* Lexical overlap on unified diff hunks.
  - *Function Matching & Lineage Stitching:* Two-tier heuristic matching (signature/hash vs body tokens $\ge 0.70$) with ambiguity guards.
- **3.3 Channel-Balanced Cormack RRF-v2 (B4):**
  - Formula: $RRF_{v2}(d) = \sum_{c} \mathbb{I}[S_c(d) > 0] \cdot \frac{w_c}{k + \text{rank}_c(d)}$
  - Mathematical proof of zero-signal gating preventing fallback dilution.
  - Fractional rank handling for ties; deterministic candidate ID tie-breaking.

---

## 4. Empirical Study Design
- **4.1 Research Sub-Questions:**
  - *EQ1 (Historical Rescue):* Incremental recovery on refactored code.
  - *EQ2 (Structural Redundancy):* Shared success and structural sufficiency.
  - *EQ3 (Safe Abstention):* False-positive resistance on unanswerable queries.
  - *EQ4 (Rank Dilution & Horizon Decay):* Degradation on contemporary code and across commit distance bands.
- **4.2 Benchmark Fleet & Cohort Stratification:**
  - Primary In-Policy Refactorings ($N = 5, M = 5$).
  - Category C Contemporary Controls ($N = 3, M = 3$).
  - Category D Quarantined Negatives ($N = 4, M = 4$).
  - Distance-Stratified Diagnostic ($N = 20, M = 13$).
  - Cross-Language Exploratory Pilots ($N = 11, M = 11$).
  - Historical Pilot Anchors ($N = 2, M = 2$).
- **4.3 Evaluation Protocol & Metric Definitions:**
  - Four-category outcome taxonomy: A (Historical Advantage), B (Shared Success), C (Structural-Only), D (Neither Succeeds).
  - Fusion impact: Rescue, Neutral, Harm.
  - Success@K ($K \in \{1, 5, 10\}$) and Mean Reciprocal Rank (MRR).
- **4.4 Statistical Rigor:** Origin-commit cluster bootstrapping ($B = 1000$ iterations) with 95% confidence intervals; sealed test split discipline.

---

## 5. Results & Empirical Analysis
- **5.1 Historical Rescue on Refactored Symbols (EQ1):**
  - In-policy recovery: 40.0% incremental gain.
  - Case studies: Checkstyle \`getMessages\` $\to$ \`getViolations\` (B1: \`null\`, B2: 2, B4: 8); Undertow \`getResource\` $\to$ \`getBuffer\` (B1: 14, B2: 4, B4: 1).
  - MRR improvement: $\Delta \text{MRR} = +0.1759$ [95% CI: -0.013, +0.365].
- **5.2 Shared Success & Structural Sufficiency (EQ2):**
  - When class context anchors the search: Graphhopper \`removeZeroDegreeNodes\` (B1: 4, B2: 3, B4: 2).
- **5.3 Protection Against Contemporary Dilution (EQ4):**
  - Category C contemporary controls: Success@10 unchanged at 66.7%; $\Delta \text{MRR} = -0.0013$ [95% CI: -0.003, 0.000].
- **5.4 Safe Abstention on Negatives (EQ3):**
  - Quarantined negatives: 0.0% false positives (0 / 4 Top-10 hits); historical channel MRR = 0.0018.
- **5.5 Historical Lookback Horizon Decay (EQ4):**
  - Performance across commit bands: $k \le 50$ (60.0%), $51 \le k \le 100$ (33.3%), $k > 100$ (0.0%).

---

## 6. Failure Analysis & Boundary Conditions
- **6.1 Overload & Sibling Method Ambiguity:** Undertow \`CASE-HIST-JAVA-0047\` and the trade-off between ambiguity guards and recall.
- **6.2 Fusion Rank Dilution (Harm):** Analysis of the single observed fusion regression (\`CASE-HIST-JAVA-0047\`, B1: 8 $\to$ B4: 29).
- **6.3 Cross-Language Pilot Challenges:** Dynamic typing, terse commit messages, and shallow clone DAG truncation in Python and TypeScript.

---

## 7. Practical Implications & Design Guidelines
- **7.1 When to Activate Historical Indexing:** Selective query triggering based on identifier obsolescence.
- **7.2 Engineering the Historical Horizon:** Budgeting commit lookbacks ($H \le 50$) to balance latency and recall.
- **7.3 Safe Fusion in Production Search:** Mandatory zero-signal gating and channel balancing in hybrid search engines.

---

## 8. Threats to Validity & Limitations
- Construct validity (query realism, fixed ambiguity thresholds).
- Internal validity (primary cluster sample size $M = 5$, bounded lookback window $H = 50$).
- External validity (Java library dominance, generalization to other ecosystems).
- Reliability (bit-level determinism, automated regression test suites).

---

## 9. Conclusion & Future Work
- Summary of empirical findings: Historical search as a high-precision rescue channel.
- Future work: Expanding cross-language benchmarks via multi-institution blinded query authoring; path-targeted deep history indexers (\`git log -L\`); adaptive ambiguity guards.
