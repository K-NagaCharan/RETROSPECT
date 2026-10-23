# Retrospect: Engineering Reproducibility Record

**Project:** Retrospect: Evolution-Aware Context Retrieval for Repository-Level LLMs  
**Date:** 2026-10-20  
**Baseline Git Commit SHA:** `17ea399217737f8d5fe2c32c310b69c2f812b84d`  
**Execution Environment:** Node.js v22.17.1 (win32 x64) on Windows 11 Enterprise  
**Workspace Root:** `D:/base papers considered/Retrospect`  
**Repository Clones Root:** `D:/clones`  

---

## 1. Working Tree & Git State

- **Branch:** `main` (synchronized with commit `17ea399217737f8d5fe2c32c310b69c2f812b84d`)
- **Working Tree Status:** Clean with isolated changes in `src/retrieval/RRFv2.js`, `src/evaluation/RetrospectEvaluator.js`, `src/git/GitHistoryReader.js`, `src/retrieval/HistoricalRetrievalAdapter.js`, `tests/unit/historical_retrieval_adapter.test.js`, `tests/unit/rrf_v2.test.js`, and `scripts/trace_engineering_diagnostic.js`.

---

## 2. Relevant Source & Test File SHA-256 Hashes

| File Path | SHA-256 Checksum |
| :--- | :--- |
| `src/retrieval/RRFv2.js` | `D1E555D9640BD95D195BF7FA151D27C8875C2E1B89BEAD9BF59479A4A30D6E21` |
| `src/evaluation/RetrospectEvaluator.js` | `485C89F064610978ABA153BD5B77B26EF8ABEF2220CDA9CC3FEC81CC6C00E00D` |
| `src/git/GitHistoryReader.js` | `F1A097980B38B9BEC49C3569FF6EB8C31357F59D2397C24ABEC47F17D9DC1142` |
| `src/retrieval/HistoricalRetrievalAdapter.js` | `F531306853D27818844E96BB95B5BFBC57B797BD60F91DFCCD93697331C8E96D` |
| `tests/unit/historical_retrieval_adapter.test.js` | `3764B22F9DD27261941C5423D3E5AE5A435E7F9DC4966C8964B61556D80F19D5` |
| `tests/unit/rrf_v2.test.js` | `D45081244ED76EB89375C39A6C770F5756ECD8AB500CE941810362D4DEDB25AD` |
| `scripts/trace_engineering_diagnostic.js` | `76698A176D53D9CA916638A575ACE87031D1EDA669DB33CFEDA6027B78A7901D` |

---

## 3. Engineering Diagnostic Cases & Repository Pins

| Case ID | Repository Name | Local Clone Directory | Evaluated Pinned Commit SHA | Target Symbol |
| :--- | :--- | :--- | :--- | :--- |
| **DIAG-01** | `checkstyle/checkstyle` | `D:/clones/checkstyle` | `10a3a0777ced10983ebe6266c998957c10dba8f0` | `AbstractCheck.getViolations` |
| **DIAG-02** | `graphhopper/graphhopper` | `D:/clones/graphhopper` | `c7497d1100a4f05ddf5cc630692cbe8046b98114` | `PrepareRoutingSubnetworks.markNodesRemovedIfUnreachable` |
| **DIAG-03** | `checkstyle/checkstyle` | `D:/clones/checkstyle` | `10a3a0777ced10983ebe6266c998957c10dba8f0` | `ParserUtil.createBlockCommentNode` |
| **DIAG-04** | `google/guava` | `D:/clones/guava` | `db74bd2fdac443223d45e6fc5c66548542be1081` | `CollectPreconditions.checkNonnegative` |
| **DIAG-05** | `google/guava` | `D:/clones/guava` | `db74bd2fdac443223d45e6fc5c66548542be1081` | `ImmutableList.builder` |
| **DIAG-06** | `psf/requests` | `D:/clones/requests` | `147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4` | `HTTPAdapter.send` |
| **DIAG-07** | `undertow-io/undertow` | `D:/clones/undertow` | `cf3abec9145bb4660659add41b97866ff6ef9c31` | `WebSocket07FrameSinkChannel.sendInternal` |
| **DIAG-08** | `checkstyle/checkstyle` | `D:/clones/checkstyle` | `10a3a0777ced10983ebe6266c998957c10dba8f0` | `Violation.getLineNo` |

---

## 4. Verification Commands & Exit Status

| Verification Step | Exact Command Executed | Exit Code | Outcome |
| :--- | :--- | :---: | :--- |
| **RRF-v2 Unit & Regression** | `npx jest --runInBand tests/unit/rrf_v2.test.js` | `0` | **17/17 tests PASS** |
| **Historical Adapter Tests** | `npx jest --runInBand tests/unit/historical_retrieval_adapter.test.js` | `0` | **22/22 tests PASS** |
| **Full Automated Test Suite** | `npm test` | `0` | **18/18 test suites PASS (140/140 tests)** |
| **Diagnostic Trace** | `node scripts/trace_engineering_diagnostic.js` | `0` | **All 8 diagnostic cases executed end-to-end** |
| **CSV Generation** | `node scripts/generate_diagnostic_case_results_csv.js` | `0` | **Generated 48-row case results CSV** |

---

## 5. Baseline Reproducibility & Known Limitations

- **Baseline Reproducibility:** Fully reproducible. All clone directories are clean and checkout pins are detached at exact git commit SHAs. Baseline static linear fusion ($w_s=0.60, w_h=0.40$, unnormalized), active-channel normalized linear fusion, baseline asymmetric RRF ($w_s=0.60, w_h=0.40$), and modified balanced RRF ($w_s=0.50, w_h=0.50$) are evaluated simultaneously on identical candidate pools within `scripts/trace_engineering_diagnostic.js`.
- **Known Limitations:**
  1. The 8-case Engineering Diagnostic Set is designed exclusively for implementation tracing, bottleneck identification, and regression verification. It is not a confirmatory benchmark.
  2. Large multi-module repositories (Guava with 66,211 symbols) exhibit 7–19 second query times due to sequential candidate scoring in `StructuralRetriever`. Candidate pre-filtering achieves at best 1.2x–2.4x speedup on multi-word queries, but causes candidate truncation and can be slower on common words.
  3. Linear fusion without cross-channel score calibration suffers from scale mismatch between structural and historical scores, making active-channel normalization susceptible to noise inflation.
