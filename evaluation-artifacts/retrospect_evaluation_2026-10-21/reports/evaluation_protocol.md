# Evaluation protocol — pre-registered (fixed 2026-10-21/22, before any result on this dataset)

## 1. Systems compared

These are Retrospect's existing configurations, unchanged. The harness ranking code is copied from the worker and was verified to reproduce E2's 136/136 ranks (`evaluation/harness_equivalence/`).

| Name | Method |
|---|---|
| `B1_structural_only` | `StructuralRetriever` over the current repository at the pin |
| `B2_historical_only` | `HistoricalRetrievalAdapter` (merge-aware `--topo-order`, window H) |
| `B3_linear_fusion_0.6S_0.4H` | `HistoricalRetrievalAdapter.fuseScores` |
| `B4_rrf_v2_k60_0.5_0.5` | `fuseRRFv2` with zero-signal gating |

**History-window ablation:** H ∈ {50 (system default), 400 (reach setting used in E3)}. B1 is the no-history control.

**No tuning:** no parameter, threshold or weight is changed for or during this evaluation.

## 2. Tasks and queries

All queries are derived deterministically from repository evidence (`scripts/query_validation/build_cases.js`); none is hand- or LLM-written.

| Task | Query | Accepted target | Role |
|---|---|---|---|
| **B_identifier** (primary) | Old simple name of a renamed predecessor | The successor at the pin (unique, qualified match) | Historical predecessor → current successor |
| C_docstring | First sentence of the **old** docstring (excluded if it names the new symbol) | Same | Evolution-aware behavioural query (secondary) |
| A_current_doc | First sentence of the successor's **current** docstring | Same | Structural baseline task (secondary) |
| D_negative | Name of a callable deleted with no successor (body not found elsewhere in the commit; name absent from the repository after the commit and at the pin) | None | False-lineage check (descriptive) |

**Task B labels:** `strict_rename`, `rename_signature_change`, `rename_move` (machine-verified, `reports/ground_truth_protocol.md`).

## 3. Primary analysis (per language, held-out test split)

- **Population:** `held_out_test` cases with task `B_identifier`, target indexed, and evolution commit **inside the H = 400 window and diffed** (`reach_status = IN_WINDOW`, `origin_diff_analyzed = true`).
- **Comparison:** B4 vs B1. Statistic: mean over clusters of the cluster-mean (RR_B4 − RR_B1), where RR = 1/rank and unranked = 0.
- **Test:** two-sided sign-flip test over clusters.
  - Exact enumeration if there are ≤ 20 clusters.
  - Otherwise Monte Carlo with 100,000 sign assignments, seed 20261021, p = (count + 1)/(N + 1).
  - 95% CI: cluster bootstrap percentile, 10,000 resamples, seed 20261021.
- **Multiplicity:** Holm correction across the 4 languages.
- **Decision per language:**
  - **Supported:** ΔMRR > 0, Holm-adjusted p < 0.05, harms@10 ≤ rescues@10.
  - **Not supported:** ΔMRR ≤ 0, or harms > rescues.
  - **Inconclusive:** otherwise.
  - **Not testable:** fewer than 6 clusters (p < 0.05 unattainable).

## 4. Secondary and descriptive analyses (no confirmatory claims)

- B2 − B1 and B3 − B1 with the same statistic.
- The same comparisons at H = 50, and for all reachability strata (outside the window reported separately as a reachability failure, not a ranking miss).
- Tasks C, A and D. **For D:** rate of B2 top-10 candidates claiming the deleted name as a historical name (false lineage claim). There is no abstention mechanism, so abstention accuracy is not measurable.
- **Breakdowns** by language, repository, lineage label, reachability, name subtoken overlap (difficulty) and B1 success.
- **Development and validation splits:** descriptive only.
- **Pooled four-language** cluster-level estimate: descriptive, labelled as such.

## 5. Definitions (fixed before results)

| Term | Definition |
|---|---|
| Rescue@10 | B1 rank > 10 or unranked, and the compared configuration ≤ 10 |
| Harm@10 | B1 ≤ 10, and the compared configuration > 10 or unranked |
| Improvement / regression | Both ranked, same top-10 status, rank decreased / increased |
| Not retrieved | Configuration gives the target no positive score |
| Not indexed | No indexed symbol matches the target (a parser or indexing failure, reported separately) |

## 6. Power (from `scripts/evaluation/power_analysis.py`)

| Item | Value |
|---|---|
| SD of cluster deltas (E3 estimate) | 0.19 |
| MDE at 80% power (α = 0.05) | 0.168 / 0.119 / 0.084 for 10 / 20 / 40 clusters |
| Clusters needed for E3's effect (0.107) | 25 (α = 0.05), 36 (Holm, 4 languages) |

## 7. Integrity

- Ground truth, queries and splits are frozen (`manifests/event_checksums.json`, `manifests/split_manifest.json`) **before** the benchmark runs.
- Results are written to new folders only.
- Any deviation from this protocol must be reported as a deviation.

## 8. Deviations (recorded before any result was read)

**2026-10-22: Tree-sitter WASM abort.** While running the benchmark, the Tree-sitter WASM runtime was found to abort (`ExitStatus exit(1)`) during some long history passes (guava, H = 400). After an abort, every later parse in that process fails silently.

**Harness changes** (Retrospect's code is unchanged):
- one process per repository;
- abort on an empty index;
- parser-health probes after indexing and after each history pass, recorded per case.

**Analysis changes:**
- The primary analysis is unchanged. It measures Retrospect as it actually runs, including any truncated history.
- An added **sensitivity analysis** restricts the primary population to snapshots whose parser stayed healthy through the H = 400 pass.
- Repositories affected by the abort are listed in the diagnostics.
