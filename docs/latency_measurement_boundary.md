> Applies to the 2026-10-19 evaluator-preparation phase (`t_struct` / `t_hist` / `t_fusion_*` timing in `src/evaluation/RetrospectEvaluator.js`). Note: structural scoring is `StructuralRetriever`'s multi-signal weighted scorer, not BM25. See [DOCS_INDEX.md](DOCS_INDEX.md).

# Standardized Latency Measurement Boundary Specification

**Version:** 1.0  
**Date:** 2026-10-19  
**Status:** Canonical Evaluation Standard  

---

## 1. Problem Statement & Legacy Flaw

The prior diagnostic audit (`RETROSPECT_DIAGNOSTIC_FAILURE_AUDIT_AND_DECISION.md:82-92`) identified a fatal scope mismatch in legacy latency reporting:
- **Configuration B1** timed the entire un-indexed in-memory array scan across all 66,297 symbols in Guava (~11,000 ms).
- **Configurations B3 and B4** timed only the lightweight array-merging step over pre-filtered candidate lists (50–100 items), reporting ~120–210 ms.

This generated the illusory impression that B4 was 50 times faster than B1, whereas in real-world deployment B4 must execute both structural search and historical search before performing fusion.

---

## 2. Standardized Timing Decomposition

To establish fair, reproducible latency comparisons, Retrospect defines four distinct timing phases:

```
+-----------------------------------------------------------------------------------------+
| Phase 0: Offline / Amortized Snapshot Indexing                                         |
| (Excludes from per-query retrieval latency; reported once per snapshot)                |
| - AST Parsing, Symbol Extraction, Token Postings Construction                          |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Phase 1: Query-Time Structural Retrieval (t_struct)                                     |
| - Query normalization, BM25 scoring over pre-indexed symbol pool                        |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Phase 2: Query-Time Historical Retrieval (t_hist)                                       |
| - Git log traversal (k commits), commit diff token matching, history scoring            |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| Phase 3: Score Fusion & Final Ranking (t_fusion)                                        |
| - Linear combination (B3) or RRF-v2 zero-signal gating & re-ranking (B4)                |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Configuration-Specific Measurement Boundaries

All configurations are measured using the **Query-Time Execution Boundary**, which begins when a query is submitted to an already-indexed repository snapshot and ends when the final ranked candidate list is returned:

| Configuration | What is Included in Query-Time Latency | Formal Formula |
|---|---|---|
| **B1 (Structural Only)** | Query tokenization + structural candidate scoring. | $L_{B1} = t_{struct}$ |
| **B2 (Historical Only)** | Query tokenization + git log traversal + historical candidate scoring. | $L_{B2} = t_{hist}$ |
| **B3 (Combined Linear)** | Structural retrieval + historical retrieval + linear score combination + sort. | $L_{B3} = t_{struct} + t_{hist} + t_{fusion}^{linear}$ |
| **B4 (Combined RRF-v2)** | Structural retrieval + historical retrieval + zero-signal gating + RRF re-ranking. | $L_{B4} = t_{struct} + t_{hist} + t_{fusion}^{RRF}$ |

### Pre-Condition Invariant:
Symbol index building (AST extraction and candidate tokenization) is amortized and excluded from all per-query measurements. It must be logged once per repository pin commit in `run_metadata.json` under `indexing_cost_ms`.

---

## 4. Per-Case Latency Recording Schema

Every per-case evaluation result must output both the common boundary total latency and its constituent components:

```json
{
  "latency": {
    "total_query_latency_ms": 1145.2,
    "components": {
      "t_structural_ms": 420.1,
      "t_historical_ms": 715.0,
      "t_fusion_ms": 10.1
    },
    "amortized_indexing_excluded": true
  }
}
```

This ensures full transparency and prevents comparing candidate merging against full corpus scans.
