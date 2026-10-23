# Retrospect: Engineering Next Steps & Evidence-Based Roadmap

**Project:** Retrospect: Evolution-Aware Context Retrieval for Repository-Level LLMs  
**Report Date:** 2026-10-20  
**Baseline Commit:** `17ea399217737f8d5fe2c32c310b69c2f812b84d`  
**Workspace:** `D:/base papers considered/Retrospect`  
**Status:** Post-Investigation Engineering Roadmap  

---

## 1. Executive Summary of Engineering Investigations

Following the forensic execution-path audit and the experimental evaluation of the 8-case Engineering Diagnostic Set, three engineering directions were empirically tested:

1. **Option A (Active-Channel Normalization for Linear Fusion):**
   - **Implemented:** Added parameterized active-channel normalization to `HistoricalRetrievalAdapter.fuseScores(..., { normalizeActiveChannels: true })`.
   - **Tested:** Evaluated across unit tests (`tests/unit/historical_retrieval_adapter.test.js`) and the 8 diagnostic cases.
   - **Empirical Finding:** Uncalibrated candidate-level normalization produces net regressions on 4 out of 8 cases (DIAG-02, DIAG-03, DIAG-05, DIAG-06). Because raw historical scores ($0.15–0.30$) exceed structural scores ($0.10–0.16$), removing the channel weight penalty allows incidental historical noise to surpass genuine structural matches. In DIAG-03, target rank dropped from **Rank 15 to Rank 22**. Query-level normalization is a no-op across all 8 cases.
   - **Decision:** Keep active-channel normalization as an optional parameter (`options.normalizeActiveChannels`), but do not make it the default linear fusion strategy without cross-channel score calibration.

2. **Option B (Module-Aware Structural Ranking):**
   - **Investigated:** Examined `google/guava` duplicate classes in `android/guava` and `guava-gwt`.
   - **Finding:** Ad-hoc multipliers ($1.25\times, 0.75\times$) violate experimental integrity and cannot be generalized across Java, Python, JavaScript, and TypeScript.
   - **Decision:** Defer until project build metadata (e.g. Maven POM or Gradle multi-project models) can be parsed deterministically.

3. **Option C (Inverted-Index Candidate Pre-Filtering):**
   - **Investigated:** Built an empirical comparison harness (`scratch/test_prefilter_harness.js`) across Guava (66,211 symbols).
   - **Finding:** The hypothesized $>100\times$ speedup was disproven ($1.2\times–2.4\times$ speedup on multi-word queries; $0.9\times$ slower on common terms). Pre-filtering dropped between 12 and 608 valid non-zero scoring candidates (call-graph reverse callers).
   - **Decision:** Maintain full-pool candidate scoring to preserve benchmark candidate parity and ground truth reachability.

---

## 2. Ranked Engineering Priorities (Based on Verified Evidence)

### Priority 1: Cross-Channel Score Calibration & Rank-Aware Fusion (Resolving Multi-Modal Score Scale Disparities)

- **Observed Evidence:**
  The fundamental failure of linear fusion (B3) is not just missing channel weights, but the incompatibility of score distributions:
  - `StructuralRetriever` scores reflect term frequency, docstring overlap, and call graph boosts, resulting in scores centered around $0.08–0.16$.
  - `HistoricalRetrievalAdapter` scores reflect commit messages, diff tokens, and evolution classifications, resulting in scores centered around $0.15–0.30$.
  Adding raw uncalibrated scores causes historical signals to dominate or allows historical noise to overwhelm structural hits.
- **Proposed Implementation:**
  1. Standardize scores via min-max CDF mapping or z-score normalization across the candidate pool prior to linear combination:
     $$S'_{m}(d) = \frac{S_m(d) - \min_{x} S_m(x)}{\max_{x} S_m(x) - \min_{x} S_m(x)}$$
  2. Maintain Cormack RRF ($w_s=0.50, w_h=0.50$) as the primary non-linear fusion configuration (B4), which inherently operates on rank positions rather than uncalibrated score distributions.
- **Expected Benefit:**
  Eliminates the scale disparity that causes candidate-level normalization to boost historical noise in B3.
- **Regression Risk:** Low.

---

### Priority 2: Semantic Identifier & Token Expansion for Behavioral Queries (Addressing DIAG-04 & DIAG-07)

- **Observed Evidence:**
  In DIAG-04 (`CollectPreconditions.checkNonnegative`) and DIAG-07 (`WebSocket07FrameSinkChannel.sendInternal`), all configurations (B1, B2, B3, B4) failed with score $0.0000$ (`LEXICAL_TOKEN_GAP`).
  The queries used abstract behavioral phrasing ("Check that integer index is non-negative and throw appropriate exception", "Process and dispatch websocket binary and text frames internally across stream sink channel") that contained zero exact token overlaps with method identifiers or AST declarations.
- **Proposed Implementation:**
  1. Enhance `QueryProcessor` with lightweight subtoken expansion and morphological synonym mapping (e.g. `dispatch` $\to$ `send`, `non-negative` $\to$ `check`, `notNegative`, `index`).
  2. Implement phrase-to-identifier compounding in `QueryProcessor.splitIdentifiers` (e.g. matching `checkNonnegative` from query tokens `check` and `non-negative`).
- **Expected Benefit:**
  Directly rescues DIAG-04 and DIAG-07 from the 0.00 score abstention bucket into the candidate pool.
- **Regression Risk:** Moderate. Expansion must be constrained to avoid false positive inflation on large codebases.

---

### Priority 3: Build-Graph-Aware Canonical Root Module Prioritization (Addressing DIAG-05)

- **Observed Evidence:**
  In DIAG-05 (`Guava ImmutableList.builder`), the target implementation in `guava/src/...` ranked at **79** in B1, **121** in B3, and **175** in B4 because identical methods in sibling compatibility modules (`android/guava` and `guava-gwt`) tied or outscored it.
- **Proposed Implementation:**
  1. Parse repository project descriptors:
     - Java: `pom.xml` (`<modules>`), `settings.gradle` (`include`).
     - JavaScript/TypeScript: `lerna.json`, `pnpm-workspace.yaml`, root `package.json` (`workspaces`).
     - Python: root package directory vs sub-packages.
  2. Identify the canonical primary module versus compatibility/stub/platform variants without hardcoding arbitrary path constants ($1.25\times, 0.75\times$).
  3. Apply deterministic tie-breaking preferring the root primary artifact when scores are within epsilon ($\pm 1e-6$).
- **Expected Benefit:**
  Breaks sibling ties in favor of the canonical implementation, advancing `ImmutableList.builder` from Rank 79 into the Top-10.
- **Regression Risk:** Low, because it acts as a tie-breaker on identical or near-identical signatures.

---

## 3. Experimental Integrity & Sequencing Constraints

1. **Isolation Rule:** Implement improvements one at a time with regression tests and before-and-after case traces. Do not combine multiple algorithmic changes in a single commit.
2. **Confirmatory Data Boundary:** Under no circumstances should these improvements be evaluated against sealed confirmatory test splits until the implementation has been completely frozen.
3. **No Aggregate Tuning:** Do not tune weights or thresholds solely to artificially elevate an aggregate metric on the small 8-case diagnostic set.
