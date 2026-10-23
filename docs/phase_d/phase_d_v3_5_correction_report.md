# Retrospect Phase D — Methodological Correction Report: Version 3.4 to Version 3.5

> **DOCUMENT TYPE:** Methodological Correction and Verification Report  
> **PROTOCOL VERSION TARGET:** Version 3.5 Exploratory Protocol  
> **SOURCE PROTOCOL:** [`phase_d_v3_4_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_4_exploratory_protocol.md)  
> **SOURCE REPORT:** [`phase_d_v3_4_correction_report.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_4_correction_report.md)  
> **CORRECTED PROTOCOL:** [`phase_d_v3_5_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_5_exploratory_protocol.md)  
> **OPERATIONAL GATE:** **STRICTLY CLOSED / BLOCKED — FORMAL HUMAN PROTOCOL APPROVAL REQUIRED**  
> **FROZEN REPOSITORY COMMIT:** Commit `17ea399217737f8d5fe2c32c310b69c2f812b84d` on `main`  

---

## 1. Executive Summary

15: This report documents the resolution of the six specific methodological, technical, and reproducibility issues identified during the review of Version 3.4 of the Retrospect Phase D exploratory research protocol (*Evolution-Aware Context Retrieval for Repository-Level LLMs*), as well as the **five narrow post-review consistency refinements** (further refined in the final technical consistency check):
16: 1. **Abstention Rule Harmonization (Section 9.3):** Unified candidate-level score invalidation ($\text{Score}^*(s) = -\infty$) with query-level abstention semantics ($R_{\text{valid}}(q) = \emptyset \lor S_{\text{top}}(q) < \tau$), eliminating formula vs. bullet discrepancies.
17: 2. **Query Canonicalization Whitespace Harmonization (Section 4.3):** Aligned Python pseudocode strictly with the specification by using explicit ASCII whitespace trimming (`ASCII_WHITESPACE_CHARS = ' \t\r\n'`) rather than generic `str.strip()`.
18: 3. **SymbolID Synthetic Example Byte Length Correction (Section 5.2):** Corrected the UTF-8 byte count of synthetic Python signature `"(self,environ,start_response)"` from 28 bytes to 29 bytes, bringing the total serialized payload to 112 bytes (was 111 bytes).
19: 4. **SymbolID Language Rules, Lexical Scope, and Injective Framing (Section 5.2):** Explicitly defined lexical scope as dot-delimited enclosing declarations while strictly excluding nested local closures (`ERROR_LOCAL_NESTED_SYMBOL`), specified TypeScript parameter/type normalization and Java type erasure, characterized length-prefixed serialization as an injective encoding that eliminates delimiter ambiguity with hash collisions computationally infeasible rather than mathematically impossible, and formulated DEC-19 where proposed approval is strictly scoped to provisional JavaScript and Python rules while keeping Java and advanced TypeScript grammars strictly blocked pending dedicated audits.
20: 5. **Master Decision Register Completeness and Cluster Audit (Section 14):** Restored the unbroken master lifecycle register covering all 22 decisions (**DEC-01 through DEC-22**) in Section 14.1, alongside the dedicated table of pending decisions in Section 14.2, aligning DEC-19 approval scope to JS and Python only and citing the verified 11 Fastify + 7 Flask cluster breakdown under DEC-22.
21: 
22: All corrections have been incorporated into [`phase_d_v3_5_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_5_exploratory_protocol.md) and [`phase_d_v3_5_supervisor_review_brief.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_5_supervisor_review_brief.md). Predecessor protocol documents—including Version 3.4, Version 3.3, Version 3.2, Version 3.1, Version 3.0, and Version 2.7—remain completely unaltered.

In accordance with mandatory research governance:
- **No benchmark data has been collected or authored.**
- **No evaluation queries have been selected, capped, salted, or rewritten.**
- **No evaluation splits or lineage clusters have been created.**
- **No retrieval engines have been executed or benchmarked.**
- **No score thresholds have been calibrated or tuned.**
- **No tracked project files have been mutated.**
- **Phase D remains strictly CLOSED / BLOCKED pending formal human sign-off.**

---

## 2. Source Documents Inspected and Exact Output Paths

### Source Documents Read:
1. `phase_d_v3_4_exploratory_protocol.md` ([`phase_d_v3_4_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_4_exploratory_protocol.md))
2. `phase_d_v3_4_correction_report.md` ([`phase_d_v3_4_correction_report.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_4_correction_report.md))
3. Phase B Manifests:
   - [`data/evaluation_lineage_queries_v4.json`](file:///d:/base/papers/considered/Retrospect/data/evaluation_lineage_queries_v4.json)
   - [`data/benchmark_lineage.json`](file:///d:/base/papers/considered/Retrospect/data/benchmark_lineage.json)
4. Repository Git Metadatas:
   - `d:\base papers considered\phase_d_eval_repos\fastify`
   - `d:\base papers considered\phase_d_eval_repos\flask`
   - `d:\base papers considered\Retrospect` (baseline commit `17ea399217737f8d5fe2c32c310b69c2f812b84d`)

### Output Files Generated:
1. Corrected Protocol Document:
   `C:\Users\ASUS\.gemini\antigravity-ide\brain\739cb121-0ee8-4c36-a7ca-d249d8a7bb85\phase_d_v3_5_exploratory_protocol.md`
2. Methodological Correction Report:
   `C:\Users\ASUS\.gemini\antigravity-ide\brain\739cb121-0ee8-4c36-a7ca-d249d8a7bb85\phase_d_v3_5_correction_report.md`

---

## 3. Mandatory Audit and Correction Table (Corrections A through F)

The table below catalogs every required correction A–F, detailing the Version 3.4 issue, the Version 3.5 resolution, the verification method used, the actual epistemic status, and the supporting empirical evidence or residual limitations:

| Item | Version 3.4 issue | Version 3.5 correction | Verification method | Actual status | Evidence or limitation |
|---|---|---|---|:---:|---|
| **Correction A**<br>(Section 4.3) | Candidate deduplication occurred on raw strings *before* Unicode normalization and whitespace trimming; multiple raw strings normalizing to the same identity could occupy duplicate candidate slots. Cluster slug validation regex (`^[a-z0-9_.-]+/[a-z0-9_.-]+$`) conflicted with stated case-preservation policy. Python pseudocode used broad `str.strip()` instead of strict ASCII trimming. | Reordered candidate processing so input validation, Unicode NFC normalization, and explicit whitespace collapsing (`0x20`) occur *before* deduplication. Duplicate canonical identities map to a single candidate slot; traceability map is preserved. Reconciled cluster ID policy: lowercase ASCII for cluster slug (`^[a-z0-9_.-]+/[a-z0-9_.-]+$`), case preserved for symbol identifiers. Pseudocode explicitly defines `ASCII_WHITESPACE_CHARS = ' \t\r\n'` and applies `strip(ASCII_WHITESPACE_CHARS)`, ensuring strict adherence to the specified ASCII character set. | Code inspection and synthetic algorithmic trace. | **DOCUMENTED ONLY**<br>(Implementation verified in pseudocode; not executed on study data) | Pseudocode in Section 4.3 guarantees `canonical_to_raw` dictionary keys are unique canonical identities. Synthetic example in Section 4.3 demonstrates collapsing `"lib/p.js::f "` and `"lib/p.js::f"`. |
| **Correction B**<br>(Section 6.1) | Fastify evaluated commit `f736849` was associated with date 2026-10-14 and release tag `v5.0.0`; Flask evaluated commit `d086db8` was associated with date 2026-10-07 and tag `3.1.0`. These conflated modern checkout commit dates with official tag release dates. | Executed empirical git audit on target repositories. Disambiguated evaluated checkout commits from official release tags: Fastify `f736849` (`2026-10-14T08:44:43Z`, `v6.0.0-alpha.4-28`) is 770 commits ahead of release tag `v5.0.0` (`6bde7d7`, `2024-09-17T14:11:22Z`); Flask `d086db8` (`2026-10-07T14:02:54Z`, `3.1.3-99`) is 99+ commits ahead of release tag `3.1.0` (`ab81496`, `2024-11-13T18:20:07Z`). Retained evaluated commits while documenting tag targets, timestamps, and discrepancies. Cataloged DEC-20 for supervisor confirmation. | `git -C <repo> log -1`, `git show-ref --tags -d`, and `git rev-list --count` executed on local repositories. | **EXECUTED AND VERIFIED** | Empirical outputs confirmed commit dates and tag targets: Fastify `f736849` is `test(server): assert...`; Flask `d086db8` is `fix typing`. Tag `v5.0.0` released 2024-09-17; tag `3.1.0` released 2024-11-13. |
| **Correction C**<br>(Section 6.2) | Free-text search syntax (`is:pr is:merged label:breaking`) was improperly specified on repository-specific REST endpoints (`/repos/{owner}/{repo}/pulls`), which do not support free-text query parameter `q`. Local changelog reading was not cleanly distinguished from API calls. | Replaced improper REST endpoints with the authoritative GitHub Search API endpoint: `GET https://api.github.com/search/issues?q=repo:{owner}/{repo}+...`. Specified exact HTTP methods, query parameters (`q`, `sort=updated`, `order=desc`, `per_page=100`), rate limits (30 req/min authenticated), pagination limits (top 50 inspected), error handling, and stopping conditions. Cleanly separated local changelog file reading (Category 1) from remote API calls (Categories 2, 3, 4). | REST API documentation review and schema verification against GitHub Search API specification. | **DOCUMENTED ONLY**<br>(No API calls executed; technical syntax corrected) | Search API endpoint `/search/issues` officially supports `repo:`, `is:pr`, `is:merged`, and `label:` qualifiers. REST pulls endpoint `/repos/.../pulls` does not. |
| **Correction D**<br>(Section 6.4 & 7) | Protocol permitted inspecting `git log -S`, `git blame`, and commit diffs during source linking, introducing circularity risk where historical retrieval signals leak into query authoring and ground truth. Lacked a formal blinded workflow for a solo researcher. | Formulated a strict 5-stage firewall: (1) Independent Source Discovery (external docs only), (2) Source Pack Freeze and Hashing (sealed author packs), (3) Blinded Query Authoring (authors see only redacted external texts; forbidden from AST/diff/blame/retrieval outputs), (4) Isolated Target Mapping (independent mapping to modern AST without retrieval output), and (5) Evaluation Unblinding. Documented solo-researcher temporal separation protocol and disclosed unavoidable residual cognitive bias risks. Cataloged DEC-21. | Methodological review of blinding and evaluation integrity protocols. | **DOCUMENTED ONLY**<br>(Process specified; pending human approval and study execution) | Firewall eliminates circularity in query authoring by restricting authors to external release notes/migration guides. Solo-researcher limitations explicitly disclosed. |
| **Correction E**<br>(Section 5.2) | `SymbolID` was defined as ambiguous string concatenation: `SHA256(repo || "#/" || file_path || "::" || qualified_scope_and_name || "::" || signature_hash)`. Lacked formal delimiters, length prefixes, language-specific signature representations, and overload disambiguation. Initial synthetic example miscalculated signature byte length (28B vs. 29B) and total payload (111B vs. 112B). Lexical scope hierarchy and nested closures lacked precision. | Replaced string concatenation with an unambiguous, versioned, big-endian length-prefixed binary serialization: `RetrospectSymbolIDV1:` with `U32BE` lengths for 5 distinct fields (`repo`, `file`, `scope`, `name`, `sig`). Formulated language-specific signature rules: JS arity/rest; TS normalized parameter types (primitives lowercased, punctuation whitespace collapsed, return types omitted); Python keyword parameters preserved; Java qualified types with type erasure. Defined lexical scope as dot-delimited enclosing declarations; nested local functions/closures strictly excluded (`ERROR_LOCAL_NESTED_SYMBOL`). Corrected synthetic example byte counts: Python signature `"(self,environ,start_response)"` is 29 bytes; total payload is 112 bytes. Formally enforced DEC-19 language blocking on unverified grammars. | Formal serialization specification, byte trace calculation, and AST grammar analysis across JS, Python, and Java. | **DOCUMENTED ONLY**<br>(Specification formalized and byte counts verified; no study SymbolIDs generated) | Big-endian 32-bit length prefixes mathematically guarantee zero delimiter ambiguity and injective payload encoding ($\text{Payload}_1 \ne \text{Payload}_2$). Under standard cryptographic properties of SHA-256 ($2^{128}$ collision resistance), digest collisions are computationally infeasible (though not mathematically impossible). Language blocking rule (DEC-19 Option A) restricts proposed approval strictly to provisional JS/Python rules, keeping Java and advanced TS strictly blocked. Synthetic byte trace: $21 + (5 \times 4) + (13 + 16 + 5 + 8 + 29) = 112$ bytes. |
| **Correction F**<br>(Section 9) | Abstention section did not explicitly state which systems were included or excluded, risking invalid score comparisons across non-comparable scales. Decision semantics lacked protection against empty result lists ($R(q) = \emptyset$) answering at $\tau = 0.0$. Formula in Section 9.3 set query-level $S_{\text{top}}=-\infty$ if *any* score was invalid, while bullet text disqualified individual candidate scores, causing internal contradiction. | Explicitly stated system inclusion boundary: **S1 (RRF-v2)** and **B4 (BM25, provisional)** are included; **B1 (heuristic AST)**, **B2 (unnormalized commit counts)**, and **B3 (synthetic fallback ranks)** are strictly excluded from abstention comparison. Completely harmonized decision semantics: each candidate score is validated individually ($\text{Score}^*(s) = -\infty$ if invalid/NaN/out-of-range); $R_{\text{valid}}(q) = \{s \in R(q) : \text{Score}^*(s) > -\infty\}$; $S_{\text{top}}(q) = \max_{s \in R_{\text{valid}}(q)} \text{Score}^*(s)$ if $R_{\text{valid}}(q) \ne \emptyset$, else $-\infty$. System answers iff $R_{\text{valid}}(q) \ne \emptyset \land S_{\text{top}}(q) \ge \tau$; system abstains iff $R_{\text{valid}}(q) = \emptyset \lor S_{\text{top}}(q) < \tau$. All metrics consistently evaluate this unified predicate. Cataloged DEC-18. | Mathematical analysis of retrieval score ranges, metric denominators, and unified decision predicates. | **DOCUMENTED ONLY**<br>(Decision rules codified and harmonized; no threshold experiments run) | Score ranges verified: S1 bounded in $[0, 2/61]$; BM25 unbounded in $[0, \infty)$; B3 corrupted by $1/(60+N)$ rank padding. Predicate $R_{\text{valid}}(q) \ne \emptyset \land S_{\text{top}}(q) \ge \tau$ strictly protects $\tau = 0.0$ and unifies formula with decision rules. |


---

### 3.1 Resolution of Reviewer Consistency Findings (Issues 1 through 5)

Following expert review of the initial Version 3.5 protocol draft, five specific internal inconsistencies and ambiguities were identified and systematically resolved:

#### Issue 1: Abstention Rules Contradiction (Section 9.3)
- **Reviewer Finding:** In Section 9.3, the mathematical formula stated that if *any* returned score was invalid, the entire query received $S_{\text{top}} = -\infty$, forcing an abstention. However, the subsequent decision rule bullet stated that only the individual candidate's score should be set to $-\infty$, abstaining only if *all* candidate scores were invalid. These two rules could produce conflicting retrieval decisions for the same query.
- **Protocol Resolution:** Completely unified the decision semantics across formulas, decision rules, and metric denominators:
  1. Each candidate score is evaluated individually:
     $$\text{Score}^*(s) = \begin{cases} \text{Score}(s) & \text{if } \text{Score}(s) \in \text{Domain}_{\text{valid}} \text{ and finite} \\ -\infty & \text{if } \text{Score}(s) \in \{\text{NaN}, \text{null}, \pm\infty\} \lor \text{Score}(s) \notin \text{Domain}_{\text{valid}} \end{cases}$$
  2. The valid candidate set is defined as $R_{\text{valid}}(q) = \{s \in R(q) : \text{Score}^*(s) > -\infty\}$. Any candidate with $\text{Score}^*(s) = -\infty$ is disqualified from answering.
  3. The highest effective score is defined as:
     $$S_{\text{top}}(q) = \begin{cases} \max_{s \in R_{\text{valid}}(q)} \text{Score}^*(s) & \text{if } R_{\text{valid}}(q) \ne \emptyset \\ -\infty & \text{if } R_{\text{valid}}(q) = \emptyset \text{ (empty result list or all candidate scores invalid)} \end{cases}$$
  4. The system answers if and only if $R_{\text{valid}}(q) \ne \emptyset \land S_{\text{top}}(q) \ge \tau$.
  5. The system strictly abstains if $R_{\text{valid}}(q) = \emptyset \lor S_{\text{top}}(q) < \tau$.
  6. All metric formulas ($\text{Cov}(\tau)$, $\text{FAR}_D(\tau)$, $\text{cMRR@100}(\tau)$) now evaluate the identical predicate $\mathbb{I}(R_{\text{valid}}(q) \ne \emptyset \land S_{\text{top}}(q) \ge \tau)$.

#### Issue 2: Query Canonicalization Whitespace Inconsistency (Section 4.3)
- **Reviewer Finding:** Section 4.3 specified trimming strictly defined ASCII whitespace characters (`0x20`, `\t`, `\r`, `\n`), but the Python pseudocode implemented `raw.strip()` and `raw_symbol.strip()`, which strip all Unicode whitespace characters (including non-breaking spaces `\u00A0`, em spaces `\u2003`, etc.), leading to divergence between specification and code.
- **Protocol Resolution:** Updated the Python pseudocode in Section 4.3 to explicitly define:
  ```python
  ASCII_WHITESPACE_CHARS = ' \t\r\n'
  ```
  The pseudocode now applies:
  - `trimmed = nfc_str.strip(ASCII_WHITESPACE_CHARS)`
  - `collapsed = re.sub(r'[ \t\r\n]+', ' ', trimmed)`
  - `if not raw or not raw.strip(ASCII_WHITESPACE_CHARS): continue`
  This guarantees that Unicode NFC normalization occurs first, followed strictly by ASCII whitespace trimming and collapsing, with deduplication executed across canonical keys prior to hashing.

#### Issue 3: SymbolID Synthetic Example Byte Length Discrepancy (Section 5.2)
- **Reviewer Finding:** In Section 5.2, the synthetic Python parameter signature `"(self,environ,start_response)"` was stated to be 28 bytes, when its actual UTF-8 byte count is 29 bytes. Consequently, the stated total serialized payload length of 111 bytes was off by 1 byte.
- **Protocol Resolution:** Corrected the byte trace in Section 5.2:
  - `(` [1B] + `self` [4B] + `,` [1B] + `environ` [7B] + `,` [1B] + `start_response` [14B] + `)` [1B] = **29 bytes**.
  - Binary framing breakdown:
    - Versioned prefix: `"RetrospectSymbolIDV1:"` = 21 bytes.
    - 5 field length prefixes ($5 \times \text{U32BE}$): $5 \times 4 = 20$ bytes.
    - 5 payload fields: `repo` (13B) + `file` (16B) + `scope` (5B) + `name` (8B) + `sig` (29B) = 71 bytes.
    - **Total Serialized Length:** $21 + 20 + 71 =$ **112 bytes**.
  - All other illustrative field lengths were audited and confirmed exact.

#### Issue 4: SymbolID Language Rules and Lexical Scope Precision (Section 5.2)
- **Reviewer Finding:** Section 5.2 stated that TypeScript type annotations are normalized when present, but lacked an explicit normalization grammar. The scope representation also required precise rules for nested functions, closures, and lexical scopes. Furthermore, Python parameter names were described as preserved in lowercase/canonical form, which risks merging case-sensitive signatures (e.g., `data` vs. `Data`), and DEC-19 was left pending without a formal language-blocking policy.
- **Protocol Resolution:** Fully defined the scope hierarchy, case-sensitivity rules, and type normalization:
  1. **Scope Hierarchy:** Lexical scope is represented as a dot-delimited chain of named enclosing declarations (e.g. `"Flask"`, `"Reply.prototype"`, `"OuterClass.InnerClass"`). Module-level symbols use empty string `""` (0 bytes).
  2. **Nested Local Closures Excluded:** Functions declared inside function bodies, local closures, and anonymous lambda expressions are strictly excluded from the target universe. Any AST extractor encountering a local nested symbol must reject it with `ERROR_LOCAL_NESTED_SYMBOL`.
  3. **Python Exact Case Preservation:** Parameter names are strictly preserved in their exact case (because Python keyword arguments and identifiers are case-sensitive); Unicode Normalization Form C (NFC) is applied; surrounding whitespace is trimmed; default values and parameter type annotations are stripped; `*args` and `**kwargs` markers are preserved with exact identifier case; positional-only `/` and keyword-only `*` parameter markers are preserved if present. Lowercasing or case-folding is **strictly prohibited**. A synthetic case-sensitivity distinctness example demonstrates that `Helper.format_data(self, data)` and `Helper.format_data(self, Data)` produce distinct payloads differing at byte offset 97 (`0x64` `'d'` vs. `0x44` `'D'`), yielding distinct serialized payloads for which an SHA-256 digest collision is computationally infeasible under standard cryptographic properties ($2^{128}$ collision resistance), though not mathematically impossible.
  4. **TypeScript Type Normalization:** Parameter names are stripped; primitive types are lowercased (`string`, `number`, `boolean`, `any`, `unknown`, `void`); whitespace around punctuation (`:`, `,`, `|`, `&`, `=>`) is collapsed; parameter modifiers (`readonly`, `public`, `private`) are stripped; optional parameters receive `?`; rest parameters receive `...`; return types are omitted to avoid churn.
  5. **Java Type Normalization:** Parameter types are qualified; parameter names are stripped; generics are erased to raw types; return types and access modifiers are omitted.
  6. **DEC-19 Grammar Scope Alignment & Blocking:** The protocol explicitly records that binary length-prefixed serialization (`RetrospectSymbolIDV1:`) makes field encoding injective and eliminates delimiter ambiguity, but hash collisions remain computationally infeasible rather than mathematically impossible. Under DEC-19, proposed approval (Option A) is strictly scoped to provisional JavaScript and Python rules in Section 5.2. Java and advanced TypeScript grammars remain **STRICTLY BLOCKED** from benchmark execution pending dedicated grammar audits and separate formal sign-off. DEC-19 remains pending human approval.

#### Issue 5: Decision Register Completeness and Audit Trail (Section 14)
- **Reviewer Finding:** The protocol described a comprehensive decision register covering DEC-01 through DEC-22, but the visible approval table displayed only 10 pending decisions, omitting DEC-11 (Werkzeug–Flask relationship) and DEC-13 (AST parser compatibility threshold), creating ambiguity about whether the omitted decision IDs were resolved, withdrawn, or accidentally lost.
- **Protocol Resolution:** Restructured Section 14 into a two-tier decision architecture with exact 1-to-1 correspondence:
  1. **Section 14.1 (Master Lifecycle Decision Register):** Catalogs every decision from **DEC-01 through DEC-22** without omission, recording its operational evidence status (`VERIFIED`, `FROZEN`, `APPROVED / CONSENSUS`, or `PROPOSED — PENDING FORMAL APPROVAL/DECISION`). This documents all decisions inherited from Versions 2.7, 3.0, 3.1, 3.2, 3.3, and 3.4.
  2. **Section 14.2 (Dedicated Table of Human Decisions):** Details all **12 material decisions** currently `PENDING APPROVAL` (DEC-03, DEC-04, DEC-06, DEC-07, DEC-11, DEC-13, DEC-17, DEC-18, DEC-19, DEC-20, DEC-21, and DEC-22), explicitly adding:
     - **DEC-11 (Werkzeug–Flask Contamination & Shared Codebase Audit):** Details options (audit hypothesis vs. a priori independence), neutral trade-offs, required commit-log author intersection evidence, and designates the Independent Methodological Reviewer as approving authority.
     - **DEC-13 (AST Parser Compatibility Threshold):** Details options (strict $\ge 95\%$ parse-success over production runtime files vs. cluster-level exclusion), neutral trade-offs, required Tree-sitter error-rate logging evidence, and designates the Academic Project Supervisor as approving authority.
  3. The reported pending decision count in Section 14.2 text (12) now perfectly matches the 12 rows in the table.

---

## 4. Empirical Verification Evidence

### A. Repository Revision Audit Evidence
The following git commands were executed on 2026-10-15 to audit the evaluated checkouts:

1. **Fastify Repository Audit:**
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\fastify" log -1 f736849a10a9b2ca57fb09437feb8294cda76234 --format="commit: %H%ndate: %cd%nauthor_date: %ad%nsubject: %s"`
     - Result: `commit: f736849a10a9b2ca57fb09437feb8294cda76234`, `date: Wed Oct 14 10:44:43 2026 +0200`, `author_date: Wed Oct 14 14:14:43 2026 +0530`, `subject: test(server): assert the server is listening instead of a literal (#6962)`.
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\fastify" describe --tags f736849a10a9b2ca57fb09437feb8294cda76234`
     - Result: `v6.0.0-alpha.4-28-gf736849a`.
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\fastify" show-ref --tags -d | Select-String "v5.0.0$"`
     - Result: `6bde7d7b0a51010d56df901cab9be5d9351b0d91 refs/tags/v5.0.0`.
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\fastify" log -1 6bde7d7b0a51010d56df901cab9be5d9351b0d91 --format="commit: %H%ndate: %cd%nsubject: %s"`
     - Result: `date: Tue Sep 17 16:11:22 2024 +0200`, `subject: Bumped v5.0.0`.
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\fastify" rev-list --count 6bde7d7b0a51010d56df901cab9be5d9351b0d91..f736849a10a9b2ca57fb09437feb8294cda76234`
     - Result: `770` commits.

2. **Flask Repository Audit:**
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\flask" log -1 d086db856be187255b8ec61ef409357393020f32 --format="commit: %H%ndate: %cd%nsubject: %s"`
     - Result: `commit: d086db856be187255b8ec61ef409357393020f32`, `date: Wed Oct 7 07:02:54 2026 -0700`, `subject: fix typing`.
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\flask" describe --tags d086db856be187255b8ec61ef409357393020f32`
     - Result: `3.1.3-99-gd086db85`.
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\flask" show-ref --tags -d | Select-String "3.1.0"`
     - Result: `2efaec117637fa51c6c53588899002def7eee37a refs/tags/3.1.0`, target `ab8149664182b662453a563161aa89013c806dc9`.
   - Command: `git -C "d:\base papers considered\phase_d_eval_repos\flask" log -1 ab8149664182b662453a563161aa89013c806dc9 --format="commit: %H%ndate: %cd%nsubject: %s"`
     - Result: `date: Wed Nov 13 10:20:07 2024 -0800`, `subject: release version 3.1.0`.

### B. Baseline Implementation Blob Digest Verification
Extracted raw byte streams directly from git object storage at baseline commit `17ea399217737f8d5fe2c32c310b69c2f812b84d`:
- **B1** [`src/structural/retrieval/StructuralRetriever.js`](file:///d:/base/papers/considered/Retrospect/src/structural/retrieval/StructuralRetriever.js) (Blob `6dd0952fdb28...`):  
  `9380234C73DEEBDBBC12B498CED34469CD99DE6DEB20DAF94AABFA31CBD2FDD6` (**VERIFIED MATCH**)
- **B2** [`src/retrieval/HistoricalRetrievalAdapter.js`](file:///d:/base/papers/considered/Retrospect/src/retrieval/HistoricalRetrievalAdapter.js) (Blob `0925b42ebe7a...`):  
  `60F114D8770D0A70108BC343C21ACF2C9F4389FC226270DEFFCA3CE6C0BCA965` (**VERIFIED MATCH**)
- **B2 (Helper)** [`src/retrieval/HistoricalRetriever.js`](file:///d:/base/papers/considered/Retrospect/src/retrieval/HistoricalRetriever.js) (Blob `3a65a798846d...`):  
  `2499CD9BD20A2C1FB01EDDB890D84483AABC8DE40502F3F3AF1EFF135328CA90` (**DISAMBIGUATED**)
- **B3** [`src/retrieval/UnifiedSearch.js`](file:///d:/base/papers/considered/Retrospect/src/retrieval/UnifiedSearch.js) (Blob `4a0ba342d19f...`):  
  `156E4149BA57BF17B4E0B92ED2968F57510E987595CF4EBEAAC791FF695B844E` (**VERIFIED MATCH**)
- **B4** (`HistoricalBM25Retriever.js`):  
  `N/A` (**VERIFIED UNIMPLEMENTED**)
- **S1** [`src/retrieval/RRFv2.js`](file:///d:/base/papers/considered/Retrospect/src/retrieval/RRFv2.js) (Untracked working-tree file):  
  `343B7819766333A2691130C33CA72A2D5D128F361734869946B98B70289A84F6` (**VERIFIED POST-BASELINE CANDIDATE**)

---

## 5. Distinction Between Executed Checks and Documented Procedures

- **Executed Checks:**
  1. Empirical git inspection of Fastify and Flask commit hashes, tags, commit dates, author dates, and commit counts.
  2. Extraction and hashing of raw git blob bytes from baseline commit `17ea399`.
  3. Working-tree cleanliness check via `git status --porcelain` on Retrospect, Fastify, and Flask.
  4. Inspection and record auditing of Phase B manifest files.
  5. Empirical cluster inventory audit: verified underlying cluster records in Section 1.2 and Section 2.4 of [`phase_d_data_collection_plan_draft.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_data_collection_plan_draft.md), confirming 11 Fastify clusters and 7 Flask clusters (18 total provisional clusters) resulting from the Sans-I/O consolidation.
- **Documented Only Procedures (Deferred to Future Authorized Phases):**
  1. Option B CSPRNG salt generation, pre-selection SHA-256 commitment, and candidate selection.
  2. Execution of GitHub Search API queries across the 4 source categories and population of the 10-Field Ledger.
  3. 5-stage ground-truth firewall execution.
  4. B4 engineering implementation.
  5. S1-Abstain operating curve evaluations.
  6. Werkzeug–Flask committer overlap audit.

---

## 6. Sections Changed and Sections Left Unchanged in Version 3.5

### Sections Changed in Version 3.5:
- **Section 1 & Header:** Updated protocol version to 3.5; documented the 6 major corrections, 5 narrow consistency refinements, and technical consistency verifications; reaffirmed blocked gate status.
- **Section 4.3:** Reordered candidate processing to enforce pre-deduplication canonicalization; reconciled cluster slug regex; added synthetic deduplication example; updated Python pseudocode to explicitly use `ASCII_WHITESPACE_CHARS = ' \t\r\n'` and `strip(ASCII_WHITESPACE_CHARS)`.
- **Section 5.2:** Replaced string concatenation with unambiguous binary length-prefixed `RetrospectSymbolIDV1:` serialization; formalized language-specific signature rules (JS arity/rest, TS normalized types with punctuation whitespace collapsed and return types omitted, Python keyword parameters preserved with exact case, Java qualified types with type erasure); defined lexical scope hierarchy as dot-delimited enclosing declarations while strictly excluding nested local closures (`ERROR_LOCAL_NESTED_SYMBOL`); corrected synthetic SymbolID example byte counts (29B signature, 112B total payload); clarified that length-prefixed serialization eliminates delimiter ambiguity while SHA-256 collisions are computationally infeasible rather than mathematically impossible; formally enforced DEC-19 language grammar blocking.
- **Section 6.1:** Added comprehensive empirical revision audit table separating evaluated checkout commits from official release tags.
- **Section 6.2:** Replaced improper REST endpoints with GitHub Search API specifications (`/search/issues?q=...`); specified HTTP methods, parameters, rate limits, and local changelog distinction.
- **Section 6.4 & 7:** Structured 5-stage independent ground-truth firewall; documented solo-researcher mitigation protocols and residual risks.
- **Section 9:** Explicitly documented inclusion of S1/B4 and exclusion of B1/B2/B3 from abstention analysis; completely harmonized candidate-level score invalidation ($\text{Score}^*(s) = -\infty$) with query-level abstention semantics ($R_{\text{valid}}(q) = \emptyset \lor S_{\text{top}}(q) < \tau$); aligned all metric formulas ($\text{Cov}$, $\text{FAR}_D$, $\text{cMRR@100}$) with unified predicate.
- **Section 14:** Restructured into Section 14.1 (Master Lifecycle Decision Register DEC-01 through DEC-22, establishing operational evidence status for every inherited decision) and Section 14.2 (Dedicated Table of Human Decisions covering all 12 pending decisions requiring supervisor/reviewer sign-off), aligning DEC-19 Option A to cover only JS and Python with Java/TS strictly blocked, and citing the verified 11 Fastify + 7 Flask cluster breakdown under DEC-22.
- **Section 15:** Updated document change log.

### Sections Deliberately Left Unchanged:
- **Section 2:** Research questions (EQ1 through EQ7) and exploratory epistemic boundaries.
- **Section 3:** Baseline commit `17ea399217737f8d5fe2c32c310b69c2f812b84d` reference and verified system file hashes.
- **Section 4.1 & 4.2:** Metric tiers, cluster-weighted difference estimand, and Option 1 vs. Option 2 primary estimand alternatives.
- **Section 5.1 & 5.3–5.5:** Repository qualitative diversity target, 6-layer contamination audit framework, Werkzeug Pallets audit hypothesis, and AST parser compatibility heuristic.
- **Section 8.1 & 8.2:** Evaluated system definitions and deterministic BM25 positive-score ranking semantics.
- **Section 10:** Primary metrics, stratified multi-dimensional reporting, and qualitative case study designs.
- **Section 11:** Non-inferential bootstrap interpretation and small-strata discrete support limitations.
- **Section 12:** Purposive sampling limitations, fixed-factor scope, and algorithmic non-superiority boundaries.
- **Section 13:** Operational gate checkpoints.
- **Section 16:** Formal operational gate statement.

---

## 7. Dedicated Table of Human Decisions Pending Approval

To ensure an unbroken audit trail across all versions, Section 14 of Version 3.5 provides:
1. **Section 14.1 (Master Lifecycle Decision Register):** Catalogs every decision from **DEC-01 through DEC-22**, recording its operational evidence status (`VERIFIED`, `FROZEN`, `APPROVED / CONSENSUS`, or `PROPOSED — PENDING FORMAL APPROVAL/DECISION`). This accounts for all decisions inherited from earlier protocol versions.
2. **Section 14.2 (Dedicated Table of Human Decisions):** Catalogs all **12 material decisions** that remain `PENDING APPROVAL` before data collection can begin, summarized below:

| Decision ID | Dimension | Options | Neutral Trade-Off Summary | Provisional Recommendation | Approving Authority |
|:---:|---|---|---|---|:---:|
| **DEC-03** | **Candidate S1 Status** | **Option A:** Commit S1 to repository.<br>**Option B:** Freeze working-tree file via SHA-256 seal. | Committing establishes clean git tracking; SHA-256 seal preserves baseline commit `17ea399`. | **Option A (commit on evaluation branch)**. | Academic Project Supervisor |
| **DEC-04** | **Baseline B4 Inclusion** | **Option A:** Implement B4.<br>**Option B:** Exclude B4. | Option A provides standard IR contrast (EQ6); Option B avoids new engineering. | **Option A (Implement B4)**. | Academic Project Supervisor |
| **DEC-06** | **Unit of Analysis** | **Option A:** Equal cluster weighting ($1/M$).<br>**Option B:** Query-weighted mean. | Equal cluster weighting estimates performance over refactoring events; query weighting over query instances. | **Option A as primary**, with dual reporting of Option B. | Independent Methodological Reviewer |
| **DEC-07** | **Query Cap** | **Option A:** Include all.<br>**Option B:** Fixed cap $m_{\max}$. | Option A maximizes refactoring coverage; Option B balances cluster weighting. | **Option B ($m_{\max}=5$)** with CSPRNG salt commitment. | Academic Project Supervisor |
| **DEC-11** | **Werkzeug–Flask Audit Hypothesis** | **Option A:** Retain as explicit hypothesis.<br>**Option B:** Treat as confirmed dependency. | Option A avoids premature conclusions before Checkpoint 2 commit audit; Option B assumes relationship. | **Option A (retain as hypothesis)** to be audited in Checkpoint 2. | Independent Methodological Reviewer |
| **DEC-13** | **AST Parser Compatibility Metric** | **Option A:** Require $\ge 95\%$ parse success.<br>**Option B:** Exclude only failing clusters. | Option A ensures broad parser reliability; Option B avoids discarding entire repos for isolated parse errors. | **Option A** with cluster-level exclusion fallback. | Academic Project Supervisor |
| **DEC-17** | **Primary Estimand** | **Option 1:** Evolution-focused (A & B primary, C control).<br>**Option 2:** All-answerable (A, B, C pooled). | Option 1 isolates refactoring events (EQ1); Option 2 evaluates broad utility but dilutes effect size. | **Option 1 (Evolution-focused)** with Category C control reporting. | Academic Project Supervisor |
| **DEC-18** | **BM25 Abstention Grid** | **Option 1:** Fixed numerical grid.<br>**Option 2:** Dev-calibrated percentile grid. | Option 1 guarantees zero data peeking; Option 2 aligns grid points with data but requires dev split. | **Option 1** if sample size is constrained; **Option 2** if pilot split approved. | Academic Project Supervisor |
| **DEC-19** | **Language SymbolID Rules & Grammar Scope** | **Option A (Provisional Approval Scoped to JS & Python Only):** Approve provisional JS/Python rules; keep Java & advanced TS strictly blocked.<br>**Option B (Universal Grammar Block):** Block all languages pending multi-language audits. | Option A enables evaluation on audited JS/Python codebases while preventing unvetted ambiguities; Option B is maximally conservative upfront. | **Option A (provisional approval scoped strictly to JavaScript and Python)**; Java and advanced TypeScript remain strictly blocked. | Independent Methodological Reviewer |
| **DEC-20** | **Evaluated Revision Alignment** | **Option A:** Retain October 2026 checkouts.<br>**Option B:** Re-pin checkouts to release tags. | Option A evaluates modern cumulative history; Option B evaluates historical state at tagged releases. | **Option A** (retain checkouts; document tag distance). | Academic Project Supervisor |
| **DEC-21** | **Solo-Researcher Workflow** | **Option A:** Staged temporal firewall.<br>**Option B:** Dual-reviewer blinded adjudication. | Option A is practically feasible for solo researcher; Option B eliminates cognitive bias. | **Option B** for sample audit (20% of cases); **Option A** for primary authoring. | Independent Methodological Reviewer |
| **DEC-22** | **Lineage Cluster Inventory Target** | **Option A:** Minimum 18 audited clusters across Fastify/Flask (verified as 11 Fastify + 7 Flask in Section 2.4 of data collection plan).<br>**Option B:** Strictly require $\ge 20$ clusters via third repository. | Option A enables immediate study progression on verified codebases. Option B increases cluster diversity but delays unblocking for expansion audits. | **Option A** with expansion repositories serving as exploratory generalization checks. | Academic Project Supervisor |

---

## 8. Document Integrity and Preservation Confirmation

1. **Predecessor Files Preserved Unaltered:**
   - [`phase_d_v3_4_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_4_exploratory_protocol.md) was read for reference and preserved **100% unchanged**.
   - [`phase_d_v3_4_correction_report.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_4_correction_report.md) remains unchanged.
   - [`phase_d_v3_3_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_3_exploratory_protocol.md) remains unchanged.
   - [`phase_d_v3_3_correction_report.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_3_correction_report.md) remains unchanged.
   - [`phase_d_v3_2_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_2_exploratory_protocol.md) remains unchanged.
   - [`phase_d_v3_1_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_1_exploratory_protocol.md) remains unchanged.
   - [`phase_d_v3_exploratory_protocol.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_v3_exploratory_protocol.md) remains unchanged.
   - [`phase_d_data_collection_plan_draft.md`](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/phase_d_data_collection_plan_draft.md) (Version 2.7) remains unchanged.
   - [`benchmark_protocol.md`](file:///d:/base/papers/considered/Retrospect/docs/phase_d/benchmark_protocol.md) and [`annotation_guidelines.md`](file:///d:/base/papers/considered/Retrospect/docs/phase_d/annotation_guidelines.md) remain unchanged.
2. **Repository Working-Tree Integrity:**
   - Zero commits, branches, or tags were created in `Retrospect`, `fastify`, or `flask`.
   - Zero tracked source files were modified. Working-tree cleanliness was verified via git.

---

## 9. Final Operational Stop Directive

> ### **MANDATORY DIRECTIVE: PHASE D STATUS REMAINS CLOSED / BLOCKED**
>
> **The Retrospect Phase D Version 3.5 Protocol is a PROPOSAL ONLY.**  
>
> In accordance with strict methodological governance:
> 1. No natural-language benchmark queries may be authored or finalized.
> 2. No ground-truth annotations or evaluation cases may be created.
> 3. No candidate repository checkouts may be mutated.
> 4. No dataset manifests or train/development/test splits may be generated.
> 5. No retrieval pipelines (B1, B2, B3, B4, S1) may be executed on benchmark queries.
> 6. No abstention threshold tuning or score-based calibration may occur.
> 7. No power simulations or statistical significance tests may be conducted.
> 8. Quarantined Phase C material and Phase B targets remain strictly quarantined and blacklisted.
>
> **The operational gate remains STRICTLY CLOSED AND BLOCKED pending formal review, amendment, and written approval of this Version 3.5 protocol by the Academic Project Supervisor and an Independent Human Methodological Reviewer.**
