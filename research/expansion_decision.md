# Retrospect — Dataset Expansion Decision (Stage 5)

**Branch:** \`eval-reframing-empirical-study\`  
**Date:** 2026-10-20  
**Decision:** **FREEZE BENCHMARK AT CURRENT RECONCILED CENSUS ($N=45$); EXPANSION DEFERRED TO POST-THESIS WORK**

---

## 1. Decision Framework & Evaluation Criteria

In accordance with Stage 5 of the research protocol, an automated benchmark expansion campaign is evaluated against four strict criteria:
1. **Verifiability:** Can ground-truth targets and queries be independently verified without circular reliance on Retrospect's output?
2. **Interpretability:** Does the current dataset produce interpretable, statistically defensible observations?
3. **Marginal Scientific Contribution:** Would adding more automated cases provide new qualitative insights into evolution-aware retrieval, or merely inflate row counts?
4. **Leakage & Methodological Risk:** Does automated expansion risk reintroducing the synthetic commit hashes, unauthored queries, and referential integrity failures that corrupted legacy datasets?

---

## 2. Assessment Against Decision Criteria

| Criterion | Evaluation Finding | Risk / Verdict |
|---|---|:---:|
| **1. Ground-Truth Verifiability** | Mined refactoring commits from tools like RefactoringMiner provide AST diffs, but do *not* provide realistic natural-language developer queries. Authoring authentic, leakage-free queries requires human-in-the-loop blinded authoring (e.g., Phase C protocol). Automated expansion would produce unauthored or leaked queries. | **HIGH RISK** |
| **2. Interpretability of Current Data** | The current reconciled census of 45 cases across 14 repositories and 4 languages already provides crisp, unambiguous answers to all core research questions: EQ1 (40% rescue rate), EQ4 (zero dilution on current code), EQ4 (distance decay beyond $H=50$), and EQ7 (safe abstention on negatives). | **SATISFIED** |
| **3. Marginal Scientific Contribution** | Adding 50 more unverified Java cases would not change the qualitative conclusions: topological history traversal is effective for $H \le 50$, degrades thereafter, and is constrained by overload ambiguity. | **LOW VALUE** |
| **4. Integrity & Methodological Standards** | Previous attempts to generate large automated benchmarks created 100 invalid negative cases and 42 unauthored traces. Maintaining scientific credibility requires resisting artificial sample-size inflation. | **CRITICAL CONSTRAINT** |

---

## 3. Formal Expansion Decision

**Decision: DO NOT CONDUCT AUTOMATED DATASET EXPANSION.**

### Justification:
1. The existing multi-repository evaluation is **complete, reproducible, and internally valid**.
2. All 45 cases have been verified against authentic Git DAGs in \`D:\clones\` using [\`BenchmarkCaseLoader.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/BenchmarkCaseLoader.js).
3. The empirical results definitively address the reframed research question:
   - When does history matter? (Renames/moves within 50 commits with obsolete query phrasing).
   - When is structure sufficient? (Contemporary code and context-anchored renames).
   - What limits history? (Commit horizon, overload ambiguity, terse commit logs).
4. The appropriate venue for expanded cross-language data collection is a multi-author human evaluation study in future work, not an automated synthetic script prior to thesis submission.
