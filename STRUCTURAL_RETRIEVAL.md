# Retrospect: Structural Current-Code Retrieval Pipeline

## 1. Overview & Architecture

Retrospect's **Structural Current-Code Retrieval Pipeline** provides deterministic, syntax-aware code retrieval over contemporary repositories without relying on LLMs, embeddings, or external vector databases. Given a natural-language query or symbol query, the pipeline identifies the most relevant functions, methods, classes, and interfaces across the codebase, returning source-located code snippets with transparent, explainable score breakdowns.

### Pipeline Stages

The system is organized into modular stages adhering to a clean separation of concerns:

```
[Repository Root]
       │
       ▼
┌─────────────────────────────────┐
│ Stage A: Repository Discovery   │ ◄── Respects .gitignore, ignores binaries & node_modules,
└─────────────────────────────────┘      limits file size & count, prevents symlink cycles
       │
       ▼
┌─────────────────────────────────┐
│ Stage B: Structural Parsing     │ ◄── Tree-sitter WASM grammars for Python, JS, TS, Java
└─────────────────────────────────┘      Extracts functions, classes, signatures, calls, docstrings
       │
       ▼
┌─────────────────────────────────┐
│ Stage C: Structural Index       │ ◄── Versioned local index (v1.0.0), token inverted indices,
└─────────────────────────────────┘      exact lookup, forward/reverse call graphs, incremental sync
       │
       ▼
┌─────────────────────────────────┐
│ Stage D: Query Understanding    │ ◄── Subtoken splitting (camelCase, snake_case), stemming,
└─────────────────────────────────┘      stopword removal, exact candidate identification
       │
       ▼
┌─────────────────────────────────┐
│ Stage E: Candidate Ranking      │ ◄── Multi-signal scoring: exact name, identifier overlap,
└─────────────────────────────────┘      docstrings, file path, signature, kind match, graph boost
       │
       ▼
┌─────────────────────────────────┐
│ Stage F: Context Construction   │ ◄── Atomic complete blocks, token budget approximation,
└─────────────────────────────────┘      explainable reason logs, truncation indicators
       │
       ▼
┌─────────────────────────────────┐
│ Stage G: Integration Interface  │ ◄── Programmatic API & CLI for downstream Retrospect pipelines
└─────────────────────────────────┘
```

---

## 2. Multi-Language Support

Retrospect implements language-specific parsers behind a unified abstract interface `LanguageAdapter`:

| Language | File Extensions | Extracted Symbol Types | Specific Capabilities |
| :--- | :--- | :--- | :--- |
| **Python** | `.py` | Functions, methods, nested functions, classes | Docstring extraction, decorators, keyword parameter signatures, import dependencies, AST calls |
| **JavaScript** | `.js`, `.jsx`, `.mjs`, `.cjs` | Function declarations, expressions, arrow functions, class methods, classes | JSDoc/block comments, default parameters, imports, call identifiers |
| **TypeScript** | `.ts`, `.tsx`, `.mts`, `.cts` | Functions, methods, classes, interfaces, enums, arrow functions | Type annotations, modifiers (`public`, `private`, `async`), parameter type hints |
| **Java** | `.java` | Methods, constructors, classes, interfaces, enums, records | Javadoc extraction, visibility modifiers, parameter types, overloaded signatures |

### Adding a New Language Adapter

To add support for a new language (e.g. Go, Rust, Ruby):
1. Install the Tree-sitter WASM grammar in `node_modules/tree-sitter-wasms/out/tree-sitter-<lang>.wasm`.
2. Extend `LanguageAdapter` in `src/languages/<Lang>Adapter.js`:
   - Implement `extractSymbols(sourceCode, tree, filePath)`: traverse the Tree-sitter AST, returning instances of `SymbolRecord`.
   - Implement `extractImports(tree, sourceCode)`: return imported module names and symbols.
   - Implement `_extractLeadingComment(node, sourceCode)`: extract associated docstrings or comments.
3. Register the new adapter in `src/languages/LanguageAdapterRegistry.js` (`this.register(new <Lang>Adapter())`). `FunctionExtractor` selects adapters through the registry by `getFileExtensions()`, so there is no separate extension mapping.
4. Add unit test coverage in `tests/unit/adapters.test.js`.

---

## 3. Structural Index & Incremental Updating

The structural index format is explicitly versioned (`schemaVersion: "1.0.0"`):

- **Symbol Registry**: Map of stable IDs (`<filePath>::<scope.>name::<startLine>`) to full `SymbolRecord` metadata.
- **Exact Name Index**: Map of raw identifier names to candidate symbol IDs.
- **Inverted Token Index**: Map of stemmed sub-tokens to posting lists for lexical search.
- **Call Graph**: Forward call edges (`callerId -> [calledNames]`) and reverse call edges (`calleeId -> [callerIds]`).
- **File Manifest**: Tracked file modification times (`mtimeMs`) and content hashes (`sha256`).
- **Incremental Sync**: `index.updateIncremental(repoPath)` re-discovers files, purges symbols of deleted files, and re-indexes modified/added files (by `mtimeMs` and size) without re-parsing untouched files.

---

## 4. Deterministic Ranking Strategy

Candidate symbols are evaluated across multiple independent, normalized signals. Scores are deterministic, explainable, and bounded in $[0.0, 1.0]$.

### Scoring Formula

$$S(s, q) = w_{\text{exact}} \cdot I_{\text{exact}} + w_{\text{token}} \cdot \text{Score}_{\text{token}} + w_{\text{doc}} \cdot \text{Score}_{\text{doc}} + w_{\text{path}} \cdot \text{Score}_{\text{path}} + w_{\text{sig}} \cdot \text{Score}_{\text{sig}} + w_{\text{kind}} \cdot I_{\text{kind}} + w_{\text{graph}} \cdot \text{Score}_{\text{graph}}$$

| Component | Default Weight | Description |
| :--- | :--- | :--- |
| **Exact Name Match ($I_{\text{exact}}$)** | $0.35$ | Returns $1.0$ if the symbol identifier exactly matches any candidate identifier extracted from the query. |
| **Identifier Token Overlap ($\text{Score}_{\text{token}}$)** | $0.25$ | Jaccard / token-coverage overlap between query sub-tokens and the symbol's split identifier parts. |
| **Docstring / Comment Relevance ($\text{Score}_{\text{doc}}$)** | $0.15$ | Coverage of query terms found within the associated docstring or JSDoc comment. |
| **File Path Relevance ($\text{Score}_{\text{path}}$)** | $0.10$ | Sub-token matches against the file path and enclosing module name. |
| **Signature Overlap ($\text{Score}_{\text{sig}}$)** | $0.05$ | Matches against parameters and return types in the signature. |
| **Target Kind Match ($I_{\text{kind}}$)** | $0.05$ | Bonus if the query specifies intent (e.g. "class", "interface", "function") matching symbol kind. |
| **Call Graph Proximity ($\text{Score}_{\text{graph}}$)** | $0.05$ | Graph score of 0.8 or 0.6 (otherwise 0) for symbols called by or calling high-confidence candidate symbols; weighted like the other signals. |

### Minimum Threshold & Deduplication
- Minimum candidate acceptance threshold: $0.08$ (`minScoreThreshold` in `StructuralRetriever`).
- Queries with zero candidate matches above threshold return an empty result list (preventing noisy false positives).
- Results are deduplicated by stable symbol ID.

---

## 5. Usage & CLI

### Programmatic API

```javascript
const {
  indexRepository,
  searchCurrentCode,
  getSymbol,
  getRelatedSymbols
} = require('retrospect-cli');   // or require('./src') from a checkout

// 1. Index a repository (optionally persist it)
const index = await indexRepository('./my-repo', {
  persistPath: './my-repo/.retrospect/structural-index.json'
});

// 2. Search current code
const results = await searchCurrentCode('./my-repo', 'Where is user authentication handled?', {
  maxResults: 5,
  tokenBudget: 2000
});

results.results.forEach((res, i) => {
  console.log(`[#${i + 1}] ${res.name} (${res.kind}) - Score: ${res.score.toFixed(4)}`);
  console.log(`    File: ${res.filePath}:${res.range.startLine}-${res.range.endLine}`);
  console.log(`    Reasons: ${res.matchReasons.join('; ')}`);
  console.log(res.source);
});

// 3. Inspect a specific symbol and its call-graph relations
const symbol = await getSymbol('./my-repo', results.results[0].symbolId);
const related = await getRelatedSymbols('./my-repo', symbol.id);
```

### Command Line Interface

```bash
# Index a repository and persist to disk
node scripts/structural_cli.js index ./data/fixtures/eval_repos/python_repo

# Search code with natural-language or exact queries
node scripts/structural_cli.js search ./data/fixtures/eval_repos/python_repo "Where is user authentication handled?"

# Search with custom token budget and maximum results
node scripts/structural_cli.js search ./data/fixtures/eval_repos/javascript_repo "retry logic for failed API requests" --limit 3 --budget 1500

# Run the complete structural evaluation harness
node scripts/structural_cli.js evaluate
# or
node scripts/run_structural_eval.js
```

---

## 6. Evaluation & Benchmark Results

> Note (2026-10-23): this section reports the original structural mini-benchmark (`data/structural_eval_benchmark.json`); its figures were not re-measured at `eval-v1`. For the current evaluations see [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md).

### Dataset Provenance & Design
The benchmark dataset (`data/structural_eval_benchmark.json`) contains **22 explicitly labeled instances** evaluated across 4 real, multi-language mini-repositories (`python_repo`, `javascript_repo`, `typescript_repo`, `java_repo`):
- **Development Split**: 6 instances (used to calibrate weight defaults).
- **Held-Out Test Split**: 16 instances (unseen during weight tuning).

The dataset covers 7 distinct query categories:
1. `exact_name`: Exact function/class name queries.
2. `functional_description`: Natural-language functional descriptions.
3. `generic_misleading_name`: Target functions with non-obvious/generic names (e.g. `process`, `run`).
4. `dependency_helper`: Queries requiring discovery of supporting utilities.
5. `no_result`: Queries with zero relevant symbols in the codebase.
6. `ambiguous`: Queries with multiple plausible matches.
7. `multi_file`: Multi-file relevant code distributions.

### Measured Empirical Performance (Held-Out Test Split)

| Metric | Target / Benchmark | Measured Test Result |
| :--- | :--- | :--- |
| **Recall@1** | $\ge 80.0\%$ | **100.00%** |
| **Recall@5** | $\ge 90.0\%$ | **100.00%** |
| **Recall@10** | $\ge 95.0\%$ | **100.00%** |
| **MRR (Mean Reciprocal Rank)** | $\ge 0.85$ | **1.0000** |
| **Precision@1** | $\ge 80.0\%$ | **100.00%** |
| **Precision@5** | - | **90.10%** |
| **No-Result Accuracy** | $100.0\%$ | **100.00%** |
| **Mean Query Latency** | $< 50\text{ ms}$ | **0.81 ms** ($p95 = 6.0\text{ ms}$) |

### Breakdown by Language (Test Split)

| Language | Labeled Queries | Recall@1 | Recall@5 | MRR | Precision@1 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | 5 | 100.0% | 100.0% | 1.000 | 100.0% |
| **JavaScript** | 3 | 100.0% | 100.0% | 1.000 | 100.0% |
| **TypeScript** | 3 | 100.0% | 100.0% | 1.000 | 100.0% |
| **Java** | 5 | 100.0% | 100.0% | 1.000 | 100.0% |

### Breakdown by Query Category (Test Split)

| Category | Queries | Recall@1 | Recall@5 | MRR | No-Result Acc |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `functional_description` | 8 | 100.0% | 100.0% | 1.000 | 100.0% |
| `generic_misleading_name` | 1 | 100.0% | 100.0% | 1.000 | 100.0% |
| `exact_name` | 2 | 100.0% | 100.0% | 1.000 | 100.0% |
| `dependency_helper` | 1 | 100.0% | 100.0% | 1.000 | 100.0% |
| `no_result` | 3 | 100.0% | 100.0% | 1.000 | 100.0% |
| `ambiguous` | 1 | 100.0% | 100.0% | 1.000 | 100.0% |

Across all 22 benchmark instances (dev + test splits combined), Retrospect achieves **95.45% Recall@1**, **95.45% Recall@5**, **0.9545 MRR**, and **100.00% No-Result Accuracy**.

---

## 7. Known Limitations & Scope Boundaries

1. **Static Name-Based Call Graph Resolution**:
   Tree-sitter AST extraction resolves function calls syntactically by identifier name. It does not perform full semantic type-inference, flow-sensitive pointer analysis, or dynamic dispatch resolution across polymorphic class hierarchies.
2. **Current-Code Isolation**:
   In accordance with the task specification, this pipeline operates strictly on contemporary repository snapshots. Git commit lineage traversal, historical tracking across renames, and commit diff fusion are decoupled and handled in Retrospect's historical pipeline. The lineage gate that combines them is described in the [README](README.md#2-how-it-works).
3. **Out-of-Scope Languages**:
   C and C++ are not included in this release.
4. **Token Budget Approximation**:
   Budget estimation uses character-ratio heuristics (~4 characters per token). While standard for LLM context estimation, exact subword token counts may vary slightly depending on the specific downstream tokenizer (e.g., Tiktoken, Llama).
