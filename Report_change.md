# Retrospect — Project Handover Report (`Report_change.md`)

| Field | Value |
|---|---|
| Report date | 2026-10-21 |
| Prepared by | Claude Code (Opus 5.5), from a read-only inspection of the workspace |
| Supersedes | The earlier Antigravity version of this file (104 KB, written 2026-10-21 11:15). A byte-for-byte backup is outside the project at `C:\Users\ASUS\AppData\Local\Temp\claude\D--base-papers-considered-Retrospect\eca0045e-3041-4f81-a97f-b9d9576ebd5c\scratchpad\Report_change.antigravity_backup.md`. Section 19.3 lists every place where this report corrects it. |
| Project root | `D:\base papers considered\Retrospect` (Git repo, branch `eval-reframing-empirical-study`, HEAD `17ea399`) |
| Dataset workspace | `D:\base papers considered\Test creation` (not a Git repo) |
| Clone fleet | `D:\clones` (27 Git clones), plus other clones listed in Section 7 |
| Environment (checked) | Windows 11 Home Single Language 10.0.26200, Node v22.17.1, npm 10.9.2, Jest 30.5.2, git 2.50.1.windows.1 |
| Test status (checked) | `npm test`: 19 suites, 157 tests passed (35.9 s) on 2026-10-21. See the warning in Section 20.3: this command rewrites tracked files. |

## How to read this report

Every significant claim has one of these labels:

- **[Verified]**: I checked it directly in this session (code, data, git, or my own recomputation).
- **[Reported]**: an earlier report or the Antigravity hand-off says it; I did not check it independently.
- **[Inferred]**: my interpretation of the evidence, labelled as such.
- **[Proposed]**: an idea that has not been built or evaluated.
- **[Unresolved]**: the evidence is missing, conflicting or inaccessible.

Paths inside the project are relative to the project root. Paths outside it are absolute.

---

## Table of Contents

1. Executive Summary
2. Project Identity and Original Motivation
3. Evolution of the Research Question
4. Current Research Question and Contribution
5. Project Timeline and Milestones
6. Repository and Directory Map
7. Cloned-Repository Inventory
8. Dataset Inventory and Provenance
9. Dataset Construction and Verification History
10. Technical Architecture and Data Flow
11. Implementation Map and Important Source Files
12. Technology Stack and Environment
13. Evaluation Methodology and Metrics
14. Experiment Configurations and Baselines
15. Experiment Results and Statistical Analysis
16. Historical-Rescue and Failure Analysis
17. Engineering Investigations and Rejected Approaches
18. Related Work and Base Paper
19. Git State, Reproducibility, and Known Discrepancies
20. How to Run the Existing Project
21. Current Research Status and Defensible Claims
22. Decisions Log
23. Remaining Work and Prioritized Plan
24. Proposed Future Architecture
25. Instructions and Warnings for Future Claude Code Sessions
26. Glossary
27. Appendix: Artifact Paths, Evidence Sources, and Unresolved Questions

---

# 1. Executive Summary

**What Retrospect is.** Retrospect is a deterministic Node.js research prototype. It retrieves functions and methods from a repository using two channels **[Verified]**:

1. A **structural channel** over the current checkout. This uses Tree-sitter ASTs, identifiers, docstrings, paths and the call graph.
2. A **historical channel** that reads Git history. It runs `git log --topo-order -n H`, matches functions across commits with `FunctionMatcher`, and lets current symbols inherit the names, commit messages and diff tokens of their predecessors.

The two channels can be fused, either linearly or with reciprocal-rank fusion (RRF). No embeddings, LLMs or external services are used.

**Research question.** The project has narrowed from "structure plus history beats structure" to a smaller question: *can Git-history retrieval recover the current successor of a refactored (renamed) method when retrieval over the current repository misses it or ranks it poorly, and what limits this?* (Section 3.)

**What the evidence actually supports.**

1. **Historical rescue occurs, but only in a few cases. It is anecdotal, not statistical [Verified].** Three cases had the target in the historical top-10 while the structural channel missed the top-10. All three are Java method renames whose refactoring commit was inside the 50-commit topological window:
   - `CASE-HIST-JAVA-0013` (checkstyle `getMessages`→`getViolations`: B1 unranked, B2 rank 2)
   - `CASE-HIST-JAVA-0049` (undertow `getResource`→`getBuffer`: B1 14, B2 4)
   - `CASE-HIST-JAVA-0019` (checkstyle `getMessage`→`getViolation`: B1 27, B2 3)

   RRF fusion (B4) moved all three into the top-10, at ranks 8, 1 and 5.
2. **The primary cohort has 5 cases from 5 origin commits.** On it, B4 Success@10 is 80% against 60% for B1, and MRR is 0.3652 against 0.1893 **[Verified recomputation]**. With 5 clusters this cannot be statistically significant: the minimum exact sign-permutation p-value is 0.0606. The audit's exact test gives p = 0.576 for the MRR difference **[Reported, audit CSV]**.
3. **Fusion harms more cases than it rescues across the 45-case census [Verified].** There are 3 rescues (B1 outside the top-10, B4 inside) and **9 harms** (B1 inside, B4 outside). Pooled over the census, B4 Success@10 is 44.4% against 57.8% for B1. Linear fusion B3 (55.6%) beats B4 (44.4%) on that pooled set.
4. **Historical success is a reachability step, not a gradual decay [Verified].** Of 15 cases whose origin commit falls inside the `--topo-order -n 50` window, 9 (60%) have the target in the historical top-10. Of 19 reachable-but-outside cases, 0 do. The "60% → 30% → 0%" decay curve quoted in earlier reports could not be reproduced from any artifact (Section 15.4).

**Most important problems found in this session.** Most were not in the earlier Antigravity hand-off.

- **The "Category D quarantined negatives" are not negative queries [Verified].** The four cases `0031`, `0034`, `0048` and `0050` were rejected for defective ground truth: spurious RefactoringMiner matches, a malformed query ("discard in new"), and a class/file mismatch. The audit directed that they be *excluded from all evaluation runs*. They were evaluated anyway and relabelled as "abstention controls". The claim "0% false-positive rate / safe abstention" built on them is not valid evidence.
- **8 of 11 cross-language pilot cases have origin commits that do not exist in the (full, non-shallow) clones [Verified].** The pilot's `lineage_verification.md` nevertheless marks their ancestry "Verified" with specific distances. That claim is false. The earlier explanation of "shallow clones" is also false: every `D:\clones` repo is non-shallow.
- **`research/reproducibility_record.md` has a wrong pin table [Verified].** 9 of the 11 checked pin SHAs do not exist in the clones and do not match the pins actually used.
- **`research/evaluation_results_report.md` has copy errors [Verified].** Its B3 column duplicates B4 in every cohort. Its anchor-cohort outcome counts and census totals also disagree with the per-case CSV.
- **The per-case census CSV silently loses columns [Verified].** `research/per_case_empirical_results.csv` has empty `commit_distance` and `stage_a_reachability` columns because the generator reads the wrong column names. As a result:
  - No case is ever classified as a horizon failure.
  - `category_breakdown.csv` reports all 45 cases as "No Distance" and "Behavioral-Only".
- **The horizon-label defect is still live [Verified].** The `OUTSIDE_SEARCH_HORIZON` defect (Section 15.5) persists in production code: `src/evaluation/RetrospectEvaluator.js:216` still uses `git rev-list --count`. The defect was only corrected post hoc in an audit CSV.
- **Running `npm test` rewrites 20 tracked files [Verified].** These are the Phase C author-pack cards and the blind key, and only their timestamp fields change. Section 20.3 has the details.

**Bottom line.** The defensible paper is an **exploratory case study**. It shows that, within a bounded history window, Git-history retrieval *can* recover renamed-method successors that current-code retrieval misses (3 documented cases). It also characterises where this fails: reachability, ambiguity guards, vocabulary mismatch. And it shows that naïve fusion can hurt. Universal improvement claims and statistical claims are not supported.

**Smallest next step.** Fix the reporting layer, not the algorithms (Section 23):

1. Regenerate the census tables with correct columns.
2. Drop or relabel the rejected cases.
3. Fix or exclude the cross-language provenance.
4. Commit the working tree.

---

# 2. Project Identity and Original Motivation

- **Name:** Retrospect. The package name is `retrospect` v1.0.0. The remote is `https://github.com/K-NagaCharan/RETROSPECT.git`, as recorded in `D:\base papers considered\Report_now.md` **[Reported]**.
- **Author:** K-NagaCharan (all 6 commits) **[Verified]**.
- **Original motivation** (`README.md`, `Report_now.md`, `docs/RETROSPECT_PROJECT_PROGRESS_REPORT.md`) **[Reported]**:
  - Repository-level code search and RAG tools for LLMs index only the current snapshot (HEAD).
  - When code is renamed, moved, extracted or rewritten, a query that uses older vocabulary no longer matches. Examples are an old API name from a bug report, documentation or a stack trace.
  - Git history keeps the missing link: commits, diffs and earlier names.
  - The original proposition, quoted from `Report_now.md` §1: fusing structural and historical lineage evidence would "significantly improve current symbol retrieval, particularly across renames, relocations, and rewrites", deterministically and without embeddings.
- **Earlier roots [Reported]:**
  - Before Retrospect, the user explored multi-track evaluation designs (`scripts/create_tracks.py`, `scripts/create_adapters.py`).
  - A separate prototype in `D:\base papers considered\laya testing` ("Laya" router and embedding experiments) evaluated candidate-matching methods on CodeTracker, RefDiff and PyRef style instances.
  - Its relationship to Retrospect is only partly documented. `laya testing\EXPANDED_RESEARCH_REPORT.md` names both directories.

---

# 3. Evolution of the Research Question

| Stage | Question as framed | Evidence that changed it | Source |
|---|---|---|---|
| Original (≈Oct 10–14) | Fusing structural and historical evidence significantly improves retrieval in general. | Phase B (40 queries, 4 repos): RRF had the best MRR on the test split. But the "0% false positive" result was an artefact: a fixed 0.20 score threshold that RRF scores (max ≈ 0.0164) can never reach. | `README.md` §C; `docs/RETROSPECT_PROJECT_PROGRESS_REPORT.md` §6.3 **[Verified: code bound; README still repeats the claim]** |
| Phase C/D (Oct 14–15) | Confirmatory evaluation on blinded, externally sourced queries (Express, then Fastify/Flask). | Express exposure and leakage concerns, so Express was blacklisted (DEC-12). Fastify and Flask yielded only 18 provisional lineage clusters, against ≥68 needed for Gate 1 and ≥32 for Gate 2. Hard stop; the protocol was redesigned as exploratory v3.5. | `docs/RETROSPECT_PROJECT_PROGRESS_REPORT.md` §8–9; `docs/phase_d/*` **[Reported]** |
| Oct 19 diagnostics | Measure B1–B4 on Category A (5) and Category B (29). | Category A: B1 Success@10 60% vs B4 40%. Category B was found defective (provisional lineage, templated queries, horizon). `reports/LEGACY_RESULTS_NOTICE.md` declared all earlier numbers "legacy diagnostic — not evidence". | `reports/RETROSPECT_EXPERIMENTAL_RESULTS.md`, `reports/LEGACY_RESULTS_NOTICE.md` **[Verified]** |
| Oct 20 reframing (current) | "Under what conditions does historical retrieval recover code that current-repository structural retrieval misses, and what limits its effectiveness?" Sub-questions EQ1–EQ4. | The pooled 45-case census showed B4 below B1. An audit attributed this to mixing cohorts and stratified the results. | `research/research_question_and_methodology.md`, `Test creation\experiments\final_multirepo_evaluation_audit_2026-10-20\audit_findings.md` **[Verified]** |
| Owner's statement (this hand-off) | Primary: *Can Git-history retrieval recover relevant predecessor or historical implementations of refactored methods that are missed or poorly ranked by retrieval over the current repository?* Complementary: the Oct 20 conditions question. | Not yet reflected in any repository document. | User brief **[Reported]** |

**Why the narrowing was necessary [Inferred from the artifacts above].** Two things forced it:

- The general-superiority claim failed on the data the project produced. B4 is below B1 on the pooled census, B1 beats B4 on the Oct 19 Category A run, and fusion harms outnumber rescues.
- The available verified cases are too few for confirmatory testing.

**A note on wording.** The owner's primary question mentions recovering "predecessor or historical implementations". The implemented system does something narrower. It ranks **current** symbols, using historical evidence; it never returns a historical implementation as a result (Section 10). Every evaluation target is a *current successor* symbol. A paper must state this precisely: "recovering the current successor of a refactored method, given a query phrased with historical vocabulary".

---

# 4. Current Research Question and Contribution

**Why current-code retrieval fails.** After a rename, the old identifier is gone from the current AST. A query containing the old name only gets partial subtoken overlap, for example `getResource` against `getBuffer` (none) or `getMessages` against `getViolations` (only `get`). The structural score then depends on incidental signals such as class names, paths and docstrings.

**What Git history adds.** The historical channel adds three kinds of evidence:

- The rename commit's diff contains both names.
- `FunctionMatcher` links the old and new function across that commit.
- The current symbol inherits `historicalNames`, commit-message tokens and diff tokens, so a query that uses the old name can now match it.

**What counts as historical rescue.** Rescue means the target is in the historical channel's top-10 (B2 ≤ 10) while the structural channel misses the top-10 (B1 > 10 or unranked). The census classifier implements exactly this as outcome "A". Note what rescue does *not* require:

- It is measured on the **current successor**, not on predecessor recovery.
- The Stage B lineage label (`RENAMED_SYMBOL`, `AMBIGUOUS`, and so on) is recorded per case but is not part of the definition. Retrieving the target does not prove the lineage link was found. For example, `0101` and `0044`–`0046` succeed with an `AMBIGUOUS` match.

**How the owner's outcome taxonomy maps to the artifacts:**

| Owner's category | What the artifacts can support |
|---|---|
| Historical rescue | Outcome A (3 cases) **[Verified]** |
| Shared success | Outcome B (7) **[Verified]** |
| No unique historical contribution | Outcome C (19) **[Verified]** |
| Incorrect historical candidate | Not measured. No per-case log of B2's top-1 correctness exists in the census. **[Unresolved]** |
| Ambiguous lineage | Stage B `AMBIGUOUS` (7 cases) **[Verified]** |
| Abstention | B2 rank null (31 of 45) **[Verified]** |
| Horizon failure | Reconstructable from `is_in_topo_50` in the audit CSV (19 cases unreachable). Missing from the research CSV. **[Verified]** |
| Other failure | `VOCABULARY_OR_DIFF_MISMATCH` / `AMBIGUITY_GUARD_SUPPRESSION` labels exist, but the first absorbs the horizon failures (Section 15.3). |

**Contribution a paper can claim.** See Section 21.

---

# 5. Project Timeline and Milestones

The sources are Git commits (exact), file modification times (approximate) and the reports cited. All dates are 2026.

| Date | Milestone | Evidence |
|---|---|---|
| ≤ Oct 10 | Concept; literature reading (`maybe 4.pdf` survey); "laya testing" prototype | Parent directory files **[Reported]** |
| Oct 10 11:42 | `1b44d64`: multi-language historical retrieval pipeline (Tree-sitter adapters, `GitHistoryReader`, `FunctionMatcher`, `HistoryTracker`) | git **[Verified]** |
| Oct 10 12:10 | `418fb31`: benchmark evaluation and runner scripts | git **[Verified]** |
| Oct 10–12 | First benchmarks (`data/benchmark_lineage*.json`, `benchmark_external_*`, structural benchmark of 22 instances); audits v1–v3 | `data/` mtimes **[Verified]** |
| Oct 13 21:50 | `f083a64`: structural retrieval subsystem, fusion strategies, Phase B evaluation | git **[Verified]** |
| Oct 13 16:08Z | Phase B run #1 (`data/phase_b_evaluation_results.json`) | file metadata **[Verified]** |
| Oct 14 04:30Z | Phase B run #2 after lineage stitching (`data/phase_b_evaluation_results_stitched.json`); this is the source of the README table | **[Verified]** |
| Oct 14 08:05–13:50 | `9ae8c0e` Phase C discovery and blinded authoring; `3b0c0ea` unified search, transitive stitching, author pack; `17ea399` docs. Phase C security audit; Express blacklisted (DEC-12) | git; `Report_now.md` **[Verified / Reported]** |
| Oct 14 | `Report_now.md` (16 suites, 92 tests at that time) | **[Reported]** |
| Oct 14–15 | Phase D feasibility on Fastify/Flask (`phase_d_eval_repos`); 18-cluster deficit; protocol v3.0→v3.5; 22-entry decision register | `docs/phase_d/`, progress report **[Reported]** |
| Oct 16 | `Test creation` workspace (436-case catalog and splits, repository catalog) | `Test creation\README.md` **[Reported]** |
| Oct 19 | RefactoringMiner 3.1.6 mining (`mined_refactorings/`); Category B dataset (29 Java cases); Oct 19 diagnostic run; bounded evidence and consistency audits; Category B repair (schema); independent Category B audit (5 verified / 20 needs_review / 4 rejected); `LEGACY_RESULTS_NOTICE.md` | `reports/*2026-10-19`, `Test creation\audits\category_b_java_audit_2026-10-19` **[Verified]** |
| Oct 19 21:14–21:55 | New evaluation modules: `RRFv2.js`, `RetrospectEvaluator.js`, `ClusterBootstrap.js`, `SplitGuard.js` (untracked) | mtimes **[Verified]** |
| Oct 20 AM | 8-case engineering diagnostic (normalization, module multipliers, prefilter); `QueryProcessor` changes (11:39) | `reports/evaluator_preparation_2026-10-19/engineering_diagnostic_final_report.md` **[Verified]** |
| Oct 20 midday | Cross-language pilot dataset (`historical_pilot_v1_2026-10-20`); historical diagnostics v1–v3 (merge-aware) | `Test creation\experiments\historical_retrieval_diagnostic_v*` **[Reported]** |
| Oct 20 18:24–18:54 | `HistoricalRetrievalAdapter.js` and `GitHistoryReader.js` (merge-aware) last modified | mtimes **[Verified]** |
| Oct 20 ≈20:18 | 45-case multi-repo evaluation (`final_multirepo_evaluation_merge_aware_2026-10-20`) | **[Verified]** |
| Oct 20 20:45 | Integrity audit producing corrected per-case CSV and stratified tables | `final_multirepo_evaluation_audit_2026-10-20` **[Verified]** |
| Oct 20 21:10–21:20 | `research/` deliverables generated (contain the defects in Section 19) | **[Verified]** |
| Oct 20 21:48–21:57 | `retrospect_historical_rescue_v1` pilot (14 relabelled cases, "frozen before retrieval", never evaluated) | **[Verified]** |
| Oct 21 11:15 | Antigravity `Report_change.md` | **[Verified]** |
| Oct 21 | This report | — |

---

# 6. Repository and Directory Map

## 6.1 Project root (`D:\base papers considered\Retrospect`)

| Path | Role | Git state |
|---|---|---|
| `src/` | Implementation (Sections 10–11) | Mixed: 4 files modified, 5 untracked |
| `tests/` | 19 Jest suites (unit, integration, evaluation) | 3 modified, 3 untracked |
| `scripts/` | 61 scripts: Phase A–C runners, audits, CLI, generators (7 untracked) | mostly tracked |
| `scratch/` | Oct 19–20 analysis and evaluation scripts, including `run_full_multirepo_evaluation.js`, `evaluate_snapshot_worker.js`, `generate_research_deliverables.js`, `audit_horizon_discrepancy.js`, and `snapshot_cache/` (15 index caches) | untracked |
| `research/` | Oct 20 paper-oriented deliverables (Section 15; several are defective, Section 19) | untracked |
| `reports/` | Oct 16–20 diagnostic, audit and legacy reports | untracked |
| `docs/` | Progress report (Oct 15), schema specs, `phase_d/` protocol v3.5 | untracked |
| `schemas/` | `evaluation-result.schema.json` | untracked |
| `data/` | Phase A/B benchmarks and results, `phase_c/`, `fixtures/`, `external_repos/` (gitignored, 4 shallow clones) | tracked except `external_repos` |
| `exported_packs/phase_c_author_pack/` | 19 blinded Phase C cards (rewritten by tests, Section 20.3) | modified |
| `README.md`, `STRUCTURAL_RETRIEVAL.md` | Oct 14 documentation (stale relative to Oct 20 work) | tracked |

## 6.2 Outside the project

| Path | Role | Accessible |
|---|---|---|
| `D:\base papers considered\Test creation` | Dataset construction, audits, experiments (Section 8). Includes `tools\RefactoringMiner-3.1.6` | Yes |
| `D:\clones` | 27 evaluation and candidate clones (Section 7) | Yes |
| `D:\base papers considered\phase_d_eval_repos` | Fastify and Flask clones for Phase D | Yes |
| `D:\base papers considered\laya testing` | Earlier prototype and dataset inventory | Yes |
| `D:\base papers considered\Report_now.md` | Oct 14 progress report | Yes |
| `D:\base papers considered\maybe 4.pdf` | SDLC benchmark survey (Section 18) | Yes |
| `C:\Users\ASUS\.gemini\antigravity-ide\brain\739cb121-…\` | Antigravity's own reports (Phase B audit, Phase C/D plans) referenced by `docs/` | Yes (listed, contents not read in detail) |

---

# 7. Cloned-Repository Inventory

I ran read-only git commands (`config`, `rev-parse`, `rev-list --count`, `status --porcelain`, `cat-file -e`, `merge-base --is-ancestor`) on every clone. **All `D:\clones` repositories are full (non-shallow) clones with clean working trees, checked out on their default branch.** None is at an evaluation pin.

A key point about how evaluations use the clones: `scratch/evaluate_snapshot_worker.js` runs `git checkout --detach <pin>` inside `D:\clones\<repo>` and then checks the original branch back out. If it cannot, it falls back to `master`. Running the evaluation therefore mutates the clones' checked-out state (Section 20.4).

## 7.1 `D:\clones`

"Pins verified" means I confirmed with `cat-file` that every pin and origin SHA used in the Oct 20 census exists, and that ancestry and distances reproduce exactly.

| Repo dir | Remote | Lang | Branch / HEAD | Commits | Pin(s) used (Oct 20 census) | Census cases | Role |
|---|---|---|---|---:|---|---|---|
| checkstyle | checkstyle/checkstyle | Java | master / 7092d5f | 18037 | `10a3a0777ced`; anchor `aa6faae95a98` | 9: 0001, 0005, 0013, 0019, 0020, 0028, 0029, 0031, HIST-JAVA-001 | **Active evaluation** (pins verified) |
| graphhopper | graphhopper/graphhopper | Java | master / df93278 | 7107 | `c7497d1100a4` | 8: 0055, 0058, 0078, 0096, 0097, 0099, 0101, 0105 | **Active** (verified) |
| undertow | undertow-io/undertow | Java | main / 77dc917 | 6295 | `cf3abec9145b` | 8: 0043–0050 | **Active** (verified) |
| datastax-java-driver | datastax/java-driver | Java | trunk / c2043c5 | 1959 | `f4240267b3a3` | 5: 0034–0039 | **Active** (verified). Loader needed a hyphen-path fix. |
| guava | google/guava | Java | master / 669a232 | 7559 | `db74bd2fdac4` | 2: STRUCT-JAVA-001, HIST-JAVA-002 | **Active** (pin verified; anchor origin = pin) |
| requests | psf/requests | Py | main / 611c616 | 6495 | `147c8511ddbf` | 1: STRUCT-PY-002 | **Active** (pin verified). Same SHA was once recycled into a fake moment case. |
| zod | colinhacks/zod | TS | main / 680d19f | 3247 | `e7a9b9b30339` | 1: STRUCT-TS-004 | **Active** (pin verified). Pilot inventory lists a different pin, `ca42965d`. |
| httpx | encode/httpx | Py | master / b5addb6 | 1523 | `26d48e0634e6` | 2: PY-001, PY-002 | **Active, exploratory** (origin `2ba9c1ed90` verified, k=726) |
| pytest | pytest-dev/pytest | Py | main / 420cf37 | 17826 | `d0f136fe64f9` | 1: PY-003 | **Active, exploratory**. Origin `41d8fb09ca` **not in clone**. |
| marshmallow | marshmallow-code/marshmallow | Py | dev / d08471b | 3751 | `1407d5102ae0` | 1: PY-004 | **Active, exploratory**. Origin `06310b49f0` **missing**. |
| moment | moment/moment | JS | develop / c2a703a | 4132 | `000ac1800e62` | 2: JS-001, JS-002 | **Active, exploratory**. Both origins **missing**. |
| mocha | mochajs/mocha | JS | main / cb21a4e | 4226 | `d5766c887e72` | 1: JS-003 | **Active, exploratory** (origin verified, k=201) |
| vue | vuejs/core | TS | main / 08f5abf | 7231 | `770ea67a9cdb` | 2: TS-001, TS-002 | **Active, exploratory**. Both origins **missing**. |
| rxjs | ReactiveX/rxjs | TS | master / 54796b3 | 5976 | `72bc92191ab9` | 2: TS-003, TS-004 | **Active, exploratory**. Both origins **missing**. |
| lodash | lodash/lodash | JS | main / 2b5e6f7 | 7710 | `f299b52ff3` (**missing** from clone) | 0 (JS-004 excluded) | Dataset source; case excluded |
| robovm | robovm/robovm | Java | master / ef09190 | 2823 | `630fad8974…` | 0 (0111, 0118, 0125 excluded: AST memory blow-up) | Mined source; excluded |
| axios | axios/axios | JS | v1.x / 8d8e844 | 2238 | pilot inventory pin `5b8a8267` exists | 0 | Pilot candidate source (0 cases authored) |
| black | psf/black | Py | main / 56a7ee6 | 2401 | `1b2427a2` exists | 0 | Pilot candidate source (0 authored) |
| fastapi | tiangolo/fastapi | Py | master / 3070b51 | 7849 | `40e33e49` exists | 0 (1 authored per inventory, not evaluated) | Pilot candidate source |
| jest | facebook/jest | JS | main / 61050e9 | 7786 | `4e569916` exists | 0 (1 authored, not evaluated) | Pilot candidate source |
| koa | koajs/koa | JS | master / 2fecd02 | 1312 | `77cbf2e4` exists | 0 (1 authored, not evaluated) | Pilot candidate source |
| typeorm | typeorm/typeorm | TS | master / fe92394 | 6086 | `3d55188c` exists | 0 (2 authored, not evaluated) | Pilot candidate source |
| svelte | sveltejs/svelte | TS | main / 40bb084 | 11446 | `d8b31333` exists | 0 | Pilot candidate source (0 authored) |
| **quasar** | **puniverse/quasar** (Java fibers) | **Java** | master / db0ac29 | 2494 | inventory pin `cd6ea732` **missing** | 0 | **Mislabelled.** The pilot inventory and reconnaissance report treat it as `quasarframework/quasar` (TypeScript). It is a different project. |
| jfinal | jfinal/jfinal | Java | master / 0e0af15 | 1794 | — | 0 | Unresolved. Appears in `Test creation\reports` candidate lists only. |
| sonarqube | sonarsource/sonarqube | Java | master / e3b4618 | 40181 | — | 0 | Unresolved (candidate lists only) |
| spring-boot | spring-projects/spring-boot | Java | main / 57a1ca3 | 63361 | — | 0 | Unresolved (`reports/draft/events_spring-boot.json` exists; not evaluated) |

Three inconsistencies in the pilot inventory **[Verified]**:

- Its pin list differs from the census pins for zod (`ca42965d` vs `e7a9b9b3`).
- Several "commits" counts are from today's HEAD, not the pins.
- It lists 12 accepted cases (including lodash), but other repos it says authored cases (fastapi, jest, koa, typeorm) do not appear among the 11 evaluated. The evaluated 4/3/4 Python/JS/TS split comes from `historical-pilot-v1` per `research/evidence_inventory.md`. **[Unresolved]**: which inventory is authoritative.

## 7.2 Other clones

| Path | Remote | HEAD | Shallow | Role |
|---|---|---|---|---|
| `Retrospect\data\external_repos\bottle` | bottlepy/bottle | 8ec5fe2 | **yes** | Phase B (Python) **[Inferred from Phase B metadata]** |
| `…\external_repos\express` | expressjs/express | a419aa7 | **yes** | Phase B / Phase C (JS). Blacklisted (DEC-12). Not in `D:\clones`. |
| `…\external_repos\gson` | google/gson | 845664b | **yes** | Phase B (Java) |
| `…\external_repos\zod` | colinhacks/zod | 284243f | **yes** | Phase B (TS). **Duplicate** of `D:\clones\zod` at a different HEAD; not interchangeable. |
| `D:\base papers considered\phase_d_eval_repos\fastify` | fastify/fastify | f736849a | no (4902) | Phase D feasibility (pin matches progress report) |
| `…\phase_d_eval_repos\flask` | pallets/flask | d086db85 | no (5562) | Phase D feasibility |
| `D:\base papers considered\laya testing\data\repos\dit` | dit/dit | 23fcb940 | no | Laya prototype (PyRef-style) |
| `…\laya testing\data\repos\redux` | reduxjs/redux | 56abca47 | no | Laya prototype |
| `…\laya testing\data\repos\chartjs` | — | — | — | **Not a Git repo** (plain files) |
| `Test creation\experiments\historical_retrieval_diagnostic_v2_2026-10-20\worktrees\CASE-HIST-JAVA-0005` | — | — | — | Leftover worktree directory. It is not registered in `checkstyle`'s `git worktree list`. |

**Implication [Inferred].** The Phase B historical results came from shallow clones of bottle, express, gson and zod. History depth there was limited by clone depth, which is a validity threat for Phase B. It does not affect the Oct 20 census.

---

# 8. Dataset Inventory and Provenance

Counts below come from the files themselves unless marked otherwise. "Used in" lists only experiments where I found the dataset referenced by a runner or result file.

## 8.1 Datasets actually used in the Oct 20 census (45 cases)

| Dataset | Path | Lang / repos | Records | Construction | Verification status | Used in |
|---|---|---|---:|---|---|---|
| **Category B repaired** | `Test creation\results\category_b_benchmark_repair_2026-10-19\category_b_repaired.json` (mirror in `Retrospect\reports\category_b_benchmark_repair_2026-10-19\`; SHA-256 `acb2e388…`) | Java: checkstyle, graphhopper, undertow, java-driver | 29 | RefactoringMiner 3.1.6 "Rename Method" events mined from the 4 repos (`mined_refactorings/*.json`). Queries are **templated** ("Locate current implementation corresponding to historical method X in Class"); `query.authoring_method = synthetic_templated`. Two AST hard negatives per case (via `javalang`). | Pins and origins all exist; distances reproduce **[Verified]**. All 29 have `adjudication.status = provisional`, with **0 human-adjudicated** **[Verified]**. The independent audit (`Test creation\audits\category_b_java_audit_2026-10-19\report.md`) classes them as **5 verified, 20 needs_review, 4 rejected** **[Reported]**. All 29 are labelled `rename`. | Oct 19 diagnostic (29); Oct 20 census (all 29, cohorts below) |
| **verified-pilot-v1** (hard-coded in `scratch/run_full_multirepo_evaluation.js`) | inline objects in the runner | guava, requests, zod, checkstyle | 5 | Hand-written early pilot cases (Category A of Oct 19). One more (`CASE-STRUCT-JS-003`, express) was excluded. | Pins exist **[Verified]**. HIST-JAVA-001/002 have origin = pin (k=0), so the "historical" event is HEAD itself. | Oct 19 Cat A; Oct 20 census |
| **historical-pilot-v1** (cross-language) | `Test creation\datasets\historical_pilot_v1_2026-10-20\` | Py/JS/TS: httpx, pytest, marshmallow, moment, mocha, vue, rxjs (+lodash) | 12 accepted, 10 pending, 28 rejected (of 50) **[Reported]** | Machine-assisted mining of rename events; behavioural natural-language queries; 0 human adjudication. | **8 of 11 evaluated cases cite origin commits absent from the full clones [Verified]**. The dataset's `lineage_verification.md` claims "Verified" ancestry for all 12. This is false for those 8. Only PY-001, PY-002 and JS-003 are verifiable. JS-004 (lodash) is excluded because its pin is missing. | Oct 20 census (11) |

## 8.2 Other datasets in `Test creation\datasets`

| Dataset | Path (under `Test creation\datasets\`) | Records | Notes | Used in Oct 20 census |
|---|---|---:|---|---|
| historical-symbol-retrieval (original Cat B) | `custom/historical-symbol-retrieval/data/historical-cases.json`; `lineage-events.json` | 32 cases; 119 events | Source of Category B before repair (261 schema errors per repair report). 3 RoboVM cases excluded. | Superseded by repaired file |
| structural-symbol-retrieval | `custom/structural-symbol-retrieval/data/structural-cases.json` | 17 | 14 contained synthetic or recycled SHAs (excluded); 3 promoted to verified-pilot **[Reported, evidence_inventory]** | Indirectly (3) |
| refactoring-lineage-retrieval | `custom/refactoring-lineage-retrieval/data/refactoring-cases.json` | 42 | RefactoringMiner traces without authored queries; excluded | No |
| historical-confounders-hard-negatives | `custom/historical-confounders-hard-negatives/data/negative-cases.json` | 100 | Synthetic negatives; reported 100% referential-integrity failure; excluded | No |
| combined-structural-historical | `custom/combined-structural-historical/data/combined-cases.json` | 79 | Early combined catalog | No **[Unresolved: whether ever used]** |
| exploratory_java_v1 / _reconciled / _frozen | `exploratory_java_v1*/` | 5 accepted; 20 remaining; 4 quarantined | Packaging of the Category B audit outcome. `quarantine_manifest.json` documents the 4 rejected cases. | Indirectly (same cases) |
| java_secondary | `java_secondary/` | 32 / 42 / 471 / 1032 | Copies of the original Cat B and refactoring cases plus large quarantine dumps | No |
| quarantine | `quarantine/quarantine_dataset_b.json` (471), `_c.json` (1032) | — | Quarantined bulk candidates (duplicated in java_secondary) | No |
| **retrospect_historical_rescue_v1** | `retrospect_historical_rescue_v1/` | 14 (categories A–I) | Built Oct 20 21:48–21:57, **after** the census, and "FROZEN_BEFORE_RETRIEVAL". Cases are **relabelled census cases**: A-0001 = 0105, A-0002 = 0020, B-0001 = 0049 (labelled "extraction" though it is a rename), H-0001 = rejected 0048, I-0001 = 0047, and so on. Every case is duplicated in a nested `datasets/` subfolder. The quality report claims "14/14 verified". | **Never evaluated** |
| existing/refactoring-miner-corpus | `existing/refactoring-miner-corpus/data/oracle-data.json` | 550 | RefactoringMiner oracle sample (7 MB) | Background only |
| existing/codesearchnet, codexglue-code-search, bigclonebench | `existing/*` | 100 queries / 3 / 2 / 1 samples | Small samples and specs only | No |
| benchmarks/splits | `Test creation\benchmarks\splits\` | dev 254 / val 107 / test_confirmatory 75 (=436) | Oct 16 catalog splits. `audit_benchmark_splits.py` found a shared SHA across splits (`147c8511…`). Built largely from the legacy custom datasets above. | No (SplitGuard designed for it) |
| mined_refactorings | `Test creation\mined_refactorings\*.json` (+ root `undertow_mined.json`) | per-repo RefactoringMiner output | Raw mining for Category B (checkstyle, datastax, graphhopper, undertow, robovm) | Source |

## 8.3 Retrospect-internal datasets (`Retrospect\data`)

| File | Content | Used in |
|---|---|---|
| `structural_eval_benchmark.json` | 22 structural instances (internally authored) | Structural benchmark (README §B: test 100% R@1). Diagnostic only. |
| `benchmark_lineage*.json` (v0, audited, v2, v3) + `evaluation_lineage_queries*.json` (v1–v4) | 40 Phase B lineage queries over bottle, express, gson, zod (17+3 dev, 17+3 test) | Phase B runs (benchmark v3 + queries v4) **[Verified from metadata]** |
| `benchmark_external_dev/test.json`, `audit_*`, `detailed_*`, `historical_evaluation_results*.json`, `initial_audit_pass.json` | Oct 10–12 early benchmarks and audits | Early diagnostics |
| `phase_c/` | Phase C Express discovery, blind key (rewritten by tests) | Phase C (not executed as an evaluation) |
| `src/evaluation/benchmarks/labeled_dataset.json` | 13-instance Phase 1 matcher benchmark **[Inferred]** | `HistoryEvaluator` |

## 8.4 Verification ladder for the census cases

| Stage | Cat B (29) | verified-pilot (5) | historical-pilot (11) |
|---|---|---|---|
| Collected | 29 | 5 | 11 (of 50 candidates) |
| Structurally valid (schema, target parses) | 29 (repaired schema passes) **[Reported]** | 5 | 11 **[Reported]** |
| Provenance-verified (pin and origin exist, ancestry) | **29 [Verified]** | 5 pins **[Verified]**; 3 have no origin | **3 [Verified]**; 8 origins missing |
| Semantically verified lineage | 5 by automated audit; **0 by a human** | 2 anchors trivially (k=0) | 0 |
| Eligible for the primary claim | **5** (0105, 0013, 0005, 0047, 0049) | 0 | 0 |

**Gap assessment (no new collection recommended).**

- The primary claim rests on 5 Java rename cases from 4 repositories, all of type *rename*.
- Extractions, moves, splits/merges and rewrites are **not represented by any verified case**.
- Python, JavaScript and TypeScript have **no** provenance-valid case with a reachable origin.
- The smallest justified responses are in Section 23. Re-verifying or fixing the 8 pilot origins is cheaper than collecting new cases.

---

# 9. Dataset Construction and Verification History

1. **Oct 10–13 (Phase A/B).** Internally authored lineage benchmarks were iteratively audited (v1→v3). The 40-case audit reclassified 9 "rewrite" cases as routine modifications and fixed 8 path and symbol errors **[Reported]**.
2. **Oct 14 (Phase C).** Express queries leaked identifiers ("Locate current implementation corresponding to historical method …"). Express was blacklisted (DEC-12) **[Reported]**.
   - **This same template is still used by all 29 Category B queries and therefore by every primary-cohort case [Verified].** It embeds the predecessor name and the enclosing class name.
   - The class name is a strong structural cue: it matches the target's scope and path tokens. This aids B1 and is a construct-validity threat.
3. **Oct 15–16.** Catalog and splits (436 cases) in `Test creation`. Later audits found synthetic or recycled SHAs (14 structural, 100 negatives) and excluded them **[Reported]**.
4. **Oct 19.** RefactoringMiner mining, then Category B (32 → 29 after RoboVM exclusion).
   - The schema repair downgraded all cases from "verified" to "provisional".
   - The bounded consistency audit found expected-behaviour labels were naïvely inferred from distance.
   - The independent audit: 5 verified, 20 needs_review (18 beyond 50 commits by `rev-list`; 2 query-class anachronisms, 0019 and 0020), 4 rejected.
5. **Oct 20.** Cross-language pilot built; census assembled with **hard-coded cohort sets** in `scratch/run_full_multirepo_evaluation.js:239-255`:
   - `in_policy_primary` = the 5 audit-verified cases.
   - `quarantined_negative` = the 4 rejected cases.
   - Everything else in Category B became `distance_stratified_diagnostic`.

   That third cohort is therefore **not** defined by distance. It includes 0019 and 0020 (k=36, inside the horizon; excluded for query anachronism) and 0101/0044/0045/0046 (topologically reachable).
6. **Oct 20 21:5x.** `retrospect_historical_rescue_v1` relabelled existing cases into nine evolution categories; not evaluated.

---

# 10. Technical Architecture and Data Flow

The flow below is the one used by the Oct 20 census (`scratch/evaluate_snapshot_worker.js`), mirrored by `src/evaluation/RetrospectEvaluator.js` **[Verified]**.

```
query text ──► QueryProcessor (identifier split, camel/snake, stemming, stopwords, kind intent)
                │
pin SHA ─► git checkout --detach <pin> in D:\clones\<repo>   (worker only; restores branch after)
                │
                ├─► StructuralIndex(current tree) ─► StructuralRetriever.score  ─► B1 scores/ranks
                │      (Tree-sitter adapters: Java/Py/JS/TS; symbols, exact-name & inverted
                │       indexes, call graph; min score 0.08)
                │
                └─► GitHistoryReader.getCommitHistory(pin, maxCount=H=50, --topo-order)
                       ─► per commit: diff-tree name-status/patch (merge commits' composite diffs skipped)
                       ─► FunctionMatcher (old vs new functions per changed file)
                       ─► HistoricalRetrievalAdapter.buildHistoricalProfiles
                            (transitive stitching: current symbol inherits historicalNames,
                             commit-message tokens, diff tokens, historical docstrings;
                             confidence certain/uncertain)
                       ─► HistoricalRetrievalAdapter.score ─► B2 scores/ranks (score>0 only)
                │
                ├─► B3 = HistoricalRetrievalAdapter.fuseScores(S, H, {0.60, 0.40})
                └─► B4 = fuseRRFv2(pool, S-list, H-list, {k:60, wS:0.50, wH:0.50})
                       zero-signal gating, fractional average ranks for ties, id tie-break
                │
                ▼
     rank of ground-truth target symbol per configuration (full candidate pool)
```

**Implemented [Verified]:**

- Structural retrieval.
- Merge-aware topological history traversal.
- Two-tier function matching with an ambiguity guard.
- Transitive lineage stitching.
- Linear, adaptive and RRF fusion.
- RRF-v2.
- Three-stage evaluator.
- Cluster bootstrap and split guard.

**Not implemented [Verified by absence]:**

- Returning historical implementations as results.
- Path-following history (`git log --follow`).
- Structural-then-historical dependent retrieval (Section 24).
- Cross-channel score calibration.
- `HistoricalBM25Retriever` (the DEC-04 "B4" of the Phase D protocol).

**Stage definitions in `RetrospectEvaluator.js`:**

- **Stage A (reachability)** uses `git rev-list --count origin..pin` ≤ H (line 216–242). This is **inconsistent with the traversal actually used** (Section 15.5).
- **Stage B** maps match types: `EXACT_PREDECESSOR`, `RENAMED_SYMBOL`, `AMBIGUOUS`, `UNMATCHED`, and so on.
- **Stage C** computes ranks and Success@K/MRR.

---

# 11. Implementation Map and Important Source Files

Constants were checked in the source on 2026-10-21. "Hash match" means the file's SHA-256 equals the fingerprint recorded in the Oct 20 audit's `reproducibility_manifest.txt` **[Verified]**.

| File | Responsibility | Key facts | Git / hash |
|---|---|---|---|
| `src/structural/index/StructuralIndex.js`, `discovery/RepoDiscoverer.js` | Discover files (gitignore-aware), build symbol, exact-name and inverted indexes and the call graph | — | tracked, unmodified |
| `src/structural/retrieval/StructuralRetriever.js` | **B1** | Weights exact .35, token .25, docstring .15, path .10, signature .05, graph .05, kind .05. Min score 0.08. ×0.15 if a 3+-term query matches only one term. ×0.65 for test files when tests are not requested. It is a weighted feature score, **not BM25/TF-IDF** (as some reports claim). | unmodified; hash match |
| `src/structural/query/QueryProcessor.js` | Query normalisation | Modified Oct 20 11:39 (stemming, all-token handling) | **modified**; hash match |
| `src/git/GitHistoryReader.js` | Git interface | `getCommitHistory(repo, start, maxCount=50, options)`; default `--topo-order`; optional `--first-parent`; dedupe | **modified** (merge-aware, Oct 20 18:53); hash match |
| `src/matcher/FunctionMatcher.js`, `SimilarityUtils.js` | Cross-commit function matching | Tier 1: exact hash 1.0; qualified name + signature 0.98; name + scope with token Jaccard ≥0.25 → 0.90+0.08·J. Tier 2 weights: tokens .35, name .25, signature .15, scope .15, params .10. High ≥0.70, moderate ≥0.50. Ambiguity delta 0.08. | unmodified; hash match |
| `src/retrieval/HistoricalRetrievalAdapter.js` | **B2**, profile building, linear/adaptive fusion | Weights historicalName .40, commitMessage .30, diffTerms .20, historicalDocstring .10. **Uncertain-lineage multiplier 0.65** (not 0.50). Min score 0.05. `buildHistoricalProfiles` **defaults to `maxCommits=100`**; the census passed 50. `fuseScores` default 0.60/0.40 with optional `normalizeActiveChannels`. | **modified** Oct 20 18:23; hash match |
| `src/retrieval/RRFv2.js` | **B4** | k=60; defaults wS = wH = **0.50**. (The JSDoc header still says 0.60/0.40: a doc/code mismatch.) Zero-signal gating; fractional average ranks; deterministic id order | untracked; hash match |
| `src/retrieval/UnifiedSearch.js`, `HistoricalRetriever.js` | Oct 14 unified API (Phase B parity) and the older historical retriever | Used by Phase B scripts, README API | tracked |
| `src/evaluation/RetrospectEvaluator.js` | Three-stage evaluator, B1–B4 | Stage A uses `rev-list --count` (defect) | untracked; hash match |
| `src/evaluation/BenchmarkCaseLoader.js` | Load cases, resolve clones (hyphen fix), check pins | Modified after the recorded hash (Oct 20 21:13; hash ≠ record `bbfb597b…`) | untracked |
| `src/evaluation/ClusterBootstrap.js`, `SplitGuard.js` | Origin-commit cluster bootstrap; sealed-split guard | — | untracked |
| `src/evaluation/HistoryEvaluator.js`, `StructuralEvaluator.js`, `evaluationRunner.js` | Oct 10 evaluators (`npm run evaluate`) | Legacy | tracked |
| `scratch/run_full_multirepo_evaluation.js`, `scratch/evaluate_snapshot_worker.js` | **Actual runner of the Oct 20 census** (hard-coded cohorts and pilot cases) | Checks out pins in the clones | untracked; hashes recorded in the audit |
| `scratch/generate_research_deliverables.js` | Builds `research/*.csv/json` from the audit CSV | Column-name bug (Section 19) | untracked |
| `scripts/run_benchmark_evaluator.js` | CLI over `RetrospectEvaluator` (`--dataset`, `--split`) | Writes results files | untracked |
| `scripts/structural_cli.js` | Structural search CLI | `search <repoPath> "<query>" [--limit n] [--budget tokens]` | tracked |
| `scripts/evaluate_phase_b_fusion.js` | Phase B runner | Uses the invalid 0.20 FP threshold | tracked |

---

# 12. Technology Stack and Environment

- **Runtime [Verified]:** Node v22.17.1, npm 10.9.2, Jest 30.5.2 (`npm test` = `jest --runInBand --detectOpenHandles`), git 2.50.1.windows.1, Windows 11 Home Single Language.
  - Earlier reports say "Windows 11 Enterprise/Professional", "npm 10.8.2", "Jest 29.7.0" and "Git 2.44+". These do not match this machine.
- **Dependencies:** `web-tree-sitter` ^0.20.8 and `tree-sitter-wasms` ^0.1.13 (WASM grammars for Java/Python/JavaScript/TypeScript). `node_modules` is present.
- **Python** is used by audit and dataset scripts (`javalang` for hard negatives, `pypdf`) **[Reported]**. Not needed for the core engine.
- **Java** is needed only for RefactoringMiner 3.1.6 (`Test creation\tools`).
- **No external APIs, embeddings or secrets [Verified]** (no API-key usage found in `src/`).
- **Path assumption:** clones are hard-coded at `D:/clones` (loader and runner). Git is invoked with `-c core.longpaths=true` in the runners **[Reported, audit config]**.

---

# 13. Evaluation Methodology and Metrics

- **Target:** the rank of the ground-truth *current* symbol among all symbols in the full candidate pool at the pin. Unranked (score 0 in that channel) counts as reciprocal rank 0.
- **Metrics:** Success@1/5/10 (one target per case, so this equals Recall@K) and MRR.
- **Outcome classes** (`scratch/generate_research_deliverables.js`) **[Verified]**:
  - A historical-advantage: B2≤10 ∧ B1>10.
  - B shared: both ≤10.
  - C structural-only: B1≤10 ∧ B2>10.
  - D neither.
- **Fusion impact:** rescue (B4≤10 ∧ B1>10), harm (B1≤10 ∧ B4>10), otherwise neutral.
- **Unit of independence:** the origin commit. There are 38 distinct values in the research CSV; the audit uses M=33 for the pooled test.
- **Statistics:**
  - The research report uses a B=1000 origin-cluster bootstrap.
  - The audit (`corrected_statistical_analysis.csv`) uses exact sign-permutation for M≤5 and a B=2000 cluster bootstrap elsewhere.
  - The two give **different CIs for the same comparison** (primary ΔMRR CI: research [−0.013, +0.365] vs audit [−0.168, +0.589]). Use the audit's, because it is conservative.

---

# 14. Experiment Configurations and Baselines

**Label drift is real. Never merge numbers across experiments by label [Verified].**

| Experiment | B1 | B2 | B3 | B4 | Other |
|---|---|---|---|---|---|
| Phase B (Oct 13–14) | "Config 1" structural only | "Config 2" historical | "Config 3" linear 0.6/0.4 (README) | — | Config 4 adaptive, 5 max-anchor, 6 RRF (k=60, RRF-v1 with fallback ranks), 7 residual boost |
| Progress report / Phase D protocol v3.5 (Oct 15) | structural | historical | **RRF-v1** | **proposed `HistoricalBM25Retriever` (DEC-04, never built)** | S1 = RRF-v2 |
| Oct 19 diagnostic | structural (report text mislabels it "BM25/TF-IDF") | historical | linear 0.6/0.4 | RRF-v2 (weights 0.60/0.40 per the 8-case diagnostic, "baseline") | — |
| Oct 20 AM 8-case diagnostic | structural | historical | linear (baseline vs normalised) | RRF-v2 baseline 0.60/0.40 vs "modified" 0.50/0.50 | — |
| **Oct 20 census (current)** | `StructuralRetriever` | `HistoricalRetrievalAdapter`, H=50, merge-aware topo | `fuseScores` 0.60/0.40, no normalisation | `fuseRRFv2` k=60, 0.50/0.50, zero-signal gating | — |

---

# 15. Experiment Results and Statistical Analysis

## 15.1 Phase B (40 queries; bottle, express, gson, zod; shallow clones)

| Run | File | Test RRF MRR | Test B1 MRR | Note |
|---|---|---:|---:|---|
| #1, 2026-10-13T16:08Z | `data/phase_b_evaluation_results.json` | 0.3318 | 0.2833 | Called the "frozen baseline" in the README tree, but it is the **earlier** run |
| #2 (stitched), 2026-10-14T04:30Z | `data/phase_b_evaluation_results_stitched.json` | **0.3268** | 0.2833 | **Source of the README table** (B2 0.1930, linear 0.2600, R@10 RRF 58.8%) |

**Resolved [Verified]:** the two MRR values come from two runs, not an error. The "0% false-positive rate" for RRF is invalid (0.20 threshold artefact). The README still states it.

**Status:** diagnostic. Queries were internally authored, several contained identifiers, and the clones were shallow.

## 15.2 Oct 19 diagnostic (frozen 17ea399; `Test creation\results\current_version_diagnostic_2026-10-19\`)

| Cohort | B1 S@10 / MRR | B2 | B3 | B4 |
|---|---|---|---|---|
| Category A (5) | 60% / 0.2529 | 20% / 0.1000 | 40% / 0.3065 | 40% / 0.3153 |
| Category B (29) | 58.6% / 0.1750 | 24.1% / 0.1110 | 58.6% / 0.1893 | 55.2% / 0.1708 |

I recomputed the Category A aggregates from the per-case ranks in the same file and they match **[Verified]**. **Internal contradictions in `RETROSPECT_EXPERIMENTAL_RESULTS.md` [Verified]:**

- §7 says B4 has the "highest Recall@10 (60.0%)" and B1 "MRR 0.267". Its own table gives B4 40% and B1 0.2529.
- §5.3 gives `CASE-HIST-JAVA-002` B1 rank 3 and B4 rank 9. Its table and CSV give 4 and 15.

**This is the origin of the "B1 and B4 both 60%" result set.** It is a narrative error in that report, not a separate run.

**The MRR values 0.4079 / 0.4285** quoted in the earlier hand-off appear in **no** project artifact. A full-text search of `D:\base papers considered` found them only in unrelated files and in the Antigravity report itself. Treat them as unsupported.

**The Oct 19 and Oct 20 runs also differ case by case** (for example HIST-JAVA-002 B1: 4 → 117; 0049 B2: abstained → rank 4). Between them `QueryProcessor`, `HistoricalRetrievalAdapter` and `GitHistoryReader` were modified. **[Unresolved]:** which change caused which delta. There is no ablation.

## 15.3 Oct 20 census (45 cases, 14 repos). I recomputed everything from the per-case CSV and it matches.

The source chain is: `final_multirepo_evaluation_merge_aware_2026-10-20/per_case_results.csv` → audit `corrected_per_case_results.csv` → `research/per_case_empirical_results.csv`. Ranks are identical across the chain; only labels differ.

| Cohort (as named in artifacts) | N | B1 S@10 | B2 S@10 | B3 S@10 | B4 S@10 | B1 MRR | B2 MRR | B3 MRR | B4 MRR | Rescue / Harm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| in_policy_primary | 5 | 60.0 | 60.0 | 80.0 | 80.0 | 0.1893 | 0.2186 | 0.3213 | 0.3652 | 2 / 1 |
| verified_structural_pilot ("Category C") | 3 | 66.7 | 33.3 | 66.7 | 66.7 | 0.5025 | 0.1667 | 0.5021 | 0.5012 | 0 / 0 |
| quarantined_negative ("Category D") | 4 | 25.0 | 0.0 | 25.0 | 25.0 | 0.0566 | 0.0018 | 0.0368 | 0.0441 | 0 / 0 |
| distance_stratified_diagnostic | 20 | 65.0 | 30.0 | 60.0 | 40.0 | 0.1826 | 0.1183 | 0.2442 | 0.1734 | 1 / 6 |
| cross_language_exploratory | 11 | 63.6 | 0.0 | 54.5 | 45.5 | 0.2431 | 0.0070 | 0.1512 | 0.1186 | 0 / 2 |
| verified_historical_pilot (anchors) | 2 | 0 | 0 | 0 | 0 | 0.0072 | 0 | 0.0050 | 0.0039 | 0 / 0 |
| **All (pooled)** | 45 | **57.8** | **22.2** | **55.6** | **44.4** | **0.2005** | **0.0899** | **0.2181** | **0.1841** | **3 / 9** |

Outcome counts (all cases): A 3, B 7, C 19, D 16. Stage B labels: UNMATCHED 31, AMBIGUOUS 7, RENAMED_SYMBOL 5, EXACT_PREDECESSOR 2.

**This resolves the user-supplied lead:** "B1 57.78 / B2 22.22 / B3 55.56 / B4 44.44" is exactly the pooled census **[Verified]**.

**Points the earlier narratives omit [Verified]:**

- In the primary cohort, **B3 linear fusion matches B4 on Success@10 (80%) and beats it on Success@5** (80% vs 40%). B4's higher MRR comes from one rank-1 case (0049).
- The primary cohort contains a fusion **harm**: 0047, B1 8 → B4 29.
- "Category C: zero dilution" rests on 3 cases: ΔMRR −0.0013, no Success@K change. That is consistent with no harm on those three, but it is not evidence of general safety.

## 15.4 Horizon "decay"

From the audit CSV (34 cases with a distance) **[Verified]**:

| Grouping | N | B2 top-10 |
|---|---:|---:|
| rev-list k ≤ 50 | 11 | 5 (45.5%) |
| rev-list 51–100 | 8 | 4 (50.0%) |
| rev-list > 100 | 15 | 0 (0%) |
| **in `--topo-order -n 50` window** | 15 | **9 (60.0%)** |
| outside window | 19 | 0 (0%) |

- The "60%" figure is the topological-reachability rate.
- The "30%" (Antigravity) and "33.3%" (`research/evaluation_results_report.md`) figures for 51–100 **are not reproducible** from any artifact I found.
- Historical retrieval cannot succeed at all once the origin is outside the window, by construction. The observed pattern is a reachability cut-off, not a measured decay curve.

## 15.5 The `OUTSIDE_SEARCH_HORIZON` contradiction (resolved, defect still live)

**What was observed.** Cases 0101 (graphhopper) and 0044/0045/0046 (undertow) were labelled `OUTSIDE_SEARCH_HORIZON` in the run's `per_case_results.csv`, yet had B2 ranks 3–6.

**Cause [Verified].**

- Stage A computes `git rev-list --count origin..pin`: 62 for 0101 and 52 for 0044–0046.
- Retrieval uses `git log --topo-order -n 50 pin`, where the origins sit at positions **35** and **34**. I reproduced this.
- So the label and the traversal measure different things.

**Where it still lives.**

- `RetrospectEvaluator.js:216-242` and `scratch/evaluate_snapshot_worker.js:191-204` still contain it.
- The audit fixed the labels only in `corrected_per_case_results.csv` (15 reachable / 19 outside / 11 not-in-DAG or no origin).
- The Antigravity report attributed it to "an early script". It is in the production evaluator.

## 15.6 Statistics (audit, `corrected_statistical_analysis.csv`) [Reported; consistent with my recomputed deltas]

- **Primary B4 vs B1:** ΔS@10 +0.20 (exact sign-permutation p=1.0); ΔMRR +0.176 (p=0.576, CI [−0.168, +0.589]). Not significant. With M=5 the minimum attainable p is 0.0606.
- **Distance diagnostic:** ΔS@10 −0.25 (bootstrap CI [−0.46, −0.04]). This is evidence that **fusion hurts** cases where history is absent.
- **Pooled:** ΔS@10 −0.133 (CI [−0.31, +0.02]).

## 15.7 Latency

Median latencies (B1 599.5 ms, B2 114.5, B3 816.5, B4 838.5) are **[Reported]** in the Antigravity hand-off. I did not locate their source file. The Oct 19 means are in `aggregate_metrics.csv` (Category A B1 4610 ms, including indexing). `docs/latency_measurement_boundary.md` defines the timing boundary.

---

# 16. Historical-Rescue and Failure Analysis (per-case evidence)

**Cases that demonstrate the central claim** (target rescued by history; origin reachable; lineage RENAMED_SYMBOL):

| Case | Repo | Rename | k (rev-list / topo) | B1 | B2 | B3 | B4 | Caveats |
|---|---|---|---|---:|---:|---:|---:|---|
| 0013 | checkstyle | `AbstractCheck.getMessages`→`getViolations` | 36 / 37 | — | 2 | 2 | 8 | Same origin commit as 0019 and 0020 (one event). Automated audit "verified"; not human-adjudicated. |
| 0049 | undertow | `ReferenceCountedPooled.getResource`→`getBuffer` | 23 / 22 | 14 | 4 | 4 | 1 | Same origin as rejected cases 0048 and 0050. In the Oct 19 run B2 abstained, so the result depends on Oct 20 code changes. |
| 0019 | checkstyle | `Violation.getMessage`→`getViolation` | 36 / 37 | 27 | 3 | 3 | 5 | Audit "needs_review": the query uses the *new* class name (anachronism) and leaks the "Violation" token. Supporting, not primary. |

**Shared success (history adds no unique top-10 value):** 0105, 0020, 0101, 0044, 0045, 0046, STRUCT-PY-002. In 0020, B2 improves the rank from 8 to 1, which is promotion within the top-10.

**History found evidence but harmed or failed:**

- **0047** (`send`→`sendInternal`, AMBIGUOUS, B2 147): fusion drops B1 8 → B4 29.
- **0005** (AMBIGUOUS, B2 324).
- Both are ambiguity-guard suppressions in overload- and sibling-dense classes.

**Horizon failures (origin outside the topo-50 window, B2 abstains):**

- 0096, 0097, 0099, 0058, 0055, 0078, 0043, 0001, 0028, 0029, 0035, 0036, 0038, 0039.
- Pilot cases PY-001, PY-002, JS-003.
- Fusion harm then appears whenever B1 had the target (0096, 0058, 0055, 0078, 0039, 0043): B4 only gives a structural-only candidate wS/(60+r), while competitors with spurious historical evidence also collect historical credit.
- These are labelled `VOCABULARY_OR_DIFF_MISMATCH` in the research CSV because of the column bug.

**Invalid ground truth (rejected) but evaluated:** 0031, 0034, 0048, 0050. **They must not be used as negatives or positives.**

**Provenance-invalid:** PY-003, PY-004, JS-001, JS-002, TS-001–TS-004 (origin not in the clone). Their B2 results say nothing about history.

**Anchors (k=0):** HIST-JAVA-001 and 002 have origin = pin, so there is nothing for history to traverse. Both fail all configurations: sibling shadowing and vocabulary gaps.

**Incorrect historical candidate:** not measurable from the stored outputs. Only the target's rank was recorded, not B2's top-1 identity and correctness **[Unresolved]**.

---

# 17. Engineering Investigations and Rejected Approaches

Source: `reports/evaluator_preparation_2026-10-19/engineering_diagnostic_final_report.md`, plus the CSV and traces alongside it. This is an exploratory 8-case diagnostic; nothing here is confirmatory.

| Investigation | Hypothesis | Finding | Decision | Scope |
|---|---|---|---|---|
| Active-channel normalisation for B3 (Option A) | Dividing by active weights removes single-channel dilution | Report: rank regressions on 4/8 (DIAG-02, 03, 05, 06) because raw historical scores (~0.15–0.30) exceed structural ones (~0.10–0.16) | Kept as option `normalizeActiveChannels`, off by default | Diagnostic. **[Unresolved]**: the report's narrative ranks for DIAG-01/02 disagree with its own `engineering_diagnostic_case_results.csv` (e.g. DIAG-02 B1 3 vs 5, B2 21 vs 25). The trace files may come from different runs. |
| Module-aware path multipliers (Option B) | Down-weight `android/`, `guava-gwt` siblings | Not generalisable (monorepos keep primary code off-root) | Rejected / deferred | Guava-specific |
| Inverted-index prefilter (Option C) | >100× speed-up on Guava | 1.2–2.4× (0.9× on common words); dropped 12–608 call-graph-scored candidates | Rejected | Measured on Guava only **[Reported]** |
| RRF weights 0.60/0.40 → 0.50/0.50 | Balanced channels | DIAG-05 got worse (122 → 175); adopted for the census anyway | Adopted (no ablation on the census) | **[Verified in report]** |
| Linear vs RRF | RRF avoids scale mismatch | Phase B: RRF best MRR. Oct 19 Cat A: B1 > B4. Census: B3 ≥ B4 on primary S@5/S@10 and pooled. | **Unsettled.** Do not claim RRF superiority. | — |
| Lexical token gap | Behavioural queries share no tokens with code | DIAG-04/07 score 0 in both channels | Documented limitation | General for lexical systems |
| Sibling shadowing | Duplicate modules tie the target | Guava `ImmutableList.builder` B1 79–134 | Limitation | Multi-module repos |
| Horizon | H=50 limits reach | Confirmed as a reachability cut-off (Section 15.4) | `history_lookback_experiment_plan.md` proposes deeper or `--follow` traversal; not run | — |
| Phase B 0.20 abstention threshold | — | Invalid for RRF | Abstention must use per-system operating curves (DEC-14) | General |
| Ambiguity guard (Δ<0.08) | Avoid false lineage | Suppresses 0005, 0047, TS-003; also yields "successes" with AMBIGUOUS labels | Unchanged | — |

---

# 18. Related Work and Base Paper

**Which paper is "the base paper" is not recorded in any Retrospect artifact [Verified by search].** The candidates in the materials:

- **CodeTracker** (`laya testing\inventory\DATASET_INVENTORY.md`): M. Jodavi and N. Tsantalis, *Accurate Method and Variable Tracking in Commit History*, ESEC/FSE 2022 ([FSE 2022 page](https://2022.esec-fse.org/details/fse-2022-research-papers/1/Accurate-Method-and-Variable-Tracking-in-Commit-History)). Retrospect's tiered matcher is conceptually close, but the code does not cite or reuse it **[Inferred]**.
- **Correction to the inventory and the earlier hand-off.** *Refactoring-aware Block Tracking in Commit History* is by **M. T. Hasan, N. Tsantalis and P. Alikhanifard** ([arXiv 2409.16185](https://arxiv.org/abs/2409.16185v1)). It is not "Jodavi & Tsantalis". arXiv lists it as submitted to IEEE TSE. **[Unresolved]:** its final publication venue and volume. The "TSE Vol. 50 No. 5, May 2024" citation could not be confirmed.
- **The PDF on disk** `maybe 4.pdf`: K. Wang et al., *Software Development Life Cycle Perspective: A Survey of Benchmarks for Code Large Language Models and Agents* (21 pages, LaTeX journal template; reviews 178 benchmarks from 461 papers) **[Verified from the PDF]**. Venue unverified (the "IEEE 2024" label is unconfirmed).
- **Other works cited in project docs [Reported, not re-verified]:**
  - RefactoringMiner (Tsantalis et al., ICSE 2018 / TSE 2020); the tool version used is 3.1.6.
  - RefDiff 2.0 (Silva, da Silva and Valente, TSE 2020).
  - PyRef (Dilhara, Ketkar and Dig).
  - RRF (Cormack, Clarke and Büttcher, SIGIR 2009).
  - CodeSearchNet, CodeXGLUE, BigCloneBench (sample files only).
- **Positioning [Inferred].**
  - CodeTracker-style tools answer "given a method, what is its history?"
  - Retrospect asks the inverse retrieval question: "given vocabulary from the past, which current method?"
  - That inversion, inside a ranked-retrieval evaluation, is the novel framing. It is not a better tracker.

---

# 19. Git State, Reproducibility, and Known Discrepancies

## 19.1 Git state (2026-10-21) [Verified]

- **Branch:** `eval-reframing-empirical-study`, at the same commit as `main` (`17ea399`). There are no commits on the branch yet, no stash, and one remote (`origin/main`).
- **Modified tracked files (26):**
  - `src/git/GitHistoryReader.js`, `src/languages/JavaScriptAdapter.js`, `src/retrieval/HistoricalRetrievalAdapter.js`, `src/structural/query/QueryProcessor.js`.
  - 3 test files.
  - 19 Phase C cards and the blind key (timestamp-only changes caused by running tests).
- **Untracked (core of the current study):**
  - `src/retrieval/RRFv2.js`, `src/evaluation/{RetrospectEvaluator,BenchmarkCaseLoader,ClusterBootstrap,SplitGuard}.js`.
  - 3 test files and 7 scripts.
  - `scratch/`, `research/`, `reports/`, `docs/`, `schemas/`, and this report.
- **Consequence:** the Oct 20 census **cannot be reproduced from any commit**. The audit's `reproducibility_manifest.txt` SHA-256 fingerprints are the only binding to source. They still match the current files, except `BenchmarkCaseLoader.js` relative to `research/reproducibility_record.md`.

## 19.2 Discrepancy register

| # | Discrepancy | Status |
|---|---|---|
| D1 | "57.78/22.22/55.56/44.44" vs "B1 = B4 = 60%" | **Resolved**: pooled census vs a narrative error in `RETROSPECT_EXPERIMENTAL_RESULTS.md` §7 (Section 15.2) |
| D2 | MRR 0.4079 / 0.4285 | **Unsupported**: not in any artifact |
| D3 | `OUTSIDE_SEARCH_HORIZON` with B2 rank ≤ 6 | **Resolved** (rev-list vs topo); **defect still in code** |
| D4 | Phase B MRR 0.3268 vs 0.3318 | **Resolved**: two runs |
| D5 | `research/evaluation_results_report.md` B3 column = B4; anchor outcomes "2 shared"; totals 9 shared / 14 neither | **Reporting error** (CSV: anchors 2 neither; totals 7 / 16; B3 values differ) |
| D6 | `research/per_case_empirical_results.csv` empty `commit_distance` / `stage_a_reachability` / `contains_historical_identifier`; `category_breakdown.csv` "No Distance" ×45 and "Behavioral-Only" ×45 | **Generator bug** (`generate_research_deliverables.js` expects `commit_distance` and `stage_a_reachability`; the source has `commit_distance_k` and `stage_a_status_reconciled`). Failure modes are therefore mislabelled. |
| D7 | "Category D quarantined negatives = unanswerable, 0% FP" | **Invalid**: rejected ground-truth cases with real targets (Section 8) |
| D8 | Cross-language "Verified ancestry" and "shallow clones" | **False**: 8 origins absent; clones are full |
| D9 | `research/reproducibility_record.md` pins | **Wrong**: 9/11 SHAs absent from clones; per-repo case counts wrong (checkstyle 15 vs 9; vue repo id) |
| D10 | Horizon decay 60/30/0 (Antigravity) vs 60/33.3/0 (research report) | **Not reproducible** (Section 15.4) |
| D11 | Two primary-ΔMRR CIs | Different methods; prefer the audit's |
| D12 | "0 verified" (bounded consistency audit) vs "5 verified" (Category B audit) | Both true at different levels: automated semantic check vs human adjudication. Human adjudication is still 0. |
| D13 | `RRFv2.js` JSDoc 0.60/0.40 vs code 0.50/0.50 | Doc bug |
| D14 | Engineering diagnostic narrative ranks vs its CSV (DIAG-01/02) | **Unresolved** |
| D15 | Test count 156 (research docs) vs 157 (now) | Benign: one test added afterwards |
| D16 | README Phase B "0% FP" and "RRF superior" | Stale and invalid; README predates all Oct 19–20 findings |
| D17 | `quasar` clone identity | Mislabelled (Java puniverse/quasar, not the TS framework) |

## 19.3 Corrections to the previous Antigravity `Report_change.md`

1. "Set 2 MRR 0.4079 / 0.4285 [Verified Origin]": no artifact contains these numbers.
2. The horizon defect was attributed to "an early script". It is in `RetrospectEvaluator.js` and the worker.
3. "0.0% false-positive / safe abstention on Category D negatives": those are rejected cases with targets, not negatives.
4. "Cross-language deficit due to shallow clones, terse commits, dynamic typing": the actual causes are 8 non-existent origins and 3 origins outside the horizon.
5. "Decay 60 / 30 / 0": not reproducible.
6. "Zero dilution": accurate on 3 controls only. The census shows 9 harms against 3 rescues, including 1 harm in the primary cohort.
7. Uncertain-lineage discount is 0.65, not 0.50. `buildHistoricalProfiles` defaults to 100 commits, not 50.
8. Environment: OS, npm and git versions were wrong.
9. "45 reconciled, verified cases": provenance fails for 8. Ground truth is rejected for 4. Human adjudication is 0 for all.
10. The CodeTracker TSE 2024 attribution was wrong (Section 18).
11. Its Table 2 "Primary B3" values (0%/80%/80%/0.3213) are correct, but it did not note that B3 ≥ B4 on S@5.
12. It omitted the `npm test` side effect, the clone-mutating checkout in the worker, and the `quasar` mislabel.

---

# 20. How to Run the Existing Project

Command status is marked as follows:

- **[Run]**: I executed it in this session.
- **[From source]**: read from the code but not executed.
- **[Unverified]**: neither.

## 20.1 Setup

```bash
cd "/d/base papers considered/Retrospect"
```

```bash
npm install
```

`npm install` **[From source]** installs from `package.json`. It is not needed if `node_modules` exists, as it does now.

## 20.2 Tests

```bash
npm test
```

**[Run]**: 19 suites, 157 tests. **Side effect: rewrites timestamp fields in `data/phase_c/discovery/author_card_blind_key.json` and the 19 `exported_packs/phase_c_author_pack/cards/*.json` files** (via `tests/unit/author_pack_blinding.test.js`).

```bash
npx jest tests/unit/rrf_v2.test.js tests/evaluation/new_evaluator.test.js
```

**[From source]**: targeted suites that should not touch Phase C files.

## 20.3 Restoring the Phase C files after tests

These files differ from HEAD only in timestamps. If a clean tree is wanted, `git checkout -- exported_packs data/phase_c/discovery/author_card_blind_key.json` restores the committed (Oct 14) timestamps. **Ask the owner first**: the previous working-tree timestamps cannot be recovered.

## 20.4 Retrieval and evaluation

```bash
node scripts/structural_cli.js search "D:/clones/zod" "parse input against schema" --limit 10
```

**[From source]** read-only structural search. Note that it searches the clone's *current* checkout, not a pin.

```bash
node scripts/run_benchmark_evaluator.js --help
```

**[Reported as run by the earlier harness validation]**. With `--dataset <json>` it writes results files. Pass a fresh output location and never overwrite the `Test creation\experiments\*` folders.

```bash
node scratch/generate_research_deliverables.js
```

**[From source]**: **overwrites** `research/per_case_empirical_results.csv`, `aggregate_empirical_metrics.*` and `category_breakdown.csv`, and still has the column bug. Do not run it until it is fixed.

- **`scratch/run_full_multirepo_evaluation.js` [From source]:** the census runner. It **checks out pins inside `D:\clones`** (detached HEAD, then restores the branch, falling back to `master`) and writes to an experiment output directory. Running it modifies clone state and can overwrite results. Use a copy of the clones or `git worktree` if it must be rerun.
- **`scripts/evaluate_phase_b_fusion.js` [From source]:** reproduces Phase B but contains the invalid FP threshold.

## 20.5 Where outputs live

| Output | Location |
|---|---|
| Census raw run | `Test creation\experiments\final_multirepo_evaluation_merge_aware_2026-10-20\` (`results.json`, `per_case_results.csv`, `source_state.txt`) |
| Corrected labels and statistics | `…\final_multirepo_evaluation_audit_2026-10-20\` |
| Paper-facing derived tables | `Retrospect\research\` (see D5, D6, D9) |
| Oct 19 run | `Test creation\results\current_version_diagnostic_2026-10-19\` |
| Phase B | `Retrospect\data\phase_b_*` |

---

# 21. Current Research Status and Defensible Claims

| Claim | Status |
|---|---|
| Historical retrieval can recover the current successor of a renamed Java method that current-code retrieval misses, when the rename commit is within the traversal window | **Supported as existence evidence**: 2 primary cases (0013, 0049) plus 1 supporting (0019); 2 independent origin commits among the primary rescues |
| Fusion (RRF-v2) improves primary-cohort ranking over structural search | **Directional, not significant** (M=5, p=0.58). Linear fusion performs equally on S@10. |
| Fusion is safe on current-code queries | **Weak**: 3 controls, ΔMRR −0.0013. Contradicted in general by 9 harms in the census. |
| Historical channel abstains on negatives | **Not tested**: no valid negative set exists |
| Historical retrieval is bounded by reachability within H | **Supported** (9/15 vs 0/19) |
| Ambiguity guards suppress true lineage in overload-dense classes | **Supported anecdotally** (0005, 0047) |
| Works across Python, JavaScript and TypeScript | **Not supported**: no provenance-valid, reachable case |
| Retrospect outperforms structural retrieval in general | **Refuted** on available data |
| Extraction, move, split/merge and rewrite recovery | **Untested** |

**Defensible paper framing [Inferred].** An exploratory study and failure analysis titled along the lines of "When does Git history help retrieve refactored code?":

- Three documented rescues (with ranks and mechanism traces).
- A reachability analysis.
- An ambiguity analysis.
- The fusion-harm finding.
- Candid threats: templated queries containing class names, 0 human adjudication, M=5, Java-only rename evidence, and one researcher.

---

# 22. Decisions Log

| Decision | Status | Source |
|---|---|---|
| DEC-01 Tree-sitter multi-language parsing; DEC-02 tiered matcher; DEC-05 RRF k=60; DEC-08 positive-score gating; DEC-09 source discovery; DEC-10 contamination layers; DEC-12 Express blacklist; DEC-14 abstention scope; DEC-15 bootstrap language; DEC-16 governance | APPROVED **[Reported]** | progress report §9.2 |
| DEC-03 commit S1 (RRF-v2); DEC-04 build `HistoricalBM25Retriever`; DEC-06, 07, 11, 13; DEC-17 evolution-focused primary estimand; DEC-18–22 | **PENDING** human sign-off as of Oct 15. No later record of approval found **[Unresolved]**. | progress report §9.3 |
| Legacy results declared non-evidence | Oct 19 | `reports/LEGACY_RESULTS_NOTICE.md` |
| 4 rejected Category B cases to be excluded from all runs | Oct 19. **Violated** by the Oct 20 census. | Category B audit §3.2 |
| Cohort stratification instead of pooling | Oct 20 | audit findings |
| Freeze the dataset; no automated expansion | Oct 20; endorsed by the owner's brief | `research/expansion_decision.md` |
| Active-channel normalisation off by default; prefilter and module multipliers rejected | Oct 20 | engineering diagnostic |
| Balanced RRF weights 0.50/0.50 | Oct 20 (no census ablation) | code |
| Phase D (Fastify/Flask) | Blocked at Gate 4; superseded in practice by the Oct 20 study. Never formally closed. **[Inferred]** | progress report §8 |

---

# 23. Remaining Work and Prioritized Plan

Each item fixes a demonstrated problem. None adds new data collection.

1. **Preserve state.** Commit the current working tree on `eval-reframing-empirical-study`, with the owner's approval. Optionally exclude the timestamp-only Phase C changes. This gives the census a real source revision.
2. **Repair the reporting layer (no algorithm change).**
   - Fix the column names in `scratch/generate_research_deliverables.js`.
   - Regenerate `research/*` into a **new** dated folder.
   - Fix the B3 column and anchor counts in the results report.
   - Replace the pin table in `reproducibility_record.md` with the verified pins (Section 7).
3. **Fix the cohort definitions.**
   - Remove 0031, 0034, 0048 and 0050 from all tables (or report them only as "rejected ground truth").
   - Stop calling them negatives.
   - Rename "distance_stratified_diagnostic" to what it is: "audit needs_review", split into reachable and unreachable.
4. **Resolve the cross-language provenance.**
   - For the 8 missing origins, try to find the true commits; the events JSON may record full SHAs or tags.
   - If they cannot be found, mark those cases provenance-invalid and drop them from historical claims.
   - Do this before writing any cross-language sentence.
5. **Fix Stage A** in `RetrospectEvaluator.js` and the worker to use the topological position from the same `git log` call that retrieval uses. Add a regression test using the 0101 and 0044 facts. This is a measurement fix, not a ranking change.
6. **Human adjudication of the 5 primary cases plus 0019 and 0020.** Record a short adjudication note per case. This is the single biggest credibility gain for the least effort.
7. **Optional, narrowly scoped experiment** (only if the paper needs it). Question: does reachability, not algorithm quality, bound rescue?
   - Rerun B2 only, with H=100 and H=700, on the 7 audit-flagged clean renames beyond 50 commits (0096, 0097, 0099, 0055, 0058, 0078, 0039).
   - Pin the source, write to a new folder, and use worktrees rather than checking out the clones.
   - This decides whether the paper may say "deeper traversal recovers them".
8. **Write the paper** around Section 21. Update the README's Phase B claims or mark them as superseded.

Explicitly **not** recommended now: algorithm tuning, new fusion schemes, a semcode migration, new dataset collection, or a Phase D restart.

---

# 24. Proposed Future Architecture (not implemented)

**[Proposed]** A dependent pipeline:

1. Structural retrieval finds current entry-point symbols.
2. Select which of them warrant history.
3. Trace their lineage backwards with path-following history (`git log --follow -L`, or a CodeTracker-like tracker).
4. Return current symbols with predecessor implementations attached as LLM context.

- **Why it might help:**
  - It replaces the repository-wide 50-commit window (the dominant failure, Section 15.4) with per-symbol depth.
  - It would also produce actual historical implementations, matching the owner's "predecessor recovery" wording.
- **New failure mode:**
  - If structural retrieval misses the entry point, history is never consulted. That is exactly the rescue situation (0013 had B1 unranked).
  - So the design cannot replace the current query-side historical channel. At most it complements it.
- **Evidence needed first:** on the existing primary and needs_review cases, is the target within the structural top-N (e.g. N=50)? From the census, B1 ranks are ≤ 57 for most Java cases but unranked for 0013. Answer this from the existing per-case data before building anything.
- **semcode:** an MCP server found under that name ([mcpservers.org listing](https://mcpservers.org/servers/goodbyeplanet/semcode)) does hybrid dense+BM25 symbol search with RRF, uses Tree-sitter, and can optionally index commit history. Its language coverage and any function-lineage mapping are **not documented** in the sources I found, and other projects use the same name. **[Unresolved]** It offers no demonstrated lineage recovery and should not replace the pipeline.

---

# 25. Instructions and Warnings for Future Claude Code Sessions

1. Treat `Test creation\experiments\final_multirepo_evaluation_audit_2026-10-20\corrected_per_case_results.csv` as the **authoritative per-case source** for the census. Treat `research/*` as derived and partly defective until it is regenerated.
2. Never quote pooled-census numbers as the result. Never call cases 0031, 0034, 0048 and 0050 "negatives". Never cite the 8 provenance-invalid pilot cases as evidence about history.
3. Do not quote MRR 0.4079 or 0.4285, the 30% or 33.3% decay figures, "0% false positives", or "zero dilution" without the qualifications in this report.
4. `npm test` rewrites 20 tracked files (timestamps). Prefer targeted Jest runs and check `git status` afterwards.
5. The census runner and worker run `git checkout` inside `D:\clones`. Never run them against the shared clones without the owner's approval. Prefer worktrees.
6. Do not run `scratch/generate_research_deliverables.js` or any runner that writes into existing result folders. Write to new dated folders.
7. Do not modify datasets, ground truth, cohort sets or clones as part of analysis. Record discrepancies instead.
8. Labels B1–B4 changed meaning across phases (Section 14). Always cite the experiment folder with any number.
9. Paths contain spaces. Quote them. In Git Bash use `/d/base papers considered/...`.
10. The owner prefers to **finish with the existing data**. Every new experiment needs a stated question, a pinned source revision, a new output folder, and a decision it informs.

---

# 26. Glossary

| Term | Meaning |
|---|---|
| B1 / B2 / B3 / B4 | (Oct 20) structural / historical / linear 0.6–0.4 / RRF-v2 0.5–0.5 (Section 14 for older meanings) |
| H, horizon | Number of commits returned by `git log --topo-order -n H <pin>` (50 in the census) |
| k (commit distance) | `git rev-list --count origin..pin`. **Not** the same as topological position. |
| Pin | Commit at which the current code is indexed and from which history is read |
| Origin commit | Commit where the refactoring (rename) happened; the cluster unit |
| Rescue (outcome A) | B2 ≤ 10 and B1 > 10 |
| Fusion harm | B1 ≤ 10 and B4 > 10 |
| Zero-signal gating | RRF channel contributes only if that channel's score > 0 |
| Transitive stitching | Chaining A→B→C renames so the current symbol inherits all predecessor vocabulary |
| Category A/B/C/D | Changed across documents. In the census: A/B = refactoring queries, C = current-code controls, D = "quarantined" (actually rejected ground truth). |
| Needs_review / verified / rejected | Status from the Oct 19 independent Category B audit (automated, not human) |
| M | Number of independent clusters (origin commits) |

---

# 27. Appendix: Artifact Paths, Evidence Sources, and Unresolved Questions

## 27.1 Key evidence files

- `D:\base papers considered\Test creation\experiments\final_multirepo_evaluation_merge_aware_2026-10-20\` (raw census)
- `D:\base papers considered\Test creation\experiments\final_multirepo_evaluation_audit_2026-10-20\` (`corrected_per_case_results.csv`, `case_reconciliation.csv` [46 rows incl. excluded JS-004], `audit_findings.md`, `corrected_statistical_analysis.csv`, `reproducibility_manifest.txt`)
- `D:\base papers considered\Test creation\audits\category_b_java_audit_2026-10-19\report.md` (5/20/4)
- `D:\base papers considered\Test creation\datasets\exploratory_java_v1_reconciled\quarantine_manifest.json` (rejection reasons)
- `D:\base papers considered\Test creation\results\category_b_benchmark_repair_2026-10-19\category_b_repaired.json`
- `D:\base papers considered\Test creation\datasets\historical_pilot_v1_2026-10-20\reports\lineage_verification.md` (contains false ancestry claims)
- `D:\base papers considered\Test creation\results\current_version_diagnostic_2026-10-19\` (Oct 19 run)
- `Retrospect\reports\LEGACY_RESULTS_NOTICE.md`, `RETROSPECT_EXPERIMENTAL_RESULTS.md`, `bounded_consistency_audit_2026-10-19\`, `evaluator_preparation_2026-10-19\engineering_diagnostic_final_report.md`
- `Retrospect\research\*` (derived; see D5, D6, D9)
- `Retrospect\docs\RETROSPECT_PROJECT_PROGRESS_REPORT.md`, `docs\phase_d\phase_d_v3_5_exploratory_protocol.md`
- `Retrospect\data\phase_b_evaluation_results*.json`
- `Retrospect\scratch\run_full_multirepo_evaluation.js` (cohort sets, lines 239–255), `scratch\evaluate_snapshot_worker.js`, `scratch\generate_research_deliverables.js`

## 27.2 My verification scripts (outside the project; read-only)

- `C:\Users\ASUS\AppData\Local\Temp\claude\D--base-papers-considered-Retrospect\eca0045e-3041-4f81-a97f-b9d9576ebd5c\scratchpad\recompute.py`: recomputes all cohort metrics and outcomes from a per-case CSV.
- `C:\Users\ASUS\AppData\Local\Temp\claude\D--base-papers-considered-Retrospect\eca0045e-3041-4f81-a97f-b9d9576ebd5c\scratchpad\pins.py`: checks pin and origin existence, ancestry, rev-list distance and topo-50 position against `D:\clones`.

## 27.3 Inspection limits

- I read, sampled or computed over every directory named above. I did **not** open every file in `Test creation` (for example, all 61 scripts, every `reports/draft` file, and the RefactoringMiner raw JSON contents beyond structure).
- I listed but did not read the Antigravity brain directory reports.
- The dataset and clone inventories are complete at the directory level. Per-file semantic review is limited to the files cited.

## 27.4 Open questions

1. What are the true origin commits for PY-003, PY-004, JS-001, JS-002 and TS-001–TS-004? Do they exist at all?
2. Which code change between Oct 19 and Oct 20 turned 0049 from abstention into a rank-4 hit?
3. Were any of DEC-03, 04, 06, 07, 11, 13 or 17–22 ever approved by the supervisor?
4. Where do the reported median latencies come from?
5. Why do the engineering diagnostic narrative and its CSV disagree for DIAG-01 and DIAG-02?
6. Which paper does the owner consider "the base paper"?
7. Are the fastapi, jest, koa and typeorm pilot cases (authored per the inventory) still pending or rejected?
8. What is B2's top-1 candidate on failures? Needed to measure "incorrect historical candidate". It requires rerunning B2 with top-k logging, read-only on worktrees.
