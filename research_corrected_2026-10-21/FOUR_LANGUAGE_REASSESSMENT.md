# Retrospect — Four-Language Reassessment and Evaluation Plan (2026-10-21)

**Labels used:** **[V]** verified in this session (file, code or read-only git) · **[R]** stated by an existing report, not re-checked · **[I]** my inference · **[U]** unknown · **[P]** proposal.

**Evidence classes used:** IMPLEMENTED AND TESTED · IMPLEMENTED BUT INSUFFICIENTLY TESTED · PARTIALLY IMPLEMENTED · PLANNED ONLY · UNKNOWN.

All checks were read-only. No code, tests, datasets or reports were changed, and no tests or experiments were run.

---

## 1. Executive Summary

**Contribution A, multilingual retrieval.**
- **Structural retrieval** parses all four languages. **Historical retrieval** runs on Java, Python, JavaScript and TypeScript files, but only those with `.java/.py/.js/.ts` extensions **[V]**.
- **Effectiveness** has been measured on real repositories:
  - **Java:** 29 cases (2026-10-20 census), plus 10 cases in the Phase B dev set.
  - **Python, JavaScript, TypeScript:** only the Phase B development set (10 cases each, from shallow clones) and the cross-language pilot. **8 of the pilot's 11 cases cite commits that do not exist in the clones [V].**
- **Rename rescue** is supported only for Java. No Python, JavaScript or TypeScript case is a rename whose commit lies inside the 50-commit window **[V]**.

**Contribution B, LLM-assisted explanations: PLANNED ONLY [V].**
- No code anywhere in `src/` or `scripts/` calls an LLM, builds a prompt or generates an answer. The only "LLM" mention is a token-estimate comment at `src/structural/context/ContextBuilder.js:12`.
- The only CLI is `scripts/structural_cli.js`, which does structural indexing and search only.

**Architecture.** Structural and historical retrieval run **independently** over all current symbols and are then fused (linear or RRF). History is **not** narrowed by structural results. Every result is a **current symbol**: predecessor names, commit messages and diffs are attached as evidence, but predecessor implementations are never returned **[V]**.

**Biggest blocker to defensible four-language results.** There are no provenance-valid, adjudicated, in-window *evolution* cases for Python, JavaScript or TypeScript outside the Phase B **development** set, and that set contains no in-window renames.

**Next action:** fill in `ground_truth_adjudication.csv` (it is still blank **[V]**) and commit the working tree. Both are needed before any final run.

---

## 2. Original Research Objectives (as given by the owner)

| Objective | Scope note |
|---|---|
| **A.** Structural + historical retrieval for Java, Python, JavaScript, TypeScript, as the core improvement over CodeTracker (which is Java-only) | Lineage must stay *within* a language; tracking functionality across languages is out of scope. Repositories may contain several languages. |
| **B.** A CLI that answers natural-language questions in six steps: query → structural retrieval → select symbols → their history → LLM → grounded English answer with code and history | Must be evaluated for retrieval correctness, lineage reliability, explanation accuracy, evidence support and invented claims |
| **Intended two-stage design:** history investigated for symbols chosen by structural retrieval | Section 8 compares this with what is implemented |

---

## 3. Current Implementation Status

| Component | Files | Status |
|---|---|---|
| Tree-sitter parsing (WASM) | `src/parser/TreeSitterManager.js`; `node_modules/tree-sitter-wasms/out/` (java, python, javascript, typescript and tsx grammars present) | IMPLEMENTED AND TESTED **[V]** |
| Language adapters | `src/languages/{Java,Python,JavaScript,TypeScript}Adapter.js` | IMPLEMENTED AND TESTED (unit level) **[V]** |
| Structural index and retrieval (B1) | `src/structural/index/StructuralIndex.js`, `src/structural/retrieval/StructuralRetriever.js` | IMPLEMENTED AND TESTED; measured on real repos (Section 9) |
| Git history window | `src/git/GitHistoryReader.js`, `src/git/historyWindow.js` (merge-aware `--topo-order -n 50`) | IMPLEMENTED AND TESTED (`tests/unit/git_history_reader.test.js`, `tests/unit/history_window.test.js`) **[V]** |
| Function matching / lineage | `src/matcher/FunctionMatcher.js` (tiers 1 and 2, ambiguity guard) | IMPLEMENTED BUT INSUFFICIENTLY TESTED: unit tests on synthetic snippets only; no per-language accuracy on real commits **[V]** |
| Historical profiles + B2 ranking | `src/retrieval/HistoricalRetrievalAdapter.js` | IMPLEMENTED AND TESTED (unit/integration); measured on real repos |
| Fusion: B3 linear 0.6/0.4; B4 RRF-v2 k = 60, 0.5/0.5 | `HistoricalRetrievalAdapter.fuseScores`, `src/retrieval/RRFv2.js` | IMPLEMENTED AND TESTED |
| Unified search API | `src/retrieval/UnifiedSearch.js` | IMPLEMENTED; independent channels, then fusion **[V]** |
| Context packaging | `src/structural/context/ContextBuilder.js` | IMPLEMENTED for **structural** symbols only; no historical evidence in the context **[V]** |
| CLI | `scripts/structural_cli.js` (`index`, `search`, `evaluate`) | Structural only. A history-aware or natural-language-answer CLI is PLANNED ONLY **[V]** |
| LLM integration / answer generation | none | **PLANNED ONLY [V]** |
| Evaluation harness | `scratch/evaluate_snapshot_worker.js` (produced the measurements); `scratch/run_java_case_study.js` (new driver); `src/evaluation/RetrospectEvaluator.js` (separate harness, not used for the measurements) | IMPLEMENTED; the driver is tested on a toy repo; **E1 not yet run [V]** |

**Git state [V]:**
- HEAD is still `17ea399`; the planned G2 commit has **not** been made.
- `git status` shows 52 entries (modified and untracked), all preserved.
- `research_final_2026-10-22/` contains only `compare_with_reference.py` and a plan-only dry run.

---

## 4. Java Assessment

| | Finding | Class |
|---|---|---|
| **Implementation** | `JavaAdapter.js`: classes, interfaces, enums, records, constructors, methods, annotations, parameters, method invocations. History diffs `.java` files. | IMPLEMENTED AND TESTED **[V]** |
| **Limitations** | Overloads and siblings trigger the ambiguity guard (0005, 0047 **[V]**). Multi-module duplicates hurt B1 (guava **[R]**). | — |
| **Tests** | `tests/unit/adapters.test.js` (Java cases), `tests/integration/history_tracking.test.js` (Java fixtures), `tests/unit/history_window.test.js` | Unit/integration only |
| **Real-repo measurements** | 2026-10-20 census: 29 Category B cases, 4 repos (checkstyle, graphhopper, undertow, java-driver), pins and origins all present **[V]**. Not reproduced: E1 pending **[V]**. Phase B: gson, 10 cases (dev set). | IMPLEMENTED BUT INSUFFICIENTLY TESTED (not reproduced, not adjudicated) |
| **Dataset** | `Test creation\results\category_b_benchmark_repair_2026-10-19\category_b_repaired.json`: 29 RefactoringMiner **rename** events, templated queries. Automated audit: 5 verified / 20 needs_review / 4 rejected **[R]**. | — |
| **Usable cases [V]** | **25** non-rejected. **11** with the origin inside the 50-commit window, from 7 commit-level clusters, awaiting adjudication. 14 outside the window. Phase B gson: 7 with the evidence commit inside the window (4 `new_symbol`, 3 `rewrite`; no rename). | — |
| **Known issues** | 0019 and 0020: anachronistic class name and target-stem leak. 0005: split into two methods. 0046: two candidate successors (`research_corrected_2026-10-21/ground_truth_adjudication_evidence.md`). 0035/0036/0038 are Netty framework migrations. | — |

## 5. Python Assessment

| | Finding | Class |
|---|---|---|
| **Implementation** | `PythonAdapter.js`: classes, functions, methods, decorated definitions, typed and default parameters, docstrings, calls. History diffs `.py`. Lambdas are not extracted. | IMPLEMENTED AND TESTED (unit) **[V]** |
| **Tests** | `adapters.test.js`; `history_tracking.test.js` (Python-heavy fixtures); `matcher.test.js` | Unit/integration |
| **Real-repo measurements** | Phase B bottle, 10 cases (dev set; shallow clone `data/external_repos/bottle`, 162 commits). Pilot PY-001..004: B2 never in top-10; PY-003 and PY-004 origins missing **[V]**. | IMPLEMENTED BUT INSUFFICIENTLY TESTED |
| **Usable cases [V]** | **Historical rename rescue: 0.** Pilot: 2 cases with valid provenance (httpx, one shared commit, outside the window). Phase B bottle: 7 positive cases with the commit inside the window (3 rewrite, 3 routine modification, 1 signature change), 1 outside, 2 negatives. | — |
| **Issues** | The Phase B set was used to tune fusion, so it is development data, not held-out. Its natural-language ("sanitized") queries test history *vocabulary*, not renames. | — |

## 6. JavaScript Assessment

| | Finding | Class |
|---|---|---|
| **Implementation** | `JavaScriptAdapter.js`: classes, methods, function declarations and expressions, arrow functions in variables and assignments, `defineProperty` getters, imports/requires, calls. **History diffs only `.js`; `.jsx/.mjs/.cjs` are skipped** (`HistoricalRetrievalAdapter.js:516`) **[V]**. Class-field arrow functions are not extracted **[I]** (no `field_definition` handling). | PARTIALLY IMPLEMENTED for history (extension gap) |
| **Tests** | `adapters.test.js`, `historical_retrieval_adapter.test.js` (mostly JS fixtures), `unified_search.test.js` | Unit/integration |
| **Real-repo measurements** | Phase B express, 10 cases (dev set; shallow clone, 1675 commits; Express is blacklisted for *future* benchmarks under DEC-12 **[R]**). Pilot JS-001/002 origins missing; JS-003 (mocha) valid but outside the window **[V]**. | IMPLEMENTED BUT INSUFFICIENTLY TESTED |
| **Usable cases [V]** | **Rename rescue: 0.** Phase B express: 4 cases inside the window (1 rewrite, 2 routine modification, 1 labelled hard_negative with an answer) and 6 outside. Pilot: 1 valid (outside the window). | — |

## 7. TypeScript Assessment

| | Finding | Class |
|---|---|---|
| **Implementation** | `TypeScriptAdapter.js`: classes, interfaces, enums, methods and method signatures, functions and overloads, arrow functions in variables. **`.tsx` files are parsed with the `typescript` grammar, not `tsx`** (`super('typescript')` with extensions including `.tsx`; the `tree-sitter-tsx.wasm` grammar exists but is unused) **[V]**. JSX inside `.tsx` will therefore likely mis-parse **[I]**. **History skips `.tsx/.mts/.cts` [V].** | PARTIALLY IMPLEMENTED |
| **Tests** | `adapters.test.js` (TS cases), `retriever.test.js` | Thin; little TS history testing **[V]** |
| **Real-repo measurements** | Phase B zod, 10 cases (dev set; shallow clone, 150 commits). Pilot TS-001..004: all four origins missing **[V]**. The census's 1 zod case is a current-code control. | IMPLEMENTED BUT INSUFFICIENTLY TESTED |
| **Usable cases [V]** | **Rename rescue: 0.** Phase B zod: 3 positive cases inside the window (new_symbol, signature change, rewrite); its 2 renames are **outside** the window. Pilot: 0 with valid provenance. | — |

---

## 8. Structural and Historical Retrieval Architecture

| Question | Answer |
|---|---|
| Does history use structural results to narrow its search? | **No [V].** `indexRepositoryHistory` builds profiles for **all** current symbols from the 50-commit window (`UnifiedSearch.js` lines ~45–78; worker lines ~70–76). B2 ranks all candidates independently. |
| Relationship between the outputs | B1 and B2 each rank every current symbol. B3 adds the scores (0.6 S + 0.4 H); B4 is RRF over the two rank lists, with zero-signal gating. |
| Configurations | B1 structural only; B2 historical only; B3 linear; B4 RRF-v2 (worker: `scratch/evaluate_snapshot_worker.js`) **[V]** |
| Predecessor or successor? | It ranks the **current successor**. Profiles carry `historicalNames`, commit messages and diff text (`HistoricalRetrievalAdapter.js` ~57–90), but no predecessor implementation is returned or put into the context **[V]**. |
| Refactorings handled | Per `FunctionMatcher`: unchanged, modified, moved, renamed, renamed+moved, chained (A→B→C) across the window. Splits and merges (1→N) end up ambiguous or unmatched (0005, 0046) **[V/I]**. |
| Unsupported or unreliable | Events outside the window; the last commit in the window, merge commits and root commits are never diffed **[V]**; overload and sibling ambiguity; behavioural queries with no shared vocabulary; framework migrations; `.tsx/.jsx/.mjs/.cjs` history; cross-language moves (out of scope). |
| Gap from the intended design | The intended design is structural → selected symbols → their history → LLM. Implemented: two independent channels → fusion → ranked current symbols. The "select symbols, then fetch their history" step and the LLM step do not exist. |
| Could this invalidate the evaluation? | Not for retrieval experiments, as long as they are described as measuring *current-successor ranking*. It does invalidate any claim about **explanations** until Contribution B exists. |

---

## 9. Audit of Existing Experimental Evidence

| Finding | Status now |
|---|---|
| 45-case census (2026-10-20) not reproduced | **Still valid [V].** E1 has not run; HEAD has no commit for the evaluated code. |
| Pooled 45-case metrics (B1 57.8% vs B4 44.4% top-10) | **Superseded** by per-role tables in `research_corrected_2026-10-21/`. Do not use as headline numbers. |
| 3 historical rescues (0013, 0049, 0019), all Java | **Valid as measured [V].** 2 distinct commits. 0019's query is likely unacceptable (anachronism plus leak). All pending adjudication. |
| "Category D negatives / 0% false positives" | **Invalid [V]:** rejected ground truth |
| Cross-language pilot provenance | **Still invalid [V]:** 8 of 11 origins missing |
| Horizon labels used `rev-list` | **Fixed in code [V]** (`historyWindow.js`, 14 tests). Stored 2026-10-20 outputs still carry old labels; corrected labels are in `per_case_results_corrected.csv`. |
| Primary group of 5: B4 vs B1 | Directional only (ΔMRR +0.176, p = 0.56) **[V]** |
| Phase B (40 queries, 4 languages) | Ranks exist in `data/phase_b_evaluation_results_stitched.json` under **old** configurations (RRF-v1 and others). Development set; shallow clones; "0% false positive" figure invalid (0.20 threshold artefact) **[R]**. |
| `laya testing` "Retrospect_Deterministic_Pipeline" (168 predictions, 4 languages, 165/168 correct) | **Not evidence for this codebase [V].** It is a separate Python reimplementation (`laya testing\src\models\retrospect_pipeline.py`); its `data/benchmark.json` is not on disk; its candidate pools are tiny (4 + NEW). |
| `retrospect_historical_rescue_v1` (14 cases) | Relabelled census cases; never evaluated **[V]** |
| Adjudication | **Not started [V]:** all 11 rows of `ground_truth_adjudication.csv` are blank |

---

## 10. Dataset and Ground-Truth Suitability

| Dataset | Lang | Repos | Cases | Clusters | Ground truth | Tests renames? | Use | Leakage risk |
|---|---|---|---:|---:|---|---|---|---|
| Category B (`category_b_repaired.json`) | Java | checkstyle, graphhopper, undertow, java-driver (full clones) | 29 (4 rejected) | 18 distinct origin commits **[V]** | RefactoringMiner + automated audit; **human adjudication pending** | Yes | **Held-out final study** (E1) | Templated queries name the old method and the class |
| Phase B (`data/benchmark_lineage_audited_v3.json` + `data/evaluation_lineage_queries_v4.json`) | Py/JS/TS/Java | bottle, express, zod, gson (shallow clones in `data/external_repos/`) | 10 per language (34 with answers, 6 without) | Distinct evidence commits: bottle 10, express 10, zod 8, gson 9 **[V]** | "manually_verified" / "verified_with_corrections" **[R]** | Mostly modifications and rewrites; 2 renames (zod) + 1 move (gson) | **Development / validation only:** fusion was chosen on it **[R]** | Express under DEC-12; sanitized queries |
| Cross-language pilot (`Test creation\datasets\historical_pilot_v1_2026-10-20`) | Py/JS/TS | httpx, pytest, marshmallow, moment, mocha, vue, rxjs | 11 | — | Machine-assisted; **8 origins missing** | Yes, claimed | Only 3 valid cases (all outside the window); not usable for history claims | Natural-language queries |
| Structural benchmark (`data/structural_eval_benchmark.json`) | Py 7, Java 6, JS 5, TS 4 | small fixtures **[R]** | 22 | — | Internally authored | No (current code only) | Engineering check of B1 per language | Authored with known targets |
| Matcher benchmark (`src/evaluation/benchmarks/labeled_dataset.json`) | Py 4, JS 3, TS 3, Java 3 | synthetic | 13 | — | Synthetic | Matcher only | Unit-level sanity check | — |
| CodeTracker / RefDiff / PyRef oracles (described in `laya testing\inventory\DATASET_INVENTORY.md`) | 4 languages | external | — | — | External oracles | Lineage | **[U]:** raw files not on disk in `laya testing\data`; using them means re-acquiring data | — |

**The exact gap.**
- For Python, JavaScript and TypeScript there is **no held-out set of in-window, provenance-valid, adjudicated evolution cases**. The Phase B dev set has in-window modification and rewrite cases (7 / 4 / 3) but **zero in-window renames**.
- Full clones already exist in `D:\clones` for httpx, pytest, marshmallow, black, fastapi (Python); mocha, moment, axios, jest, koa, lodash (JavaScript); vue, rxjs, zod, typeorm, svelte (TypeScript) **[V]**.
- The smallest response, a decision for the owner, is to mine a small number of renames inside the window per language from those clones and **adjudicate them by hand**, rather than collect new repositories.

---

## 11. Proposed Experiments and Metrics

**Metric definitions** (one target per case; the rank is among all current symbols at the pin):
- **Success@k = Recall@k:** the fraction of cases whose target rank is ≤ k.
- **MRR:** mean of 1/rank, with unranked counted as 0.
- **Rescue rate:** cases with B2 ≤ 10 and B1 > 10, divided by eligible cases inside the window.
- **Fusion harm:** cases with B1 ≤ 10 and B4 > 10.
- **Lineage accuracy (per language):** for an evolution commit, the fraction of (old, new) pairs where `FunctionMatcher` links the predecessor to the successor with the correct type. "Ambiguous" counts separately.
- **Abstention** is not supported as a calibrated feature. Report only B2 null-rate, not "abstention accuracy".

**Answer metrics** (Experiment 4, once it exists). Claims are human-annotated:
- **Supported-claim rate:** claims backed by retrieved code or commits, divided by all claims.
- **Unsupported-claim rate:** 1 minus the supported-claim rate.
- **Factual correctness:** claims judged correct.
- **Evolution correctness:** whether the answer names the right historical change.
- **Traceability:** whether each claim cites a file or commit.

**Statistics.** Group by origin commit (cluster). Use exact sign-flip tests on cluster-mean differences only when there are 7 or more clusters (minimum p = 0.0156). Otherwise report descriptively. Use no bootstrap confidence intervals on fewer than 10 clusters.

| Experiment | Question | Data | Configs | Output |
|---|---|---|---|---|
| **E1: Java reproduction + rescue** | Do the 2026-10-20 ranks reproduce, and where does history rescue? | Category B, 29 cases; isolated clones | B1–B4, H = 50 | 116-rank comparison; tables for the 11 in-window and 14 outside-window cases; rescue list |
| **E-Lang: per-language pipeline correctness** | Does extraction plus history plus matching work on real commits in each language? | Phase B in-window evidence commits (Py 7, JS 4, TS 3, Java 7) | Lineage only, no ranking | Per-language lineage accuracy and ambiguity rate; parse error rate on the four snapshots |
| **E-Retr4: structural vs history-aware, four languages** | Does history help retrieval per language on evolved code? | Phase B, 40 cases, rerun with **current** B1–B4 (development data; label as such) | B1–B4, H = 50 | Per-language Success@k and MRR, harm/rescue counts. Clusters ≈ 8–10 per language, so descriptive only. |
| **E3: rescue validity** | Are rescues genuine? | E1 + E-Retr4 outcome-A cases | — | Each rescue tagged: valid / leak / bad ground truth / ambiguous / same cluster |
| **E4: end-to-end answers** | Can the CLI answer grounded questions? | **Cannot run:** no implementation **[V]** | — | Blocked |

---

## 12. Results-First Execution Roadmap

| Phase | Objective | Files | Action | Measurable output | Pass / stop | Code change? |
|---|---|---|---|---|---|---|
| **1. Blockers** | Make a final run defensible | `ground_truth_adjudication.csv`; git | Owner adjudicates the 11 cases plus the Netty decision; owner commits the working tree; owner approves `D:/clones_eval_2026-10-22` | A filled CSV; a commit SHA | Stop if not done | No |
| **2. Java E1** | Reproduce and measure | `scratch/run_java_case_study.js`, `scratch/evaluate_snapshot_worker.js`, `research_final_2026-10-22/compare_with_reference.py` | Isolated clones → driver (H = 50) → compare → final tables using the adjudication | `research_final_2026-10-22/E1_reproduction/`; 116/116 ranks match | **Any rank mismatch → stop and report** | No |
| **3a. Fix extension gaps** | Make TS/JS history cover the files the parsers accept | `HistoricalRetrievalAdapter.js:516` (history extension filter); `TypeScriptAdapter.js` (.tsx grammar) | Small correctness fix plus a test (a `.tsx` fixture). It is a defect *for the four-language claim*. **Run after E1** so E1 reproduces the old code. | Tests pass; E1 ranks unchanged for Java (`.java` unaffected) | Stop if any Java rank changes | **Yes (small)** |
| **3b. E-Lang + E-Retr4** | Validate Python, JavaScript and TypeScript on existing data | Phase B files and `data/external_repos/{bottle,express,zod,gson}` | Write a Phase B → worker input adapter (new script); run B1–B4 and lineage checks into a new folder. Do not touch `data/phase_b_*`. | Per-language tables, labelled **development set** | Stop if the parse error rate is above 5% for any language | New script only |
| **3c. Held-out non-Java renames (optional, owner decision)** | Close the rename gap | Existing clones in `D:\clones` | Owner-adjudicated in-window rename events per language (no new repos) | N cases per language | Only if the owner wants a cross-language rescue claim | No (data work) |
| **4. End-to-end** | Contribution B | `src/structural/context/ContextBuilder.js`, `src/retrieval/UnifiedSearch.js` | **Must be built:** (1) an evidence packager that includes historical profiles (predecessor names, commits, diffs); (2) an LLM call; (3) a CLI command; (4) an answer-evaluation protocol with human claim annotation | 20–30 questions with annotated answers | Stop if it is not implemented | **Yes (new feature)** |
| **5. Completion decision** | Owner decides | All outputs | Compare against Section 14/15 | — | — | — |

---

## 13. Remaining Decisions Required From the Owner

1. Adjudicate the 11 in-window Java cases, and classify 0035/0036/0038 (Netty).
2. Commit the working tree, so E1 has a source revision.
3. Approve creating `D:/clones_eval_2026-10-22`.
4. Accept the Phase B set as **development-only** evidence for Python, JavaScript and TypeScript, or commission phase 3c (held-out renames).
5. Approve the small extension and `.tsx` fix (3a) **after** E1.
6. Decide whether Contribution B is built and evaluated in this project, or reported as future work. It currently does not exist.

---

## 14. Claims Supported by Existing Evidence

- All four languages are parsed into callable symbols; structural retrieval runs on real repositories in each language **[V]**.
- In Java, historical retrieval ranked the current successor of a renamed method in the top-10 where structural retrieval did not (0013, 0049; 0019 pending query adjudication). The rename commit was inside the 50-commit window in each case **[V, single unreproduced run]**.
- Historical retrieval cannot help when the evolution commit is outside the window; observed 0 of 17 **[V]**.
- Fusion can push a correct structural hit out of the top-10 when history is absent (fusion harm, mostly outside the window) **[V]**.

## 15. Claims Not Yet Supported

- Any result marked reproduced: E1 has not run.
- Historical rescue in Python, JavaScript or TypeScript.
- History-aware retrieval improving results in general, or statistically significantly.
- Recovery of predecessor *implementations*: only current successors are ranked.
- The two-stage "structural → selected history" design: not implemented.
- Any LLM-generated explanation, its accuracy, or its freedom from invented claims: not implemented.
- Abstention or false-positive safety.
- Full JavaScript/TypeScript history coverage, given `.jsx/.mjs/.cjs/.tsx` and `.tsx` grammar.
