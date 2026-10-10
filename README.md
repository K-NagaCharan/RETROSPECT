# Retrospect — Multi-Language Historical Retrieval Pipeline

Retrospect is a research-oriented, evolution-aware context retrieval system for repository-level LLMs. It tracks function and method versions across Git commit history, identifies deterministic predecessor relationships, and supplies structured historical evidence to downstream context-fusion and generative models.

---

## 1. Architecture Overview

Retrospect is implemented entirely in **JavaScript using Node.js** and leverages Tree-sitter grammars (via `web-tree-sitter` WebAssembly binaries) for robust, cross-platform syntax-aware parsing without native compilation toolchains.

```
Retrospect
├── src/
│   ├── git/
│   │   └── GitHistoryReader.js       # Safe, deterministic Git inspection & snapshots
│   ├── languages/
│   │   ├── LanguageAdapter.js        # Common language adapter interface
│   │   ├── LanguageAdapterRegistry.js# Adapter discovery and registration
│   │   ├── PythonAdapter.js          # Python function/method extraction
│   │   ├── JavaScriptAdapter.js      # JS declaration, expression, arrow, class methods
│   │   ├── TypeScriptAdapter.js      # TS typed functions, access modifiers, return types
│   │   └── JavaAdapter.js            # Java methods, constructors, overloaded signatures
│   ├── parser/
│   │   ├── TreeSitterManager.js      # WASM parser loading & singleton lifecycle
│   │   └── FunctionExtractor.js      # Parsing orchestration & symbol generation
│   ├── model/
│   │   ├── SymbolRecord.js           # Language-neutral symbol representation
│   │   └── HistoryGraph.js           # Function-version graph (nodes, edges, vocabulary)
│   ├── matcher/
│   │   ├── SimilarityUtils.js        # Token Jaccard, string similarity, parameter metrics
│   │   └── FunctionMatcher.js        # Tier 1 & Tier 2 deterministic matcher
│   ├── storage/
│   │   ├── HistoryStore.js           # JSONL persistence, atomic writes & recovery
│   │   └── HistoryCache.js           # Immutable commit-level symbol caching & validation
│   ├── tracker/
│   │   └── HistoryTracker.js         # Git commit traversal & predecessor chaining
│   ├── retrieval/
│   │   └── HistoricalRetriever.js    # User-facing structured evidence retrieval API
│   └── evaluation/
│       ├── HistoryEvaluator.js       # Ground-truth accuracy, precision, and latency metrics
│       ├── evaluationRunner.js       # Reproducible CLI evaluation script
│       └── benchmarks/
│           └── labeled_dataset.json  # Ground-truth labeled benchmark dataset
```

---

## 2. Supported Languages

Retrospect provides function/method-level extraction for four target repository languages:

| Language | File Extensions | Supported Constructs |
| :--- | :--- | :--- |
| **Python** | `.py` | Module-level functions, class methods, nested functions, decorators (`@dec`), default/typed parameters, `*args`/`**kwargs`, return types. |
| **JavaScript** | `.js`, `.jsx`, `.mjs`, `.cjs` | Function declarations, function expressions, arrow functions (`const f = () => {}`), class methods, constructors, async methods. |
| **TypeScript** | `.ts`, `.tsx`, `.mts`, `.cts` | All JS constructs + typed parameters, return type annotations, access modifiers (`public`, `private`, `protected`, `static`, `abstract`), generic parameters (`<T>`), interface method signatures. |
| **Java** | `.java` | Class/interface/enum methods, constructors, overloaded methods (distinguished by parameter count/types), qualified scopes, modifiers, annotations (`@Override`), thrown exceptions. |

---

## 3. Layered Deterministic Matching Strategy

Retrospect implements an explainable, deterministic baseline without embeddings or vector databases:

### Tier 1 — Strong Identity Signals
- **Exact Hash Match (`tier1_exact_hash`)**: Identical source code SHA-256 hash and matching symbol name across snapshots $\to$ `unchanged` (score `1.0`).
- **Exact Signature Match (`tier1_exact_signature`)**: Identical qualified name, enclosing scope, and normalized parameter signature with modified body $\to$ `modified` (score `0.98`, `high_confidence`).
- **Name & Scope Match (`tier1_name_and_scope`)**: Identical qualified name and enclosing scope with healthy body token overlap $\to$ `modified` (`high_confidence`).

### Tier 2 — Similarity-Based Matching
When signatures change, functions are renamed, or files are moved:
- **Scoring Signals**:
  - Normalized token Jaccard similarity (weight: `0.35`)
  - Function name similarity (weight: `0.25`)
  - Normalized signature similarity (weight: `0.15`)
  - Enclosing scope similarity (weight: `0.15`)
  - Parameter similarity (weight: `0.10`)
- **Thresholds**:
  - High confidence match: score $\ge 0.70$
  - Moderate confidence match: score $\ge 0.50$

### Explicit Uncertainty & Decision Policy
- **Ambiguity Detection**: If the top two candidate scores are within `0.08` of each other, the matcher refrains from guessing and flags `uncertain` with `ambiguous_candidates`.
- **New vs Unresolved**: If the containing file was newly introduced in the commit, the change classification is recorded as `new` (`no_match`). If candidates exist but score below `0.40`, it is explicitly marked as `uncertain`.

### Change Vocabulary
- `unchanged`
- `modified`
- `renamed`
- `moved`
- `renamed_and_moved`
- `new`
- `deleted`
- `uncertain`

---

## 4. Graph Persistence and Cache Correctness

- **JSONL Records**: Nodes and edges are stored using JSONL (`.jsonl`), allowing incremental stream loading and skipping malformed lines without discarding the entire graph.
- **Atomic Writes**: Written to `.tmp` files and atomically renamed, eliminating partial write corruption.
- **Validation**: Cached parsed symbols track grammar versions (`parserVersion: '1.0.0'`) and repository commit immutability.
- **Cache Invalidation**: Target commits can be invalidated individually or globally.

---

## 5. Usage & JavaScript API

### Installation

```bash
npm install
```

### Retrieval Example

```javascript
const { HistoricalRetriever } = require('retrospect');

async function main() {
  const retriever = new HistoricalRetriever();

  const evidence = await retriever.retrieve({
    repoPath: './my-repository',
    targetCommit: 'HEAD',
    symbolQueries: [
      { filePath: 'src/auth.ts', name: 'login' }
    ],
    historyDepth: 10,
    includeDiffs: true
  });

  console.log('Retrieval Summary:', evidence.retrievalMetadata);
  for (const item of evidence.symbols) {
    console.log(`Symbol: ${item.query.name}`);
    console.log(`Historical depth: ${item.historicalDepth}`);
    for (const version of item.history) {
      console.log(` - Commit: ${version.commitHash} [${version.changeClassification}]`);
      console.log(`   Signature: ${version.normalizedSignature}`);
    }
  }
}

main();
```

---

## 6. Testing & Evaluation

### Running Tests

Execute the full Jest test suite:

```bash
npm test
```

### Running the Evaluation Benchmark

Run the evaluation runner over the labeled multi-language dataset:

```bash
npm run evaluate
```

#### Evaluation Results Summary

```
Total Ground-Truth Examples:       13
Top-1 Matching Accuracy:          100.00%
Change Category Accuracy:         100.00%
False Historical Match Rate:      0.00%
Uncertain / No-Match Rate:        15.38%
Average Matching Latency:         0.110 ms

Performance by Language:
- Python:     100% Top-1 Accuracy (4/4)
- JavaScript: 100% Top-1 Accuracy (3/3)
- TypeScript: 100% Top-1 Accuracy (3/3)
- Java:       100% Top-1 Accuracy (3/3)
```

---

## 7. Known Limitations and Next Milestones

1. **Multi-Parent Traversal**: Current merge commit traversal follows the first parent (`--first-parent`), which represents the main integration branch. Future milestones can expand branch-spanning historical synthesis across multiple parents.
2. **Language Scope**: C/C++ are out of scope for this milestone. Additional languages (Go, Rust, Ruby) can be plugged into `LanguageAdapterRegistry` without modifying matcher or traversal logic.
3. **Refactoring Tracking**: Split functions (1-to-many) and merged functions (many-to-one) can be incorporated in future refactoring-aware enhancements.
