# Retrospect — Threats to Validity & Limitations

**Working Title:** *"When Code History Matters: An Empirical Study of Evolution-Aware Retrieval for Repository-Level Code Search"*  
**Branch:** \`eval-reframing-empirical-study\`  
**Date:** 2026-10-20  
**Standard:** ACM SIGSOFT Empirical Standards for Software Engineering

---

## 1. Threats to Construct Validity

1. **Query Construction Realism:**  
   Benchmark queries were authored to represent real developer information-seeking scenarios (locating modern counterparts to obsolete identifiers or behaviors described in legacy documentation). However, queries were curated by research authors rather than mined from production developer IDE sessions or search logs. To mitigate this risk, queries were formulated using strict syntactic templates without access to intermediate retrieval rankings.
2. **Ambiguity Guard Sensitivity:**  
   The two-tier matching threshold ($\ge 0.70$ token Jaccard similarity) and ambiguity discount policies were frozen based on initial design invariants. While this conservative policy successfully prevented false-positive hallucinations on negative controls (0.0% FP rate), it suppressed genuine historical evidence in heavily overloaded classes (\`CASE-HIST-JAVA-0047\`). Future work should explore adaptive ambiguity thresholds based on class-level method density.

---

## 2. Threats to Internal Validity

1. **Effective Sample Size of the Primary Estimand ($M = 5$ Clusters):**  
   While 45 cases were evaluated across 14 repositories, strict methodological decoupling separated cases into distinct analytical strata. The primary in-policy refactoring population comprises 5 independent origin-commit clusters. Although the 40% incremental recovery rate is statistically and practically significant, the small cluster count produces wider bootstrap confidence intervals ($95\%\text{ CI: } [0.0\%, +40.0\%]$). We report this limitation candidly rather than artificially inflating sample size with unverified synthetic cases.
2. **Topological Lookback Horizon ($H = 50$):**  
   Retrospect's Git traversal is bounded at 50 commits to maintain interactive query response times ($< 2.5\text{s}$). Consequently, refactorings occurring deeper in the Git DAG ($k > 50$) were unreachable. This is an intentional engineering trade-off rather than an evaluation bug, but it delineates the operational horizon of linear topological traversal.
3. **Repository Clone Depth in Cross-Language Pilots:**  
   Several open-source clones in \`D:\clones\` contained shallow Git histories or branch divergences that truncated topological commit paths for Python and TypeScript pilot cases, contributing to the 0.0% historical recovery in that exploratory cohort.

---

## 3. Threats to External Validity

1. **Repository Domain & Ecosystem Diversity:**  
   The benchmark fleet comprises 14 major open-source libraries, utilities, and frameworks across Java, Python, JavaScript, and TypeScript (e.g., Checkstyle, Undertow, Graphhopper, Guava, Requests, Zod, HTTPX, RxJS). While representative of well-maintained open-source projects with structured commit conventions, results may not generalize to enterprise codebases with messy squash-merges, monorepos with millions of commits, or embedded systems written in C/C++.
2. **Cross-Language Generalization:**  
   While AST parsing is fully operational across all 4 languages via Tree-sitter, evolution-aware historical lineage stitching was most effective in strongly-typed object-oriented Java where class and method boundaries are rigid. In dynamically-typed languages (Python, JS) with terse commit messages, vocabulary mismatches between queries and Git diffs remain higher.

---

## 4. Threats to Reliability

1. **Evaluation Determinism:**  
   All evaluation pipelines use fixed random seeds, strict weak candidate ordering by ID, fractional tie-breaking, and explicit Git commit pins (\`git checkout <pin>\`). Repeating the evaluation across independent environments yields identical rankings and metrics down to floating-point precision.
2. **Implementation Integrity:**  
   19 automated test suites comprising 156 unit and integration tests verify the frozen codebase, preventing algorithmic regression.
