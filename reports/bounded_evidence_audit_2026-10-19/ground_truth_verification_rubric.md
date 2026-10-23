# Ground-Truth Verification Rubric: Lineage & Retrieval Case Evaluation

**Author:** Retrospect Evidence Verification Audit  
**Date:** 2026-10-19  
**Status:** Approved Audit Framework  

---

## 1. Objective and Principles

This rubric establishes rigorous, reproducible, and evidence-driven criteria for evaluating whether a benchmark case constitutes **verified ground truth** for historical and structural code retrieval evaluation in Retrospect.

In prior audits, syntactic criteria (such as whether code compiles or parses to an Abstract Syntax Tree) were sometimes conflated with historical lineage validity. This framework strictly separates:
1. **Source validity** (code parses/compiles at a single snapshot),
2. **Schema validity** (JSON payload conforms to syntactic validation schemas), and
3. **Historical Lineage & Target Validity** (true, verifiable code evolution linking a query/predecessor to a target symbol across Git revisions).

A benchmark record cannot be certified as verified ground truth based merely on compilation success, AST validity, name similarity, or algorithmic retrieval output.

---

## 2. The 5-Level Verification Hierarchy

To achieve certification as **Verified Ground Truth**, a benchmark case must satisfy the five progressive evidentiary levels detailed below.

```
+-----------------------------------------------------------------------+
| Level 5: Provenance & Independent Reproducibility                     |
+-----------------------------------------------------------------------+
                                  ^
+-----------------------------------------------------------------------+
| Level 4: Evaluation-Target Integrity & Task Unambiguity               |
+-----------------------------------------------------------------------+
                                  ^
+-----------------------------------------------------------------------+
| Level 3: Historical Transition Evidence (Git DAG / Refactoring Diff)  |
+-----------------------------------------------------------------------+
                                  ^
+-----------------------------------------------------------------------+
| Level 2: Symbol Identity & Unambiguous Resolution                     |
+-----------------------------------------------------------------------+
                                  ^
+-----------------------------------------------------------------------+
| Level 1: Repository & Revision Identity (Git Commit Integrity)        |
+-----------------------------------------------------------------------+
```

---

### Level 1 — Repository and Revision Identity
- **L1.1 Repository Identifiability:** The target repository is clearly identified by an authoritative, immutable URL/identifier (e.g., `google/guava`, `expressjs/express`, `pallets/flask`).
- **L1.2 Pin Revision Integrity:** The evaluation revision commit hash (`source_revision_sha`) must exist in the authentic repository Git DAG. Synthetic or placeholder SHAs fail this check.
- **L1.3 Origin Revision Integrity:** If a historical transition is claimed from an earlier commit (`origin_commit_sha`), that commit must also exist in the authentic repository Git DAG and be an ancestor of (or reachable from) the evaluation revision.
- **L1.4 Tree correspondence:** The checked-out source tree at the stated commit must match the documented file structure.

---

### Level 2 — Symbol Identity and Disambiguation
- **L2.1 Snapshot Existence:** The target symbol must exist in the file tree at the specified evaluation revision (`source_revision_sha`).
- **L2.2 Scope & Path Specificity:** The target symbol must have a fully qualified path, enclosing namespace/class, and exact function or method identifier.
- **L2.3 Disambiguation of Overloads and Clones:** If multiple overloads, duplicate function names, or multi-module sibling packages exist (e.g., Guava JRE vs. Guava Android, or identical function names across submodules), the target must be uniquely distinguishable via exact file path and signature.
- **L2.4 Predecessor Symbol Existence:** The predecessor symbol must have existed in the source tree at the claimed origin commit prior to the transition.

---

### Level 3 — Historical Transition Evidence
- **L3.1 Definitive Git DAG Transition:** A concrete Git commit (or sequence of commits) must document the transformation from predecessor to successor.
- **L3.2 Identifiable Lineage Event:** The relationship must be supported by an explicitly classified change:
  - *Extract Method / Function:* Predecessor logic extracted into a new function.
  - *Rename / Move:* Symbol renamed, relocated to a utility class, or moved across module boundaries.
  - *Inline / Replace:* Predecessor deprecated or removed and replaced by successor.
  - *API Evolution:* Signature update or encapsulation change.
- **L3.3 Distinguishing True Lineage from Chance Resemblance:** The evidence must prove causal historical derivation rather than accidental convergence or coincidental similarity between two independent functions. Diffs, commit messages, or RefactoringMiner AST-diff proofs must be cited.

---

### Level 4 — Evaluation-Target Integrity
- **L4.1 Correspondence to Transition:** The benchmark's declared expected target must correspond directly to the documented transition.
- **L4.2 Realistic Information Need:** The evaluation query must represent a plausible developer information need (e.g., a reference to the legacy function name, a deprecated API query, or an evolved task description).
- **L4.3 Independence from Evaluated System:** The ground-truth target must have been identified prior to and independently of the evaluated retrieval systems (B1–B4). Ground truth must never be adjusted to match what a system happens to retrieve.
- **L4.4 Distractor Discrimination:** The case must define or allow testing against eligible distractors (e.g., other methods in the same class, obsolete overloads) to verify discriminatory ranking power.

---

### Level 5 — Provenance and Reproducibility
- **L5.1 Traceable Audit Trail:** The record must document who authored or extracted the case, what tool/script was used, and when it was verified.
- **L5.2 Independent Verifiability:** An independent researcher, using only the repository clone and the case specification, must be able to inspect the Git history and arrive at the identical lineage judgment.
- **L5.3 Schema & Metadata Completeness:** The case record must conform to the benchmark's normative schema without missing mandatory validation properties or corrupted enum values.

---

## 3. Separation of Orthogonal Dimensions

To prevent confusion between code syntax and historical lineage, three dimensions are kept strictly separate:

| Dimension | Scope | Verification Tool | Does it prove lineage? |
|---|---|---|---|
| **Syntactic / AST Validity** | Can the code be parsed at snapshot $T$? | Tree-sitter, Babel, `javaparser`, `ast` | **NO.** Parsing proves only that valid code exists at $T$. It provides zero evidence of historical evolution. |
| **Repository Buildability** | Does `mvn compile` or `npm build` succeed? | Maven, Gradle, NPM, Cargo | **NO.** Buildability proves dependencies and type resolution. A completely static codebase without historical changes can compile perfectly. |
| **Schema Conformance** | Does JSON match `retrieval-case.schema.json`? | Ajv, JSON Schema validator | **NO.** A syntactically valid JSON record can contain fabricated Git SHAs. Conversely, a record with real Git history may fail schema validation due to a missing optional field. |
| **Historical Lineage Evidence** | Did symbol $A$ at commit $C_1$ evolve into symbol $B$ at commit $C_2$? | Git log, `git diff`, RefactoringMiner, blame | **YES.** This is the sole authoritative proof of historical derivation. |

---

## 4. Case Adjudication Classification

Every evaluated case is assigned one of four definitive verdicts:

### 1. `VERIFIED`
- **Requirements:** Satisfies **Levels 1, 2, 3, 4, and 5** in full.
- **Status:** Unconditional ground truth suitable for confirmatory comparative benchmarking.
- **Conditions:** Both Git commits exist in authentic repositories; target and predecessor are unambiguous; diff proves the lineage transition; query represents the predecessor; provenance and schema are sound.

### 2. `PARTIALLY VERIFIED`
- **Requirements:** Satisfies **Levels 1 and 2**, and has authentic Git transition evidence (**Level 3**), BUT:
  - Fails **Level 4** (e.g., lacks declared hard negative distractors, or query is slightly ambiguous), OR
  - Fails **Level 5** (e.g., extracted heuristically by an automated tool without human sign-off, or fails JSON schema validation on required metadata fields), OR
  - Possesses a synthetic placeholder SHA that requires translation to the true historical ancestor commit.
- **Status:** Admissible for **limited descriptive diagnostics** only; not admissible for confirmatory hypothesis testing.

### 3. `UNVERIFIED`
- **Requirements:** Fails **Level 1** or **Level 2** or lacks verifiable **Level 3** transition evidence.
- **Status:** Cannot be used for evaluation.
- **Conditions:** Commits missing from Git history; symbols not found at specified revisions; no diff or commit message demonstrating that predecessor transitioned into successor.

### 4. `CONTRADICTED`
- **Requirements:** Direct evidence refutes the claimed lineage.
- **Status:** Corrupted or invalid ground truth; must be purged or quarantined.
- **Conditions:** Predecessor and successor were created independently; Git history proves they coexisted with distinct semantics prior to the claimed event; or the target symbol does not perform the function claimed in the case description.

---

## 5. Mandatory Threshold for Benchmark Decisions

- **Confirmatory Benchmarking (Claiming B4 > B1):** Requires $\ge 95\%$ of evaluated cases to be classified as `VERIFIED`.
- **Diagnostic / Exploratory Benchmarking:** Can admit `PARTIALLY VERIFIED` cases, provided their specific limitations (such as missing hard negatives or schema non-conformance) are explicitly declared in all performance reports and metrics are labeled as provisional.
