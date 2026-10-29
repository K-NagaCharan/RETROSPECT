# Retrospect: evolution-aware code retrieval

Retrospect is an evolution-aware code retrieval system for repository-level LLMs and developers. It finds **current** code even when you ask about it by a **former** name. To do that it combines two things:
- syntax-aware structural search over the current snapshot;
- lineage recovered from git history (renames, moves, signature changes).

It supports **Java, Python, JavaScript and TypeScript**. Parsing uses Tree-sitter WebAssembly grammars (`web-tree-sitter`, `tree-sitter-wasms`), so no native toolchain is needed. Retrospect is written in Node.js (18 or newer).

Retrospect ships as the `retrospect-cli` package. It has an `ask` command that sends retrieved code and history to an LLM. **Only retrieval has been evaluated; the quality of LLM answers has not.**

---

## 1. Install and CLI usage

`retrospect-cli` installs two commands, `rtro` and `retrospect` (an alias), both pointing to `bin/rtro.js`. It needs Node 18 or newer and git on the `PATH`.

### Install

```bash
npm install -g retrospect-cli
```

To install from a local checkout instead, run `npm pack` and then `npm install -g retrospect-cli-1.0.1.tgz`. To work on the source, run `npm install` in the repository.

### Index a repository: `rtro init`

Run inside any git working tree:

```bash
rtro init                 # default history window: the 400 most recent commits
rtro init --history 1000  # analyse a longer history
```

`init` builds the structural index and the history index and stores them in `<repo>/.retrospect/` along with `config.json`. It adds `.retrospect/` to `.git/info/exclude`; tracked files are never modified.

`rtro status` shows:
- whether the index is fresh (indexed HEAD = current HEAD) or stale;
- the history window and index sizes;
- the active provider and model.

### Search: `rtro search`

```bash
rtro search "where is filterObject now?"
rtro search computeCartTotal --k 5
rtro search "what happened to show_message?" --json   # machine-readable
```

Search uses Retrospect's lineage gate (G, §2).
- **Identifiers in the question** (`` `backticks` ``, camelCase, snake_case, dotted names, or a single bare token) are matched against former names recorded in git history. Matching symbols are listed first, each with a `formerly <oldName> (renamed in <sha>, <date>)` line.
- **Without a lineage match**, results come from structural search over the current code.

If HEAD has moved since the index was built, the index is rebuilt first.

### Ask: `rtro ask`

```bash
rtro ask "what happened to show_message?" --dry-run    # print the full prompt; no network call
rtro ask "what happened to show_message?" --model <model-name>
rtro ask "where is filterObject now?" --provider openai-compatible --model llama3
```

`ask` takes the top results (`--k`, default 5) and builds a context within the token budget (default 4000) using `ContextBuilder`. It sends a prompt with QUESTION, CURRENT CODE and HISTORICAL EVIDENCE sections. It prints the answer, then `Sources:` (file:line, plus the commit sha for historical evidence). The model is told to answer only from that context.

If retrieval finds no matching code, `ask` sends no request and prints a hint instead (since v1.0.1). Only functions, classes and methods are indexed, not README or package files, so broad questions about the project as a whole ("why is this written in JavaScript?") find nothing. Name a function, class or file in the question, or explore first with `rtro search`.

### Configure: `rtro config`

```bash
rtro config get k
rtro config set k 8                       # project keys: history, k, tokenBudget (.retrospect/config.json)
rtro config set provider anthropic --global
rtro config set model <model-name> --global
rtro config set baseUrl http://localhost:11434/v1 --global   # for openai-compatible servers
```

Global keys (`provider`, `model`, `baseUrl`) live in `~/.retrospect/config.json`. API keys are never stored in any file.

### Providers and environment variables

| Variable | Used for |
|---|---|
| `ANTHROPIC_API_KEY` | `--provider anthropic` (the default) |
| `OPENAI_API_KEY` | `--provider openai-compatible` (OpenAI and other remote servers). Not needed when the base URL's host is `localhost`, `127.0.0.1` or `::1` (Ollama, LM Studio); the Authorization header is then omitted. |
| `OPENAI_BASE_URL` | Base URL for `openai-compatible` when `baseUrl` is not configured, e.g. `https://api.openai.com/v1` |
| `RETROSPECT_MODEL` | Default model when neither `--model` nor the `model` config key is set |

If a required key, base URL or model is missing, `rtro ask` names the variable or setting to provide. `--dry-run` never needs a key. Example transcripts (init, status, search, `--json`, `ask --dry-run`) on two benchmark repositories are in [docs/demo/](docs/demo/).

---

## 2. How it works

Retrospect has three retrieval configurations that matter for the CLI and the evaluation.

| Configuration | What it does | Code |
|---|---|---|
| **B1: structural** | Ranks symbols in the current snapshot with a deterministic multi-signal scorer: exact name, identifier sub-token overlap, docstring, file path, signature, kind, and a call-graph term. The weights and the minimum-score threshold are defined in `StructuralRetriever.js`. | `src/structural/` |
| **B2: history / lineage** | Walks the most recent *H* commits (merge-aware `git log --topo-order`). It matches each changed function to its predecessor with `FunctionMatcher` and stitches lineage chains (A → B → C). Each current symbol gets a history profile (former names, commit messages, diff terms). B2 ranks symbols by that profile. | `src/retrieval/HistoricalRetrievalAdapter.js`, `src/matcher/`, `src/git/` |
| **G: lineage gate** | Extracts identifiers from the query (`ids(q)`). If any B2 candidate's inherited former names contain one of them (exact, case-sensitive), those candidates come first, in B2 order, followed by the B1 ranking. Otherwise G **is** the B1 ranking. G has no parameters. | `src/retrieval/LineageGate.js` |

**Why gating instead of fusion.** The evaluation also measured two fusion configurations:
- **B3:** linear, 0.6 structural / 0.4 historical;
- **B4:** reciprocal-rank fusion, k = 60.

Fusion helped when the rename was inside the history window. But it lost much of that gain, and it harmed queries for which history had no signal; see §4. G only changes the ranking when the query names a former identifier that history actually recorded. In every other case it returns the structural result unchanged.

### Lineage matching (FunctionMatcher)

Matching is deterministic and explainable, with no embeddings or vector databases.

- **Tier 1: strong identity signals.**
  - Exact source hash and same name (`tier1_exact_hash`) → `unchanged`.
  - Same qualified name, scope and normalized signature with a modified body (`tier1_exact_signature`) → `modified`.
  - Same qualified name and scope with body token overlap (`tier1_name_and_scope`) → `modified`.
- **Tier 2: similarity-based matching** (renames, moves, signature changes).
  - **Weighted signals:** token Jaccard 0.35, name similarity 0.25, signature 0.15, enclosing scope 0.15, parameters 0.10.
  - **Thresholds:** high confidence ≥ 0.70, moderate ≥ 0.50.
  - **Ambiguity:** when the top two candidates are within 0.08 of each other, the matcher reports `uncertain` rather than guessing.
- **Change vocabulary** (`src/model/HistoryGraph.js`): `unchanged`, `modified`, `renamed`, `moved`, `renamed_and_moved`, `new`, `deleted`, `uncertain`.

### Supported languages

| Language | File extensions | Extracted callables |
| :--- | :--- | :--- |
| **Python** | `.py` | Module-level functions, class methods, nested functions, decorated functions |
| **JavaScript** | `.js`, `.jsx`, `.mjs`, `.cjs` | Function declarations and expressions, arrow functions, class methods, factory-returned callables |
| **TypeScript** | `.ts`, `.tsx`, `.mts`, `.cts` | All JavaScript constructs, plus typed parameters, return types, access modifiers, overloads (signatures collapsed onto the implementation) |
| **Java** | `.java` | Class, interface and enum methods, constructors, overloads (distinguished by parameter types) |

More detail on the structural pipeline is in [STRUCTURAL_RETRIEVAL.md](STRUCTURAL_RETRIEVAL.md).

---

## 3. Architecture

Generated from the actual `src/` layout at `cli-v1.0.0`:

```
Retrospect
├── bin/
│   └── rtro.js                       # CLI entry point (rtro / retrospect)
├── src/
│   ├── index.js                      # Public API exports
│   ├── cli/                          # CLI: args, config, store (.retrospect/), search, prompt, index (commands)
│   ├── llm/
│   │   └── index.js                  # Providers: anthropic, openai-compatible (fetch only)
│   ├── git/
│   │   ├── GitHistoryReader.js       # Git commits, diffs, file contents
│   │   └── historyWindow.js          # History-window (reach) classification
│   ├── languages/                    # LanguageAdapter, LanguageAdapterRegistry, Java/JavaScript/Python/TypeScript adapters
│   ├── parser/
│   │   ├── TreeSitterManager.js      # WASM grammar loading; one cached parser per language
│   │   └── FunctionExtractor.js      # Symbol extraction (frees Tree-sitter trees after use)
│   ├── model/                        # SymbolRecord, HistoryGraph (change vocabulary)
│   ├── matcher/                      # FunctionMatcher (Tier 1/Tier 2), SimilarityUtils
│   ├── storage/                      # HistoryStore (JSONL), HistoryCache
│   ├── tracker/
│   │   └── HistoryTracker.js         # Commit traversal and predecessor chaining
│   ├── structural/
│   │   ├── index.js                  # indexRepository, searchCurrentCode, getSymbol, getRelatedSymbols
│   │   ├── discovery/RepoDiscoverer.js
│   │   ├── index/StructuralIndex.js  # Symbol registry, inverted index, call graph, save/load
│   │   ├── query/QueryProcessor.js
│   │   ├── retrieval/StructuralRetriever.js   # B1
│   │   └── context/ContextBuilder.js # Token-budgeted context blocks
│   ├── retrieval/
│   │   ├── HistoricalRetrievalAdapter.js      # B2 history profiles, B3 linear fusion
│   │   ├── RRFv2.js                  # B4 reciprocal-rank fusion
│   │   ├── LineageGate.js            # G and identifier extraction
│   │   ├── UnifiedSearch.js          # Programmatic fused search (search)
│   │   └── HistoricalRetriever.js    # Commit-level evidence API
│   └── evaluation/                   # RetrospectEvaluator, BenchmarkCaseLoader, ClusterBootstrap, SplitGuard,
│                                     # HistoryEvaluator, StructuralEvaluator, evaluationRunner
├── tests/                            # unit/, integration/, evaluation/, cli/, stress/, fixtures/ (jest)
├── scripts/                          # Benchmark, audit and export scripts (e.g. structural_cli.js)
└── docs/                             # Specs, demo transcripts, DOCS_INDEX.md
```

### Programmatic API

```javascript
const retrospect = require('retrospect-cli');   // or require('./src') from a checkout

// Structural (B1) search over the current snapshot
const r = await retrospect.searchCurrentCode('./my-repo', 'retry logic for failed network requests', { maxResults: 5 });
for (const b of r.results) console.log(b.name, `${b.filePath}:${b.range.startLine}`, b.score);

// Fused structural + history search (strategies: 'linear' (default), 'adaptive', 'rrf', 'residual')
const u = await retrospect.search('./my-repo', 'where is computeCartTotal now?', { strategy: 'rrf', limit: 5, maxCommits: 400 });
for (const h of u.results) console.log(h.rank, h.symbol.qualifiedName, h.symbol.filePath, h.lineageEvidence.historicalNames);
```

The lineage gate G is not one of `search`'s strategies. Use the CLI, or call `rankLineageGate` from `src/retrieval/LineageGate.js`.

---

## 4. Key results

All numbers are copied from the result files listed in [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md#where-results-live). Ground truth differs between the two benchmarks, as described with each.

### External confirmation (pre-registered, one confirmatory test)

**Case set:** 42 repositories, one rename event each: Java 12, Python 12, JavaScript 7, TypeScript 11. The events come from three sources:
- the RefactoringMiner oracle (Java);
- the PyRef oracle (Python);
- developer-attested renames, where the commit message names the old and new identifiers and Retrospect's extractor confirms the rename.

The owner reviewed the 29 developer-attested events and confirmed 26.

**Settings:** H = 400. The query is the old identifier (task B_id).

**Confirmatory test: B_id, G vs B1, pooled over repositories** (Monte Carlo sign-flip, 100,000 assignments, seed 20261023):

| Repos | MRR B1 | MRR G | R@1 B1 | R@1 G | R@10 B1 | R@10 G | Δ (G − B1) | 95% CI | p (two-sided) | Rescues / harms @10 | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 42 | 0.3628 | 0.7747 | 0.2619 | 0.7143 | 0.5238 | 0.8571 | 0.4119 | [0.279, 0.5489] | < 0.0001 (minimum attainable with 100,000 Monte Carlo assignments) | 14 / 0 | **SUPPORTED** |

**Harm check (task A, current-docstring queries, G vs B1):** 14 repositories, MRR B1 0.6512 vs G 0.6452, Δ −0.006, CI [−0.0179, 0.0], harms@10 = 0. Result: **PASS** (the rule is harms@10 = 0 and Δ ≥ −0.01).

**Sensitivity (owner-confirmed cases only):** S1 + S2 + the 26 owner-confirmed developer-attested events. Rejected: django/django, tj/commander.js, trpc/trpc.

| Repos | MRR B1 | MRR G | Δ | 95% CI | p | Rescues / harms @10 |
|---|---|---|---|---|---|---|
| 39 | 0.3856 | 0.7574 | 0.3718 | [0.2348, 0.5091] | < 0.0001 (minimum attainable with 100,000 Monte Carlo assignments) | 12 / 0 |

### Main four-language benchmark (v4, parser-fix re-measurement)

**Ground truth:** machine-verified evolution events.

**Machine-verified, not human-reviewed:** the 1,005-event owner review queue has not been done.

The figures below are held-out task B (old identifier), pooled, cluster-level.

| Stratum | Cases / clusters | MRR B1 | MRR B2 | MRR B3 | MRR B4 | B4 − B1 | B4 rescues / harms @10 |
|---|---|---|---|---|---|---|---|
| In window, H = 400 | 14 / 12 | 0.4069 | 0.6496 | 0.528 | 0.491 | +0.0914 | 3 / 0 |
| All indexed, H = 400 | 63 / 49 | 0.4329 | 0.2486 | 0.3464 | 0.2695 | −0.0837 | 4 / 23 |
| All indexed, H = 50 | 63 / 49 | 0.4329 | 0.0883 | 0.3047 | 0.1699 | −0.2141 | 3 / 17 |

**Readings:**
- **In window:** history alone (B2, 0.6496) beats structural search (B1, 0.4069) when the rename commit lies inside the H = 400 window.
- **Fusion harm:** over all indexed held-out cases, fusion is worse than structural alone.
  - **H = 400:** B4 harms 23 cases and rescues 4.
  - **H = 50:** B4 harms 17 and rescues 3.

  This is the finding that motivated G.
- **Reachability:** only **20 of 91** task-B cases, across all splits, have their rename commit inside the H = 400 window.
- **Per language:** no per-language confirmatory test reached SUPPORTED. Java is INCONCLUSIVE with 6 clusters; the other languages had too few clusters to test.

**E3-Reach** (pre-registered, Java, H = 400, 18 cases): MRR B1 0.1623 vs B4 0.2825, Δ +0.1068, exact p = 0.06641, rescues / harms 4 / 2. The outcome is **INCONCLUSIVE**, identical before and after the parser fix.

---

## 5. Limitations

- **History reach.** The evaluated window is the 400 most recent commits. Older renames are not reachable (20 of 91 main-benchmark task-B cases were in window). `rtro init --history <n>` can widen the window, at a cost in indexing time.
- **Narrow query form.**
  - **Confirmatory test:** it used the old identifier as the query.
  - **Natural-language templates:** descriptive only. One of them ("What happened to OLD after the refactor?") is a degenerate baseline for B1: its non-identifier words keep every structural score below the 0.08 threshold.
- **Small JavaScript sample.** JavaScript has 7 repositories in the external set; its catalog was exhausted. Per-language results are descriptive.
- **Machine-verified main labels.** The main benchmark's 1,005-event review queue is still open.
- **Retrieval-only evaluation.** `rtro ask` builds a grounded prompt, but the quality of LLM answers has not been evaluated.
- **Clone skips.** In the external set, some repositories were skipped because cloning exceeded 10 minutes or 1.5 GB, or the repository was not found. Windows path-length failures were fixed with `core.longpaths` and those repositories retried.
- **Parser coverage.** Events and targets are limited to callables that Retrospect's Tree-sitter extractors can parse. One external target (droolsjbpm/jbpm) was missing from the structural index; it is counted as unranked for every system.

---

## 6. Reproducibility

| Tag | Commit | Contents |
|---|---|---|
| `eval-v1` | `1ac3b358c248fab5db2d7618de4cc057a856c9d4` | Code used for the external confirmation: B1–B4, the parser-leak fix, and G |
| `cli-v1.0.0` | `90feeeab46e431ad51782b701908547803360bde` | `retrospect-cli` v1.0.0 (`rtro`); retrieval code identical to `eval-v1` |
| `cli-v1.0.1` | `79c8192bcb8fcd158dd7e124fb53ea18c2fcd9ad` | `retrospect-cli` v1.0.1: `ask` sends no request when nothing is retrieved; retrieval code identical to `eval-v1` |

`cli-v1.0.0` points to the relicensing commit ("chore: MIT license; publish evaluation artifacts; README polish"). This table was updated in the commit after it.

**Evaluation workspaces.** Verbatim copies of both workspaces are published in [evaluation-artifacts/](evaluation-artifacts/). See its [README](evaluation-artifacts/README.md) for what each workspace is and which files are authoritative.

- **[evaluation-artifacts/retrospect_evaluation_2026-10-21/](evaluation-artifacts/retrospect_evaluation_2026-10-21/)** (main four-language benchmark):
  - **authoritative analysis:** `evaluation-artifacts/retrospect_evaluation_2026-10-21/evaluation/analysis/v4_parserfix/`;
  - **re-measurement and E3-Reach comparison:** [reports/parserfix_remeasurement.md](evaluation-artifacts/retrospect_evaluation_2026-10-21/reports/parserfix_remeasurement.md).
- **[evaluation-artifacts/retrospect_external_4lang/](evaluation-artifacts/retrospect_external_4lang/)** (external confirmation):
  - **results:** [analysis/external_v1/results.json](evaluation-artifacts/retrospect_external_4lang/analysis/external_v1/results.json), and [analysis/external_v1_posthoc/results_posthoc.json](evaluation-artifacts/retrospect_external_4lang/analysis/external_v1_posthoc/results_posthoc.json) for the sensitivity and post-hoc rows;
  - **pre-registration:** [protocol.md](evaluation-artifacts/retrospect_external_4lang/protocol.md);
  - **code version:** [VERSION.md](evaluation-artifacts/retrospect_external_4lang/VERSION.md).

The copies keep the absolute local paths of the machine that produced them; read those paths as provenance.

**Tests.** Run the safe subset:

```bash
npx jest --runInBand --testPathIgnorePatterns author_pack_blinding
```

`tests/unit/author_pack_blinding.test.js` rewrites timestamps in tracked Phase C files, so exclude it unless you intend to regenerate that pack.

A complete map of the documentation, including which documents are historical records and where each experiment's results live, is in [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md).

---

## 7. License and citation

MIT. See [LICENSE](LICENSE).

If you use Retrospect in academic work, please cite:

```
@misc{retrospect2026,
  title  = {Retrospect: Evolution-Aware Code Retrieval},
  author = {K-NagaCharan},
  year   = {2026},
  note   = {Citation placeholder; to be replaced with the paper reference}
}
```
