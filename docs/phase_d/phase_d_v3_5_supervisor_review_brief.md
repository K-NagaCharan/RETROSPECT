# Retrospect Phase D — Supervisor & Methodological Review Brief (Version 3.5)

> **OPERATIONAL GATE STATUS:** **STRICTLY CLOSED / BLOCKED — FORMAL HUMAN PROTOCOL APPROVAL REQUIRED**  
> **Document Purpose:** Practical, high-density decision brief for Academic Project Supervisor and Independent Methodological Reviewer.  
> **Referenced Full Protocol:** [`phase_d_v3_5_exploratory_protocol.md`](file:///d:/base%20papers%20considered/Retrospect/docs/phase_d/phase_d_v3_5_exploratory_protocol.md)  
> **Referenced Correction Report:** [`phase_d_v3_5_correction_report.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_5_correction_report.md)  
> **Frozen Repository Reference:** Commit `17ea399217737f8d5fe2c32c310b69c2f812b84d` on `main`  

---

## 1. Problem Statement & Primary Research Question

### The Engineering & Research Problem:
When large language models (LLMs) operate over repository-scale codebases, context retrieval systems struggle to identify the correct target symbol when code has evolved across commits. Traditional structural search (AST symbol tables, lexical token matching) indexes only the *current* checkout snapshot. If a developer prompt refers to historical terminology, deprecated APIs, moved modules, or split functions, structural search is blind to the historical evolution connecting the old concept to the modern symbol.

Retrospect investigates whether integrating Git history (commit diffs, rename tracking, commit logs) through Reciprocal Rank Fusion (RRF) rescues these unretrievable targets without polluting top retrieval ranks for static, unrefactored code.

### Primary Exploratory Research Question (EQ1):
> **EQ1:** *Under what conditions does Git history help an LLM retrieve the relevant current code symbol, particularly when that symbol has been renamed, moved, extracted, or substantially rewritten?*

### Secondary Research Dimensions:
- **EQ2 (Differential Utility):** Does history help more for renames/moves vs. extractions/rewrites?
- **EQ3 (Rescue Rate):** How often does history place a symbol in the top-10 when structural search fails completely ($\text{rank} > 100$)?
- **EQ4 (Rank Dilution & Regressions):** When does history hurt retrieval by ranking obsolete/deleted code above current implementations?
- **EQ5 (Fusion vs. Pure History):** Does multi-modal fusion (S1) beat standalone historical search (B2)?
- **EQ6 (RRF-v2 vs. BM25):** Does hardened fusion provide measurable benefits over an Okapi BM25 lexical baseline (B4)?
- **EQ7 (Abstention & Deletions):** Can retrieval scores reliably identify permanently deleted functionality (Category D) without cross-repo retraining?

---

## 2. Planned System Comparisons

The study evaluates up to five retrieval pipelines under identical candidate universes and deterministic tie-breaking:

| System ID | Retrieval Paradigm | Underlying Mechanism | Implementation Status | Role in Study |
|:---:|---|---|:---:|---|
| **B1** | **Structural-Only** | Heuristic AST symbol table matching on current checkout. | Tracked at baseline commit `17ea399`. | **Negative Control / Baseline** (evaluates structural blindness). |
| **B2** | **Historical-Only** | Git commit log and diff association count retrieval. | Tracked at baseline commit `17ea399`. | **Ablation Baseline** (evaluates raw history without AST fusion). |
| **B3** | **Legacy Fusion (RRF-v1)** | Reciprocal Rank Fusion with synthetic fallback rank padding ($1/(60+N)$) and alphabetical tie-leakage. | Tracked at baseline commit `17ea399`. | **Legacy Reference** (documents weaknesses of unhardened fusion). |
| **S1** | **Hardened Fusion (RRF-v2)** | Zero-signal gating ($S_{\text{hist}} > 0$), exact rank matching, and fractional score tie-breaking. | Implemented post-baseline in `src/retrieval/RRFv2.js` (untracked). | **Primary Proposed System Candidate** (subject of DEC-03). |
| **B4** | **Lexical Text (BM25)** | Standard Okapi BM25 indexing concatenated historical commit messages and diff text. | Currently unimplemented. Proposed specification in Section 8.2. | **Standard IR Contrast Baseline** (subject of DEC-04). |

---

## 3. Epistemic Boundaries: What the Study Can and Cannot Claim

Because Phase D was redesigned from a confirmatory hypothesis-testing trial into an **exploratory multi-repository investigation**, reviewers and supervisors must evaluate it against appropriate epistemic standards:

### What the Study CAN Claim:
1. **Descriptive Empirical Characterization:** Detailed documentation of where Git-history signals succeed, fail, or remain neutral across real-world refactoring events in target repositories.
2. **Comparative Rescue vs. Dilution Rates:** Quantitative observation of rescue frequencies (B1 fails $\to$ S1 succeeds) and regression frequencies (B1 succeeds $\to$ S1 fails or dilutes) within the evaluated sample.
3. **Exploratory Contrasts:** Observable performance differences between heuristic fusion (S1), legacy fusion (B3), pure history (B2), and lexical text matching (B4).
4. **Resampling-Based Uncertainty Summaries:** Cluster-stratified bootstrap intervals ($B=2000$) summarizing sampling variability *conditional on the chosen sample of lineage clusters*.

### What the Study CANNOT Claim:
1. **Algorithmic Superiority:** It **cannot** claim that RRF-v2 is universally "superior" or "optimal" across software engineering as a whole.
2. **Generalizability Beyond Sample:** It **cannot** generalize findings to unstudied programming languages, proprietary codebases, or distinct architectural paradigms without future confirmatory studies.
3. **Confirmatory Statistical Significance:** It **does not** test formal null hypotheses ($H_0$), compute inferential $p$-values, or claim continuous-moment power guarantees.
4. **Causal Treatment Effects:** Because refactoring clusters are sampled purposively from historical documentation, differences cannot be interpreted as randomized causal treatment effects.

---

## 4. Master Register of Decisions Requiring Human Sign-Off

The protocol contains an unbroken master register of 22 decisions (**DEC-01 through DEC-22**). Ten decisions represent verified documentary evidence or consensus baselines; the remaining **12 decisions are explicitly `PENDING APPROVAL`** and require formal human sign-off before Phase D can be unblocked:

| Decision ID | Area / Dimension | Options Considered | Neutral Trade-Off Summary | Provisional Recommendation | Approving Authority |
|:---:|---|---|---|---|:---:|
| **DEC-03** | **Candidate S1 Status** | **Option A:** Commit S1 to repository git tree.<br>**Option B:** Freeze working-tree file via SHA-256 seal. | Committing establishes clean git tracking but alters baseline repo state. SHA-256 seal preserves baseline commit `17ea399` but leaves file untracked. | **Option A (commit on evaluation branch)**. | Academic Project Supervisor |
| **DEC-04** | **Baseline B4 Inclusion** | **Option A:** Implement B4 (`HistoricalBM25Retriever.js`).<br>**Option B:** Exclude B4 from Phase D scope. | Implementing B4 provides standard IR baseline contrast (EQ6). Excluding B4 simplifies scope and avoids new engineering. | **Option A (Implement B4)** to satisfy reviewer baseline rigor. | Academic Project Supervisor |
| **DEC-06** | **Unit of Analysis Estimand** | **Option A:** Equal cluster weighting ($1/M$).<br>**Option B:** Raw query-weighted mean. | Equal cluster weighting estimates performance over refactoring events; query weighting estimates performance over developer query instances. | **Option A as primary**, with mandatory dual reporting of Option B. | Independent Methodological Reviewer |
| **DEC-07** | **Cluster Query Count Cap** | **Option A:** Include all eligible queries.<br>**Option B:** Fixed cap $m_{\max}$ per cluster. | Option A maximizes refactoring coverage but allows large clusters to dominate query-weighted metrics. Option B balances cluster representation but discards mined refactorings. | **Option B ($m_{\max}=5$)** with CSPRNG salt commitment. | Academic Project Supervisor |
| **DEC-11** | **Werkzeug–Flask Contamination Audit** | **Option A:** Retain as audit hypothesis to be tested in Checkpoint 2.<br>**Option B:** Treat as a priori independent Pallets repositories. | Option A guarantees rigorous verification of shared committer overlap and architectural coupling; Option B avoids pre-study audit overhead but risks evaluating coupled codebases maintained by the same core authors. | **Option A (retain as audit hypothesis to be verified during Checkpoint 2)**. | Independent Methodological Reviewer |
| **DEC-13** | **AST Parser Compatibility Threshold** | **Option A:** Require strict $\ge 95\%$ parse-success rate over production runtime files.<br>**Option B:** Evaluate parser compatibility strictly at the candidate cluster level. | Option A ensures overall repository parse hygiene and prevents systemic AST indexing blind spots; Option B maximizes repository eligibility but risks unnoticed corpus truncation from unparsed files. | **Option A ($\ge 95\%$ parse success over production runtime files)**, with cluster-level exclusion fallback. | Academic Project Supervisor |
| **DEC-17** | **Primary Estimand Population** | **Option 1:** Evolution-focused (A & B primary, C control).<br>**Option 2:** All-answerable (A, B, C pooled). | Option 1 directly evaluates EQ1 on refactored code without dilution from static code. Option 2 evaluates broad utility but dilutes measured effect size with easy static queries. | **Option 1 (Evolution-focused)** with mandatory Category C control reporting. | Academic Project Supervisor |
| **DEC-18** | **BM25 Abstention Grid Strategy** | **Option 1:** Pre-registered fixed numerical grid.<br>**Option 2:** Dev-set calibrated percentile grid. | Option 1 guarantees zero data peeking but may miss empirical score densities. Option 2 aligns grid points with data but requires spending sample size on a dev set. | **Option 1** if sample size is constrained; **Option 2** if pilot split is approved. | Academic Project Supervisor |
| **DEC-19** | **Language SymbolID Rules & Grammar Scope** | **Option A (Provisional Approval Scoped to JS & Python Only):** Formally approve provisional JavaScript and Python SymbolID rules in Section 5.2 for Phase D, while keeping Java, advanced TypeScript types, and other language grammars strictly blocked pending dedicated grammar audits and separate formal sign-off.<br>**Option B (Universal Grammar Block):** Maintain a complete operational block across all languages (including JS and Python) until formal AST grammar audits and round-trip identity verifications are completed across all planned target repositories. | Option A enables proceeding with audited Fastify (JS) and Flask (Python) codebases while protecting against unvetted grammar ambiguities; Option B provides maximal conservatism upfront but delays any evaluation until multi-language audits are finalized. | **Option A (provisional approval scoped strictly to JavaScript and Python)**; Java and advanced TypeScript remain strictly blocked. | Independent Methodological Reviewer |
| **DEC-20** | **Evaluated Revision Alignment** | **Option A:** Retain October 2026 commits (`f736849`, `d086db8`).<br>**Option B:** Re-pin checkouts to official release tags (`v5.0.0`, `3.1.0`). | Option A evaluates modern cumulative history but heads past release tags. Option B evaluates historical state at tagged releases but truncates recent history. | **Option A** (retain pinned checkouts; document relationship to tags). | Academic Project Supervisor |
| **DEC-21** | **Solo-Researcher Adjudication Workflow** | **Option A:** Staged temporal firewall with self-adjudication.<br>**Option B:** Dual-reviewer blinded adjudication. | Option A is practically feasible for a solo student but retains cognitive bias risk. Option B eliminates bias but requires external faculty/reviewer labor. | **Option B** for sample audit (e.g. 20% of cases); **Option A** for primary authoring. | Independent Methodological Reviewer |
| **DEC-22** | **Lineage Cluster Inventory Target** | **Option A:** Minimum 18 audited clusters across Fastify/Flask (verified as 11 Fastify + 7 Flask in Section 2.4 of data collection plan).<br>**Option B:** Strictly require $\ge 20$ clusters via third repository. | Option A enables immediate study progression on verified codebases. Option B increases cluster diversity but delays unblocking for expansion audits. | **Option A** with expansion repositories serving as exploratory generalization checks. | Academic Project Supervisor |

---

## 5. Key Methodological Questions for Reviewers

### A. Repository Revision Question (DEC-20)
- **Empirical Facts:**  
  - Fastify checkout commit `f736849` (`2026-10-14`, `v6.0.0-alpha.4-28`) is **770 commits ahead** of release tag `v5.0.0` (`6bde7d7`, `2024-09-17`).
  - Flask checkout commit `d086db8` (`2026-10-07`, `3.1.3-99`) is **99+ commits ahead** of release tag `3.1.0` (`ab81496`, `2024-11-13`).
- **Decision Needed:** Should Retrospect evaluate the modern October 2026 commits (which contain the full cumulative git history to date) or re-pin checkouts to official release tags `v5.0.0` and `3.1.0`?
- **Trade-Off:** Modern checkouts reflect modern development but exceed published releases; release tags provide historical milestone boundaries but truncate recent evolution history.

### B. Lineage Cluster Inventory Target (DEC-22)
- **Empirical Facts:** The current provisional inventory contains **18 clusters**, verified as **11 Fastify clusters and 7 Flask clusters** in Section 1.2 and Section 2.4 of [`phase_d_data_collection_plan_draft.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_data_collection_plan_draft.md) (where Flask clusters were consolidated from 8 to 7 due to commit overlap between `FLASK-CLUSTER-SCAFFOLD` and `FLASK-CLUSTER-SANSIO-APP` into `FLASK-CLUSTER-SANSIO-CORE`).
- **Decision Needed:** Is 18 clusters across 2 repositories sufficient for this exploratory, descriptive study, or must the study strictly require $\ge 20$ clusters across $\ge 3$ repositories?
- **Trade-Off:** 18 clusters allows immediate execution of Checkpoint 2 on audited repositories; requiring 20+ clusters increases linguistic and architectural diversity but requires discovering, cloning, and auditing a 3rd repository before unblocking.

### C. Contamination, Blinding & Bias Governance (DEC-11, DEC-21)
- **Cross-Repo Contamination:** Flask and Werkzeug share the Pallets organization. DEC-11 requires an empirical committer-overlap and dependency audit before treating Werkzeug as independent. Express is strictly blacklisted at file, symbol, and cluster levels.
- **Solo-Researcher Blinding Firewall:** To prevent retrieval signals (`git log -S`, `git blame`, diffs) from leaking into query authoring:
  - Phase 1: Mined exclusively from external release notes / migration guides.
  - Phase 2: Sealed and hashed author packs (target paths/symbols redacted).
  - Phase 3: Blinded query authoring without access to AST or retrieval tools.
  - Phase 4: Independent ground-truth mapping.
  - Phase 5: Unblinded evaluation execution.
  - *Reviewer Decision:* Is the 5-stage temporal firewall sufficient, or is a secondary reviewer audit (e.g. 20% sample) mandatory?

### D. Language Grammar & SymbolID Precision (DEC-19)
- **Binary Length-Prefixed Serialization (`RetrospectSymbolIDV1:`):** Length-prefixed serialization makes the encoding of fields unambiguous and prevents delimiter ambiguity. Distinct serialized payloads are not mathematically guaranteed to produce distinct SHA-256 digests, but hash collisions are computationally infeasible under standard cryptographic properties ($2^{128}$ collision resistance).
- **Python Case Sensitivity:** Parameter names strictly preserve exact case (e.g. `data` $\ne$ `Data`). Default values and type annotations are stripped to ensure stable canonical matching.
- **Language Blocking (DEC-19 Scope):** Proposed approval is strictly scoped to provisional JavaScript and Python top-level/class symbol rules in Section 5.2. Java and advanced TypeScript grammars remain **strictly blocked** from benchmark execution pending dedicated grammar audits and subsequent formal sign-off.

---

## 6. Mandatory Operational Review Sequence

To ensure rigorous scientific governance, the following five-step sequence must be executed in order:

```
[Step 1: Methodological Adjudication]
  Supervisor & Reviewer adjudicate DEC-03 through DEC-22.
         │
         ▼
[Step 2: Formal Written Approval]
  Record written sign-off and chosen options in Section 14.
         │
         ▼
[Step 3: Freeze Protocol & Implementations]
  Lock Version 3.5 protocol; freeze S1 (RRFv2.js) & implement B4 (BM25).
         │
         ▼
[Step 4: Checkpoint 2 Repository Audits]
  Execute read-only feasibility, Werkzeug coupling, and Express blacklist checks.
         │
         ▼
[Step 5: Operational Unblocking of Phase D]
  Formally transition Phase D gate from CLOSED to OPEN for data collection.
```

---

## 7. Formal Operational Gate Directive

> ### **CRITICAL INVARIANT: PHASE D REMAINS STRICTLY CLOSED / BLOCKED**
>
> **The Version 3.5 exploratory protocol and this review brief are PROPOSALS ONLY.**  
>
> Prior to formal human written approval:
> 1. No natural-language benchmark queries may be authored or finalized.
> 2. No ground-truth annotations or evaluation cases may be created.
> 3. No candidate repository checkouts may be mutated.
> 4. No dataset manifests or train/development/test splits may be generated.
> 5. No retrieval pipelines (B1, B2, B3, B4, S1) may be executed on benchmark queries.
> 6. No abstention threshold tuning or score-based calibration may occur.
>
> **The operational gate remains STRICTLY CLOSED AND BLOCKED pending formal review, amendment, and written approval of the Version 3.5 protocol by the Academic Project Supervisor and Independent Human Methodological Reviewer.**
