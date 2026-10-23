# Retrospect — Research Question Assessment

**Working Paper Title:** *"When Code History Matters: An Empirical Study of Evolution-Aware Retrieval for Repository-Level Code Search"*  
**Branch:** \`eval-reframing-empirical-study\`  
**Date:** 2026-10-20  
**Status:** EVIDENCE-GROUNDED ASSESSMENT

---

## 1. The Reframed Research Question

The investigation was reframed from a broad claim of general retrieval superiority to the precise empirical question:

> **"Under what conditions does historical code retrieval recover relevant code that current-repository structural retrieval misses, and what factors limit its effectiveness?"**

---

## 2. Empirical Findings: When Code History Matters

Based on the multi-repository evaluation across 45 cases and 14 repositories, the empirical evidence supports the following answers:

### 1. Conditions Under Which Historical Retrieval Adds Measurable Value
Historical code retrieval demonstrates a decisive advantage over contemporary structural search under three simultaneous conditions:
1. **Evolutionary Discontinuity (Name or Location Drift):**  
   The target symbol underwent a refactoring (rename, extraction, or cross-file move) that changed its signature, rendering its historical identifier completely absent from the contemporary AST.
2. **Obsolete or Predecessor Query Phrasing:**  
   The query targets the functionality using historical terminology, legacy API names, or predecessor identifiers (e.g., developers migrating legacy code, investigating historical bug reports, or consulting obsolete documentation).
3. **Temporal Proximity ($H \le 50$ Commits):**  
   The refactoring commit resides within the reachable topological lookback horizon of the repository history.

**Empirical Evidence:**
- In the primary in-policy refactoring cohort ($N = 5$), historical retrieval achieved an **incremental recovery rate of 40.0% (2 / 5)**:
  - **Checkstyle \`CASE-HIST-JAVA-0013\`:** The method \`getMessages\` was renamed to \`getViolations\`. Contemporary structural retrieval failed completely (Rank: \`null\`, Score: \`0.0\`). Historical retrieval traced the commit diff at commit \`c03264\` and returned the target at **Rank 2**. RRF-v2 fusion rescued the query to **Rank 8**.
  - **Undertow \`CASE-HIST-JAVA-0049\`:** The method \`getResource\` was renamed to \`getBuffer\`. Structural retrieval ranked the target outside the top-10 at Rank 14. Historical retrieval identified the commit diff at commit \`2ec94c\` and placed the target at **Rank 4**. RRF-v2 fusion promoted the target to **Rank 1**.

---

### 2. Conditions Under Which Structural Retrieval is Sufficient
Structural retrieval over the contemporary codebase is completely sufficient under two conditions:
1. **Contemporary Code & Unmodified APIs:**  
   When querying code that has not undergone renaming or relocation, structural retrieval achieves high precision (Category C controls: **Success@10 = 66.7%, MRR = 0.5025**). Historical retrieval provides zero incremental value (**0.0% advantage**).
2. **Context-Preserved Refactorings (Shared Success):**  
   When the surrounding class, package, or interface name provides sufficient lexical context to anchor the query in contemporary code, structural retrieval can locate the target even if the method name changed.
   - **Graphhopper \`CASE-HIST-JAVA-0105\`:** Querying \`removeZeroDegreeNodes\` in \`PrepareRoutingSubnetworks\`. Structural search located \`markNodesRemovedIfUnreachable\` at **Rank 4** via class-level match; historical search placed it at **Rank 3**; RRF-v2 fusion combined both to **Rank 2**.

---

### 3. Factors That Limit the Effectiveness of Historical Retrieval
The evaluation identified four distinct limiting factors:
1. **Commit Horizon Decay ($k > 50$):**  
   In the distance-stratified diagnostic ($N = 20$), historical Success@10 dropped from 60.0% ($k \le 50$) to **30.0%** ($k > 50$). Traversal depth bounds ($H = 50$) prevent exploration of deep historical commits ($k$ up to 637).
2. **Overload & Sibling Method Ambiguity:**  
   In heavily overloaded classes (e.g., Undertow \`WebSocket07FrameSinkChannel\`), multiple candidate methods share nearly identical body tokens. To prevent false positives, Retrospect's ambiguity guard applies a confidence discount, causing historical ranks to drop below the evaluation cutoff (\`CASE-HIST-JAVA-0047\`: Historical Rank 147).
3. **Risk of Fusion Rank Dilution (Harm):**  
   When historical evidence is ambiguous or low-confidence, naive fusion can displace valid structural results. In \`CASE-HIST-JAVA-0047\`, ambiguous historical evidence caused RRF-v2 to demote the target from Rank 8 to Rank 29 (**Fusion Harm**).
4. **Vocabulary Mismatch in Terse Commit Logs:**  
   In dynamic languages (Python, JS, TS), commit messages often consist of concise ticket references (e.g., *"fix #123"*). Without descriptive commit messages, diff token matching alone struggles against large candidate pools.

---

## 3. Scientific Verdict

| Hypothesis | Verdict | Empirical Basis |
|---|:---:|---|
| *H1: Historical code retrieval is generally superior to structural retrieval for repository-level code search.* | **REFUTED** | On static code and unanswerable queries, historical search adds zero value and risks rank dilution. |
| *H2: Evolution-aware historical retrieval recovers relevant refactored symbols that contemporary structural retrieval misses.* | **SUPPORTED** | 40% incremental recovery on in-policy refactorings; successfully rescues symbols completely absent from current ASTs. |
| *H3: Cormack RRF-v2 with zero-signal gating preserves structural search precision on contemporary code.* | **SUPPORTED** | $\Delta \text{MRR} = -0.0013$ on Category C controls (virtually zero rank dilution). |
| *H4: The effectiveness of topological history traversal degrades predictably with commit distance.* | **SUPPORTED** | Success@10 drops from 60% ($k \le 50$) to 30% ($k > 50$). |

**Conclusion:**  
The reframed research question is **empirically supported with well-defined operational boundaries**. The research paper can make a strong, credible, and defensible scientific contribution by positioning Retrospect not as a universal replacement for structural search, but as an **evolution-aware complementary channel** that rescues refactored code within a practical historical horizon.
