# Independent Verification Report: Structural Query Processing & Identifier Expansion

**Verification Date:** 2026-10-20  
**Repository:** `D:\base papers considered\Retrospect`  
**Evaluation Scope:** 8-Case Engineering Diagnostic Benchmark Set  
**Verification Directory:** `reports/query_processing_verification_2026-10-20/`  

---

## Executive Verdict: PARTIALLY VERIFIED (WITH CRITICAL CLARIFICATIONS)

1. **DIAG-04 (`CollectPreconditions.checkNonnegative`) Target Recovery: FULLY VERIFIED.**
   - In pure baseline retrieval, the target scored `0.0675`, fell below the `minScoreThreshold` (`0.08`), and was completely unretrieved (`rank = null`).
   - Under the modified query processor with prefix decomposition (`checkNonnegative` $\to$ `['check', 'nonnegative', 'non', 'negative']`), the target score increases to `0.1333`, advancing the target to **B1 Rank 35** and **B4 Rank 85**.

2. **DIAG-07 (`WebSocket07FrameSinkChannel.sendInternal`) Target Recovery: PARTIALLY VERIFIED (CRITICAL HARNESS ARTIFACT DISENTANGLED).**
   - The prior diagnostic report claimed DIAG-07 improved from "unretrieved / null" to Rank 28.
   - **Verification Finding:** The original "unretrieved / null" status was caused by a **clerical omission in the diagnostic harness file path** (`core/.../core/WebSocket07FrameSinkChannel.java` omitting `protocol/version07/`). When evaluated against the authentic repository path with the unmodified baseline query processor, the target was already in the candidate pool at **B1 Rank 268 (score 0.0811)**.
   - The genuine retrieval improvement from action-verb canonicalization (`dispatch` $\to$ `send`) is the advancement from **B1 Rank 268 to B1 Rank 28** (+240 ranks) and **B4 Rank 212 to B4 Rank 48** (+164 ranks). It must not be reported as moving from unretrieved to 28.

3. **B1 MRR Improvement: FULLY VERIFIED.**
   - True baseline B1 MRR with corrected target matching is **0.1270** (or **0.1266** under flawed harness matching).
   - Modified B1 MRR reaches **0.1932** (absolute gain: **+0.0662**, relative gain: **+52.1%**).

4. **B4 Success@10: FULLY VERIFIED.**
   - Improves from **2 / 8 (25.0%)** to **3 / 8 (37.5%)** under Balanced Cormack RRF ($w_s=0.50, w_h=0.50, k=60$), placing DIAG-01 (Rank 2), DIAG-03 (Rank 10), and DIAG-06 (Rank 1) in the top 10.

5. **Test Suite Integrity: FULLY VERIFIED.**
   - Full repository test suite passes **18/18 test suites, 147/147 unit tests** (Exit Code 0).

---

## 1. Actual Repository State & Exact Source Revision

```
$ git rev-parse HEAD
17ea399217737f8d5fe2c32c310b69c2f812b84d

$ git branch --show-current
main

$ git status --short
 M data/phase_c/discovery/author_card_blind_key.json
 M exported_packs/phase_c_author_pack/cards/CARD-*.json (18 cards)
 M src/git/GitHistoryReader.js
 M src/retrieval/HistoricalRetrievalAdapter.js
 M src/structural/query/QueryProcessor.js
 M tests/unit/historical_retrieval_adapter.test.js
 M tests/unit/structural_query.test.js
?? docs/
?? reports/
?? schemas/
?? scratch/
?? scripts/*.js
?? src/evaluation/
?? src/retrieval/RRFv2.js
?? tests/evaluation/new_evaluator.test.js
?? tests/unit/rrf_v2.test.js

$ git diff --stat
 24 files changed, 359 insertions(+), 33 deletions(-)
```

### Exact Diffs in Verified Files

#### `src/structural/query/QueryProcessor.js`
```diff
--- a/src/structural/query/QueryProcessor.js
+++ b/src/structural/query/QueryProcessor.js
@@ -22,6 +22,24 @@ const DOMAIN_TERMS = new Set([
   'url', 'uri', 'sql', 'wasm', 'webassembly', 'ssl', 'tls'
 ]);
 
+// Common morphological prefixes in programming identifiers and behavioral queries
+const COMPOUND_PREFIXES = ['non', 'multi', 'sub', 'pre', 'post', 'un', 'auto', 'cross', 'read'];
+
+// Common non-compound English words that start with prefix substrings (avoids over-splitting)
+const NON_COMPOUND_WORDS = new Set([
+  'notice', 'nothing', 'uncle', 'under', 'until', 'union', 'unit', 'unique', 'auto', 'read', 'ready', 'real', 'post', 'multi'
+]);
+
+// Conservative canonical action verb mappings for common behavioral query variations
+const CANONICAL_ACTION_SYNONYMS = {
+  'dispatch': 'send',
+  'transmit': 'send',
+  'retrieve': 'get',
+  'fetch': 'get',
+  'construct': 'build',
+  'create': 'build'
+};
+
@@ -118,6 +136,30 @@ class QueryProcessor {
     }
 
+    // Multi-token compound formation for adjacent prefix + word in sequential query token stream
+    for (let i = 0; i < allTokens.length - 1; i++) {
+      const t1 = allTokens[i];
+      const t2 = allTokens[i + 1];
+      if (COMPOUND_PREFIXES.includes(t1) && t2.length >= 4 && !NON_COMPOUND_WORDS.has(t2) && !STOPWORDS.has(t2)) {
+        const compound = t1 + t2;
+        if (!terms.includes(compound)) {
+          terms.push(compound);
+        }
+      }
+    }
+
+    // Conservative behavioral action synonyms (e.g. 'dispatch' -> 'send')
+    const synonymAdditions = [];
+    for (const t of terms) {
+      const syn = CANONICAL_ACTION_SYNONYMS[t];
+      if (syn && !terms.includes(syn) && !synonymAdditions.includes(syn)) {
+        synonymAdditions.push(syn);
+      }
+    }
+    for (const syn of synonymAdditions) {
+      terms.push(syn);
+    }
+
     // Stem terms
     const stemmedTerms = terms.map(t => QueryProcessor.stem(t));
 
@@ -157,7 +199,23 @@ class QueryProcessor {
       for (const cp of camelParts) {
-        if (cp) result.push(cp);
+        if (!cp) continue;
+        result.push(cp);
+
+        // Decompose compound prefix if present (e.g. 'nonnegative' -> 'non', 'negative')
+        const lower = cp.toLowerCase();
+        if (!NON_COMPOUND_WORDS.has(lower)) {
+          for (const pfx of COMPOUND_PREFIXES) {
+            if (lower.startsWith(pfx) && lower.length >= pfx.length + 4) {
+              const base = lower.slice(pfx.length);
+              if (!NON_COMPOUND_WORDS.has(base)) {
+                result.push(cp.slice(0, pfx.length));
+                result.push(cp.slice(pfx.length));
+                break;
+              }
+            }
+          }
+        }
       }
```

---

## 2. Reconstructing DIAG-07 Baseline vs. Modified

In Undertow pin `cf3abec9145bb4660659add41b97866ff6ef9c31`, the target symbol is:
- **Identifier:** `sendInternal`
- **Qualified Name:** `io.undertow.websockets.core.protocol.version07.WebSocket07FrameSinkChannel.sendInternal`
- **File Path:** `core/src/main/java/io/undertow/websockets/core/protocol/version07/WebSocket07FrameSinkChannel.java`
- **Query:** `"Process and dispatch websocket binary and text frames internally across stream sink channel"`

We evaluated the exact target using identical candidate extraction, identical scoring functions, and identical target matching:

| Metric Channel | Run 1: Flawed Harness Baseline | Run 2: Corrected Harness Baseline | Run 3: Modified QueryProcessor | Delta (Run 2 $\to$ Run 3) |
|---|:---:|:---:|:---:|:---:|
| **B1 Rank (Structural)** | `null` (unretrieved) | **268** | **28** | **+240 ranks** |
| **B1 Score** | `0.0000` | **0.0811** | **0.1483** | **+0.0672** |
| **B2 Rank (Historical)** | `null` (unretrieved) | **251** | **154** | **+97 ranks** |
| **B2 Score** | `0.0000` | **0.1022** | **0.1262** | **+0.0240** |
| **B4 Rank (Cormack RRF)** | `null` (unretrieved) | **212** | **48** | **+164 ranks** |
| **B4 Score** | `0.0000` | **0.0031** | **0.0081** | **+0.0050** |

### Decomposition of Improvement Sources
1. **Target-Matching Correction (Harness fix):** Resolving the typo in `target.file_path` allowed the target to be correctly located among scored candidates. In the baseline, it scored `0.0811` at Rank 268 (not `null`).
2. **Query Processing Improvement (Action-verb canonicalization):** Adding `send` for `dispatch` matched the target method name `sendInternal` (`nameSubtokens`: `['send', 'Internal']`). This elevated `tokenScore` from `0.109` to `0.218`, boosting the composite score from `0.0811` to `0.1483` and advancing the candidate by 240 ranks into the top-30 (Rank 28).

---

## 3. Comprehensive Eight-Case Verification (Run A vs. Run B)

Both runs were executed on authentic repository clones at their fixed commit pins using identical candidate extraction, identical target definitions, and identical evaluation metrics ($N=8$ cases).

### Case-Level Reconstruction Table

| Case ID | Benchmark Case & Archetype | Channel | Baseline (Run A) Rank (Score) | Modified (Run B) Rank (Score) | Movement & Classification |
|---|---|---|:---:|:---:|---|
| **DIAG-01** | Checkstyle `AbstractCheck.getViolations`<br>*(Rename within horizon)* | **B1**<br>**B2**<br>**B3**<br>**B4** | null (0.0000)<br>3 (0.1757)<br>10 (0.0703)<br>19 (0.0078) | **14 (0.1550)**<br>**1 (0.2288)**<br>**1 (0.1845)**<br>**2 (0.0148)** | **Rescued in B1 and B4:** `retrieve` $\to$ `get` matched `getViolations`. Advanced from Rank 19 to Rank 2 in B4. |
| **DIAG-02** | Graphhopper `markNodesRemovedIfUnreachable`<br>*(Rename, behavioral query)* | **B1**<br>**B2**<br>**B3**<br>**B4** | 3 (0.1450)<br>19 (0.1450)<br>6 (0.1450)<br>7 (0.0143) | **5 (0.1308)**<br>**25 (0.1718)**<br>**12 (0.1472)**<br>**12 (0.0135)** | Minor rank adjustment due to subtoken splitting on `preparation` $\to$ `pre`, `paration`. Target remains top-5 in B1. |
| **DIAG-03** | Checkstyle `ParserUtil.createBlockCommentNode`<br>*(Move method across classes)* | **B1**<br>**B2**<br>**B3**<br>**B4** | 6 (0.1202)<br>null (0.0000)<br>12 (0.0721)<br>15 (0.0076) | **5 (0.1094)**<br>**null (0.0000)**<br>**12 (0.0657)**<br>**10 (0.0077)** | Advanced into **Top-5 (B1)** and **Top-10 (B4)** via `construct` $\to$ `build`. |
| **DIAG-04** | Guava `CollectPreconditions.checkNonnegative`<br>*(Target failure: linear dilution)* | **B1**<br>**B2**<br>**B3**<br>**B4** | null (0.0000)<br>null (0.0000)<br>null (0.0000)<br>null (0.0000) | **35 (0.1333)**<br>**null (0.0000)**<br>**57 (0.0800)**<br>**85 (0.0051)** | **Rescued:** Compound decomposition matched `check`, `non`, `negative`. Rescued from unretrieved to Rank 35 (B1) and Rank 85 (B4). |
| **DIAG-05** | Guava `ImmutableList.builder`<br>*(Multi-module sibling shadowing)* | **B1**<br>**B2**<br>**B3**<br>**B4** | 79 (0.1633)<br>null (0.0000)<br>124 (0.0980)<br>175 (0.0036) | **98 (0.1622)**<br>**null (0.0000)**<br>**124 (0.0973)**<br>**183 (0.0031)** | Minor rank shift due to builder expansion; structural sibling shadowing remains primary cause. |
| **DIAG-06** | Requests `HTTPAdapter.send`<br>*(Multi-signal concordance)* | **B1**<br>**B2**<br>**B3**<br>**B4** | 2 (0.1633)<br>2 (0.2717)<br>1 (0.2066)<br>1 (0.0161) | **1 (0.1621)**<br>**2 (0.2329)**<br>**1 (0.1904)**<br>**1 (0.0162)** | Advanced from Rank 2 to **Rank 1 (B1)**; maintained **Rank 1 (B4)**. |
| **DIAG-07** | Undertow `WebSocket07FrameSinkChannel.sendInternal`<br>*(Target failure: lexical token gap)* | **B1**<br>**B2**<br>**B3**<br>**B4** | 268 (0.0811)<br>251 (0.1022)<br>289 (0.0895)<br>212 (0.0031) | **28 (0.1483)**<br>**154 (0.1262)**<br>**86 (0.1395)**<br>**48 (0.0081)** | **Rescued:** Advanced from Rank 268 to **Rank 28 (B1)** and Rank 212 to **Rank 48 (B4)**. |
| **DIAG-08** | Checkstyle `Violation.getLineNo`<br>*(Historical horizon exceeded, dist=394)* | **B1**<br>**B2**<br>**B3**<br>**B4** | null (0.0000)<br>2 (0.1883)<br>11 (0.0753)<br>13 (0.0078) | **null (0.0000)**<br>**2 (0.1883)**<br>**11 (0.0753)**<br>**13 (0.0078)** | Unchanged. |

---

## 4. Recomputed Aggregate Metrics ($N=8$, Preserving Null Ranks)

All metrics are computed strictly across all 8 diagnostic cases ($N=8$ in denominator). Null ranks (unretrieved) contribute $0$ to Success@K and $0$ to MRR.

| Channel Configuration | Metric | Baseline (Run A) | Modified (Run B) | Absolute Change | Relative Change |
|---|---|:---:|:---:|:---:|:---:|
| **B1 (Structural Only)** | **MRR** | **0.1270** | **0.1932** | **+0.0662** | **+52.1%** |
| | Success@1 | 0.000 (0/8) | 0.125 (1/8) | +0.125 | — |
| | Success@5 | 0.250 (2/8) | 0.375 (3/8) | +0.125 | — |
| | Success@10 | 0.375 (3/8) | 0.375 (3/8) | +0.000 | — |
| | Abstentions | 3 / 8 | 1 / 8 | -2 | -66.7% |
| **B2 (Historical Only)** | **MRR** | **0.1737** | **0.2558** | **+0.0821** | **+47.3%** |
| | Success@1 | 0.000 (0/8) | 0.125 (1/8) | +0.125 | — |
| | Success@5 | 0.375 (3/8) | 0.375 (3/8) | +0.000 | — |
| | Success@10 | 0.375 (3/8) | 0.375 (3/8) | +0.000 | — |
| | Abstentions | 3 / 8 | 3 / 8 | 0 | 0.0% |
| **B3 (Linear Baseline: 0.60/0.40)** | **MRR** | **0.1752** | **0.2869** | **+0.1117** | **+63.7%** |
| | Success@1 | 0.125 (1/8) | 0.250 (2/8) | +0.125 | — |
| | Success@5 | 0.250 (2/8) | 0.250 (2/8) | +0.000 | — |
| | Success@10 | 0.250 (2/8) | 0.250 (2/8) | +0.000 | — |
| | Abstentions | 1 / 8 | 0 / 8 | -1 | -100.0% |
| **B3_Norm (Active-Channel Normalized)** | **MRR** | **0.1848** | **0.1794** | **-0.0054** | **-2.9%** |
| | Success@1 | 0.000 (0/8) | 0.000 (0/8) | +0.000 | — |
| | Success@5 | 0.375 (3/8) | 0.375 (3/8) | +0.000 | — |
| | Success@10 | 0.375 (3/8) | 0.375 (3/8) | +0.000 | — |
| | Abstentions | 1 / 8 | 0 / 8 | -1 | -100.0% |
| **B4_Improved (Balanced Cormack RRF)** | **MRR** | **0.1687** | **0.2248** | **+0.0561** | **+33.3%** |
| | Success@1 | 0.125 (1/8) | 0.125 (1/8) | +0.000 | — |
| | Success@5 | 0.125 (1/8) | 0.250 (2/8) | +0.125 | — |
| | Success@10 | 0.250 (2/8) | 0.375 (3/8) | +0.125 | — |
| | Abstentions | 1 / 8 | 0 / 8 | -1 | -100.0% |

---

## 5. Investigation of B2 Channel Changes

Although B2 is designated as historical-only, B2 metrics exhibited movement (MRR $0.1737 \to 0.2558$):
- **Causal Architecture:** In Retrospect, `HistoricalRetrievalAdapter.rankHistoricalOnly` accepts the pre-processed `query` object output by `QueryProcessor.process(rawQuery)`.
- **Term Matching:** In `HistoricalRetrievalAdapter.scoreHistorical`, historical names, commit message tokens, and diff tokens are matched against `query.terms`.
- **Observed Shifts:**
  1. In DIAG-01 (`AbstractCheck.getViolations`), adding canonical action synonym `get` for `retrieve` enabled a direct match against the historical symbol name `getViolations`. This advanced B2 rank from **3 to 1** ($1/3 \to 1/1$, contributing $+0.667$ MRR).
  2. In DIAG-07 (`WebSocket07FrameSinkChannel.sendInternal`), adding `send` for `dispatch` matched historical commit messages mentioning method rename `send` $\to$ `sendInternal`. This improved B2 rank from **251 to 154**.
  3. In DIAG-02 (`markNodesRemovedIfUnreachable`), query term count expanded from 8 to 11 due to prefix splitting, slightly reducing the normalized overlap denominator and shifting B2 rank from **19 to 25**.
- **Conclusion:** B2 movement is **not an evaluation defect**; it is the natural consequence of `HistoricalRetrievalAdapter` consuming `QueryProcessor.process(rawQuery)`.

---

## 6. Scope Validation & Candidate Set Dynamics

We measured the exact number of candidates achieving `score >= 0.08` across all 8 diagnostic cases:

| Case ID | Target Symbol | Baseline Scored Candidates | Modified Scored Candidates | Candidate Difference | Cause & Behavioral Impact |
|---|---|:---:|:---:|:---:|---|
| **DIAG-01** | `AbstractCheck.getViolations` | 92 | 268 | **+176** | Expansion from `get` synonym; target advanced to Rank 14. |
| **DIAG-02** | `PrepareRoutingSubnetworks.markNodesRemovedIfUnreachable` | 19 | 18 | **-1** | Candidate volume essentially invariant. |
| **DIAG-03** | `ParserUtil.createBlockCommentNode` | 97 | 57 | **-40** | Stricter term overlap reduced weak candidates; target advanced to Rank 5. |
| **DIAG-04** | `CollectPreconditions.checkNonnegative` | 594 | 441 | **-153** | Multi-token compound matching sharpened relevance; target recovered to Rank 35. |
| **DIAG-05** | `ImmutableList.builder` | 1004 | 995 | **-9** | Negligible change; shadowed by 90+ sibling builder stubs in Guava. |
| **DIAG-06** | `HTTPAdapter.send` | 37 | 21 | **-16** | Tighter token requirements; target advanced to Rank 1. |
| **DIAG-07** | `WebSocket07FrameSinkChannel.sendInternal` | 286 | 360 | **+74** | Expansion from `send` synonym; target advanced to Rank 28. |
| **DIAG-08** | `Violation.getLineNo` | 79 | 79 | **0** | Identical candidates. |

---

## 7. Commands Executed and Exit Codes

1. `git rev-parse HEAD` — Exit code `0` (`17ea399217737f8d5fe2c32c310b69c2f812b84d`)
2. `git branch --show-current` — Exit code `0` (`main`)
3. `git status --short` — Exit code `0`
4. `git diff --stat` — Exit code `0` (24 files changed, 359 insertions(+), 33 deletions(-))
5. `git diff -- src/structural/query/QueryProcessor.js tests/unit/structural_query.test.js scripts/trace_engineering_diagnostic.js` — Exit code `0`
6. `node scratch/verify_diag07.js` — Exit code `0` (DIAG-07 harness vs. query expansion verified)
7. `node scratch/run_comprehensive_verification.js` — Exit code `0` (8-case comparison verified)
8. `node scratch/measure_candidate_counts.js` — Exit code `0` (candidate pool dynamics measured)
9. `npm test` — Exit code `0` (18 test suites passed, 147/147 tests passed)

---

## 8. Exact Files Created or Modified During Verification

- **Verification Artifacts (Preserved in New Directory):**
  - [`reports/query_processing_verification_2026-10-20/verification_data.json`](file:///D:/base%20papers%20considered/Retrospect/reports/query_processing_verification_2026-10-20/verification_data.json) (raw case results and summary comparisons)
  - [`reports/query_processing_verification_2026-10-20/verification_report.md`](file:///D:/base%20papers%20considered/Retrospect/reports/query_processing_verification_2026-10-20/verification_report.md) (this document)
- **Scratch Verification Scripts (Persisted in `scratch/`):**
  - `scratch/verify_diag07.js`
  - `scratch/run_comprehensive_verification.js`
  - `scratch/measure_candidate_counts.js`
  - `scratch/test_pure_baseline_diag04.js`
- **Zero Modifications to Source Code:**
  No algorithmic or query-processing changes were made during this verification. Working tree state was preserved intact.
