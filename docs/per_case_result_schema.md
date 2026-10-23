# Retrospect Per-Case Evaluation Result Schema

**Version:** 2.0  
**Date:** 2026-10-19  
**Status:** Canonical Result Schema  

---

## 1. Overview

This document specifies the standard schema for per-case evaluation outputs across all configurations (**B1**, **B2**, **B3**, **B4**). The schema explicitly separates **Historical Reachability (Stage A)**, **Historical Detection (Stage B)**, and **Candidate Ranking (Stage C)** to prevent conflating unreachable history with failed ranking algorithms.

---

## 2. Per-Case Result Structure

Each evaluated case generates a result record with the following structure:

```json
{
  "case_id": "CASE-HIST-0001",
  "origin_commit_cluster": "5de36fdaf4f95d13dae72a4401c1f77649d21226",
  "repository": "google/guava",
  "language": "Java",
  "category": "historical_evolution",
  "split": "val",
  "contains_historical_identifier": false,
  "commit_distance_origin_to_pin": 4149,
  "distance_band": ">500",
  
  "historical_evaluation": {
    "stage_a_reachability": {
      "origin_commit_in_dag": true,
      "origin_in_search_scope": false,
      "historical_evidence_discovered": false,
      "reachability_status": "EXCEEDED_SEARCH_SCOPE",
      "exclusion_reason": "Origin commit at distance 4149 exceeds configured lookback horizon of 50 commits."
    },
    "stage_b_detection": {
      "relationship_detected": false,
      "match_status": "unmatched",
      "evidence_supporting_match": "None; zero commits discovered touching predecessor symbol in search window."
    }
  },

  "configurations": {
    "b1_structural": {
      "target_rank": 4,
      "target_score": 0.1764,
      "success_at_10": true,
      "recall_at_1": false,
      "recall_at_5": true,
      "reciprocal_rank": 0.25,
      "abstained": false,
      "target_absent_from_pool": false,
      "latency_ms": 420.5
    },
    "b2_historical": {
      "target_rank": null,
      "target_score": 0.0,
      "success_at_10": false,
      "recall_at_1": false,
      "recall_at_5": false,
      "reciprocal_rank": 0.0,
      "abstained": true,
      "target_absent_from_pool": false,
      "latency_ms": 182.2
    },
    "b3_linear": {
      "target_rank": 45,
      "target_score": 0.1058,
      "success_at_10": false,
      "recall_at_1": false,
      "recall_at_5": false,
      "reciprocal_rank": 0.0222,
      "abstained": false,
      "target_absent_from_pool": false,
      "latency_ms": 612.8
    },
    "b4_rrf": {
      "target_rank": 15,
      "target_score": 0.009375,
      "success_at_10": false,
      "recall_at_1": false,
      "recall_at_5": false,
      "reciprocal_rank": 0.0667,
      "abstained": false,
      "target_absent_from_pool": false,
      "latency_ms": 625.0
    }
  },

  "latency": {
    "total_end_to_end_ms": 625.0,
    "components": {
      "t_structural_ms": 420.5,
      "t_historical_ms": 182.2,
      "t_fusion_ms": 22.3
    },
    "amortized_indexing_excluded": true
  }
}
```

---

## 3. The Three Evaluation Stages

### Stage A: Reachability
- **`origin_commit_in_dag` (boolean):** Verified via `git cat-file -e <origin_commit>`.
- **`origin_in_search_scope` (boolean):** Verified whether `origin_commit` is within the configured lookback horizon ($k$).
- **`historical_evidence_discovered` (boolean):** Did the historical retriever locate any relevant commits touching the symbol/file?
- **`reachability_status` (enum):** `"REACHABLE"`, `"EXCEEDED_SEARCH_SCOPE"`, `"MISSING_FROM_DAG"`, `"UNTRACKED_FILE"`.

### Stage B: Detection
- **`relationship_detected` (boolean):** Did the historical tracker successfully map the predecessor to the successor target?
- **`match_status` (enum):** `"matched"`, `"ambiguous"`, `"unmatched"`.
- **`evidence_supporting_match` (string):** Diffs, commit messages, or AST matching proofs supporting the link.

### Stage C: Ranking (Evaluated per Configuration)
- **`target_rank` (integer or null):** Rank of true target in the final sorted candidate list.
- **`success_at_10` (boolean):** $r \in [1, 10]$.
- **`recall_at_1` (boolean):** $r = 1$.
- **`recall_at_5` (boolean):** $r \in [1, 5]$.
- **`reciprocal_rank` (float):** $1.0 / r$ (or $0.0$ if unretrieved).
- **`abstained` (boolean):** True if channel score is $0.0000$.
- **`target_absent_from_pool` (boolean):** True if target was completely omitted from the candidate universe.
