# Summary of Unresolved & Partially Verified Cases: Category B Benchmark

**Document:** Unresolved Case Ledger and Human Adjudication Requirements  
**Benchmark Suite:** Category B Repaired Historical Retrieval Suite ($N=29$)  
**Date:** 2026-10-19  
**Adjudication Standard:** 5-Level Verification Rubric (`ground_truth_verification_rubric.md`)  

---

## 1. Executive Summary & Verification Census

While 100% of the 29 Category B cases have been successfully repaired to pass schema validation and now include authentic AST-derived hard negative distractors, **zero cases have been promoted to fully `VERIFIED` status**.

All 29 cases remain classified as **`PARTIALLY VERIFIED`** pending manual human adjudication.

### Case Census Table

| Status Category | Count | Percentage | Operational Meaning |
|---|---:|---:|---|
| **Fully Repaired (Schema Valid)** | **29** | **100.0%** | Conforms to `retrieval-case.schema.json` with 0 validation errors. |
| **Failing Schema Validation** | **0** | **0.0%** | Zero schema defects remain. |
| **Evidence-Supported Hard Negatives** | **29** | **100.0%** | 58 authentic AST method declarations populated (2 per case). |
| **Fully `VERIFIED` Ground Truth** | **0** | **0.0%** | No case has completed independent manual human adjudication. |
| **`PARTIALLY VERIFIED` Ground Truth** | **29** | **100.0%** | Authentic Git DAG commits and diffs verified; awaiting human sign-off. |
| **`UNVERIFIED` / Fabricated Cases** | **0** | **0.0%** | All 29 evaluation pins and origin commits exist in authentic repositories. |
| **`CONTRADICTED` Lineages** | **0** | **0.0%** | Zero cases were contradicted by Git DAG history. |
| **Cases Exceeding 50-Commit Horizon** | **20** | **69.0%** | Historical lookback depth ($k=50$) is insufficient to reach the origin commit. |
| **Cases Awaiting Human Adjudication** | **29** | **100.0%** | Mandatory protocol requirement before confirmatory use. |

---

## 2. Core Drivers of the "Partially Verified" Classification

Three foundational issues prevent these cases from serving as gold-standard ground truth without human adjudication:

```
+-----------------------------------------------------------------------------------+
|               PARTIALLY VERIFIED CATEGORY B BENCHMARK ($N=29$)                    |
+-----------------------------------------------------------------------------------+
       |                                      |                                  |
       v                                      v                                  v
+-------------------------------+ +--------------------------------+ +----------------------------------+
| 1. Automated Extraction Gap   | | 2. Commit Horizon Exhaustion   | | 3. Synthetic Template Bias       |
| - RefactoringMiner oracle     | | - 20 of 29 cases > 50 commits  | | - Rigid "Locate current..."      |
| - No human validation of API  | | - Origin commits up to 637     | | - Lacks natural language variance|
|   contract or semantic drift  | |   commits prior to snapshot    | | - Queries explicitly leak name   |
+-------------------------------+ +--------------------------------+ +----------------------------------+
```

---

## 3. Case-by-Case Ledger of Partially Verified Cases

The table below catalogs each case, its commit distance from origin to evaluation pin, and the specific evidentiary prerequisites required for promotion to `VERIFIED`:

| Case ID | Repository | Target Symbol | Commit Distance | Historical Retrieval Prediction | Mandatory Action Required for Full Verification |
|---|---|---|---:|---|---|
| `CASE-HIST-JAVA-0105` | `graphhopper/graphhopper` | `PrepareRoutingSubnetworks.markNodesRemovedIfUnreachable` | 40 | Top-K (Within horizon) | Human sign-off on rename equivalence from `removeZeroDegreeNodes`. |
| `CASE-HIST-JAVA-0035` | `datastax/java-driver` | `Connection.Dispatcher.channelRead0` | **628** | Unretrieved (Horizon exceeded) | Human audit of Netty pipeline migration; evaluate with extended history horizon ($k \ge 650$). |
| `CASE-HIST-JAVA-0096` | `graphhopper/graphhopper` | `CHGraphImpl.getEdgeIteratorState` | **64** | Unretrieved (Horizon exceeded) | Human audit of interface extraction; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0099` | `graphhopper/graphhopper` | `Graph.getEdgeIteratorState` | **64** | Unretrieved (Horizon exceeded) | Human audit of base graph interface contract; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0058` | `graphhopper/graphhopper` | `DijkstraBidirectionRef.isWeightLimitExceeded` | **259** | Unretrieved (Horizon exceeded) | Human audit of condition logic rename; evaluate with extended history horizon ($k \ge 300$). |
| `CASE-HIST-JAVA-0029` | `checkstyle/checkstyle` | `ElementNode.compareCommonAncestorChildrenOrder` | **391** | Unretrieved (Horizon exceeded) | Human audit of XPath traversal refactoring; evaluate with extended history horizon ($k \ge 400$). |
| `CASE-HIST-JAVA-0101` | `graphhopper/graphhopper` | `GraphHopper.putAlgorithmFactory` | **62** | Unretrieved (Horizon exceeded) | Human audit of algorithm factory registration change; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0020` | `checkstyle/checkstyle` | `Violation.getCustomViolation` | 36 | Top-K (Within horizon) | Human sign-off on `getCustomMessage` -> `getCustomViolation` rename. |
| `CASE-HIST-JAVA-0055` | `graphhopper/graphhopper` | `AStarBidirection.isWeightLimitExceeded` | **259** | Unretrieved (Horizon exceeded) | Human audit of A* traversal termination logic; evaluate with extended history horizon ($k \ge 300$). |
| `CASE-HIST-JAVA-0097` | `graphhopper/graphhopper` | `QueryGraph.getEdgeIteratorState` | **64** | Unretrieved (Horizon exceeded) | Human audit of virtual edge iterator override; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0078` | `graphhopper/graphhopper` | `GraphHopper.setGraphHopperStorage` | **157** | Unretrieved (Horizon exceeded) | Human audit of storage encapsulation setter; evaluate with extended history horizon ($k \ge 200$). |
| `CASE-HIST-JAVA-0047` | `undertow-io/undertow` | `WebSocket07FrameSinkChannel.sendInternal` | 40 | Top-K (Within horizon) | Human audit of WebSocket sink channel internal framing logic. |
| `CASE-HIST-JAVA-0005` | `checkstyle/checkstyle` | `WhitespaceAroundCheck.isEmptyCtorBlockCheckedFromRcurly` | 47 | Top-K (Within horizon) | Human audit of block parsing helper method rename. |
| `CASE-HIST-JAVA-0039` | `datastax/java-driver` | `QueryLogger.Builder.withConstantThreshold` | **568** | Unretrieved (Horizon exceeded) | Human audit of threshold builder migration; evaluate with extended history horizon ($k \ge 600$). |
| `CASE-HIST-JAVA-0043` | `undertow-io/undertow` | `AbstractFramedStreamSinkConduit.flushQueuedData` | **59** | Unretrieved (Horizon exceeded) | Human audit of conduit flush queue semantics; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0044` | `undertow-io/undertow` | `AjpClientResponseStreamSourceChannel.updateFrameDataRemaining` | **52** | Unretrieved (Horizon exceeded) | Human audit of AJP protocol framing method; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0019` | `checkstyle/checkstyle` | `Violation.getViolation` | 36 | Top-K (Within horizon) | Human sign-off on core `getMessage` -> `getViolation` rename. |
| `CASE-HIST-JAVA-0013` | `checkstyle/checkstyle` | `AbstractCheck.getViolations` | 36 | Top-K (Within horizon) | Human sign-off on check collection accessor rename. |
| `CASE-HIST-JAVA-0036` | `datastax/java-driver` | `Connection.Dispatcher.userEventTriggered` | **628** | Unretrieved (Horizon exceeded) | Human audit of idle event handler migration; evaluate with extended history horizon ($k \ge 650$). |
| `CASE-HIST-JAVA-0046` | `undertow-io/undertow` | `StreamSourceFrameChannel.processFrameData` | **52** | Unretrieved (Horizon exceeded) | Human audit of stream frame processor rename; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0048` | `undertow-io/undertow` | `LimitedBufferSlicePool.PooledByteBuffer.getBuffer` | 23 | Top-K (Within horizon) | Human audit of buffer slice resource accessor rename. |
| `CASE-HIST-JAVA-0045` | `undertow-io/undertow` | `AbstractFramedStreamSourceChannel.updateFrameDataRemaining` | **52** | Unretrieved (Horizon exceeded) | Human audit of framed stream source channel framing method; evaluate with extended history horizon ($k \ge 100$). |
| `CASE-HIST-JAVA-0001` | `checkstyle/checkstyle` | `TrailingCommentCheck.isLegalSingleLineComment` | **187** | Unretrieved (Horizon exceeded) | Human audit of single-line comment check rename; evaluate with extended history horizon ($k \ge 200$). |
| `CASE-HIST-JAVA-0050` | `undertow-io/undertow` | `ReferenceCountedPooled.createView.new.close` | 23 | Top-K (Within horizon) | Human audit of anonymous inner class view resource discard lifecycle. |
| `CASE-HIST-JAVA-0049` | `undertow-io/undertow` | `ReferenceCountedPooled.getBuffer` | 23 | Top-K (Within horizon) | Human audit of pooled resource accessor rename. |
| `CASE-HIST-JAVA-0028` | `checkstyle/checkstyle` | `ElementNode.getAttributeNode` | **394** | Unretrieved (Horizon exceeded) | Human audit of XPath attribute creation vs node retrieval; evaluate with extended history horizon ($k \ge 400$). |
| `CASE-HIST-JAVA-0031` | `checkstyle/checkstyle` | `NewHandler.doesChainedMethodNeedsLineWrapping` | **372** | Unretrieved (Horizon exceeded) | Human audit of indentation line wrapping check rename; evaluate with extended history horizon ($k \ge 400$). |
| `CASE-HIST-JAVA-0038` | `datastax/java-driver` | `Connection.Initializer.initChannel` | **628** | Unretrieved (Horizon exceeded) | Human audit of Netty pipeline initialization refactoring; evaluate with extended history horizon ($k \ge 650$). |
| `CASE-HIST-JAVA-0034` | `datastax/java-driver` | `ArrayBackedRow.getValue` | **637** | Unretrieved (Horizon exceeded) | Human audit of row column accessor unification; evaluate with extended history horizon ($k \ge 650$). |

---

## 4. Specific Action Plan to Promote Cases to Verified Status

To transition Category B from `PARTIALLY VERIFIED` to `VERIFIED`:

1. **Protocolized Human Adjudication Pass:**
   - Appoint two independent software engineering reviewers.
   - For each case, reviewers must inspect the commit diff at the origin SHA and verify whether the successor method in `target_symbols` preserves the functional intent of the query.
   - Any cases where an API was deleted and replaced by a completely disparate architecture must be classified as `UNANSWERABLE_OBSOLETE` rather than `ANSWERABLE`.

2. **Decouple Commit Horizon Evaluation:**
   - Execute the proposed history lookback experiment (`history_lookback_experiment_plan.md`) with adaptive traversal ($k \ge 700$ or `git log --follow`) to demonstrate whether the 20 historical abstentions resolve into successful retrievals.

3. **Natural Query Variation:**
   - Replace synthetic templated queries (`"Locate current implementation corresponding to..."`) with human-authored developer queries (e.g., describing the deprecated API or the task requiring migration).
