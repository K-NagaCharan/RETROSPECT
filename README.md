# Retrospect — Evolution-Aware Multi-Language Code Retrieval & Fusion Pipeline

Retrospect is a research-oriented, evolution-aware code retrieval and context search framework for repository-level LLMs and developers. It unifies **syntax-aware structural code search** over contemporary codebases with **deterministic Git history lineage tracking**, resolving historical predecessors across renames, relocations, and refactorings to deliver explainable, high-precision context.

Retrospect is implemented in **Node.js** and leverages Tree-sitter WebAssembly grammars (`web-tree-sitter`) for fast, robust parsing across Python, JavaScript, TypeScript, and Java without native C++ compilation toolchains.

---

## 1. System Architecture

```
Retrospect
├── src/
│   ├── index.js                  # Primary entry point & public API exports
│   ├── git/
│   │   └── GitHistoryReader.js   # Safe, deterministic Git inspection & commit snapshots
│   ├── languages/
│   │   ├── LanguageAdapter.js    # Common language adapter interface
│   │   ├── LanguageAdapterRegistry.js # Adapter discovery and singleton registry
│   │   ├── PythonAdapter.js      # Python function/method/decorator extraction
│   │   ├── JavaScriptAdapter.js  # JS declarations, expressions, arrows, class methods
│   │   ├── TypeScriptAdapter.js  # TS typed functions, access modifiers, return types
│   │   └── JavaAdapter.js        # Java methods, constructors, overloaded signatures
│   ├── parser/
│   │   ├── TreeSitterManager.js  # WASM grammar loading & parser singleton lifecycle
│   │   └── FunctionExtractor.js  # Multi-language symbol extraction orchestration
│   ├── model/
│   │   ├── SymbolRecord.js       # Language-neutral symbol model & hashing
│   │   └── HistoryGraph.js       # Function-version graph (nodes, edges, vocabulary)
│   ├── matcher/
│   │   ├── SimilarityUtils.js    # Token Jaccard, string edit distance, signature metrics
│   │   └── FunctionMatcher.js    # Tier 1 & Tier 2 deterministic evolution matcher
│   ├── storage/
│   │   ├── HistoryStore.js       # Streamable JSONL persistence, atomic writes & recovery
│   │   └── HistoryCache.js       # Immutable commit-level symbol caching & validation
│   ├── tracker/
│   │   └── HistoryTracker.js     # Git commit traversal & predecessor chaining
│   ├── structural/
│   │   ├── StructuralDiscovery.js# .gitignore-aware multi-language file discovery
│   │   ├── StructuralIndex.js    # Inverted index, call graph, and symbol registry
│   │   ├── StructuralQueryUnderstanding.js # Subtoken splitting, stemming, intent analysis
│   │   ├── StructuralRetriever.js# Multi-signal deterministic candidate scoring
│   │   ├── SymbolContextBuilder.js# Budget-aware atomic context window assembly
│   │   ├── CodeSearchEngine.js   # Programmatic search facade & index coordinator
│   │   └── index.js              # Structural subsystem barrel export
│   ├── retrieval/
│   │   ├── UnifiedSearch.js      # Public unified search engine (retrospect.search)
│   │   ├── HistoricalRetrievalAdapter.js # Transitive lineage stitching, profiles & fusion
│   │   └── HistoricalRetriever.js# User-facing commit-level evidence retrieval API
│   └── evaluation/
│       ├── HistoryEvaluator.js   # Ground-truth accuracy, precision, and latency metrics
│       ├── evaluationRunner.js   # Phase 1 evaluation CLI runner
│       └── benchmarks/
│           └── labeled_dataset.json # Phase 1 multi-language ground-truth benchmark
├── scripts/
│   ├── structural_cli.js         # Interactive structural search and indexing CLI
│   ├── run_structural_eval.js    # Structural benchmark runner (dev / held-out test splits)
│   ├── evaluate_phase_b_fusion.js# Phase B controlled fusion evaluation runner
│   └── export_phase_c_author_pack.js # Phase C blinded author pack exporter & leak scanner
├── data/
│   ├── structural_eval_benchmark.json # Structural evaluation dataset (22 instances)
│   ├── phase_b_evaluation_results.json # Preserved frozen Phase B evaluation baseline
│   ├── phase_b_evaluation_results_stitched.json # Transitive stitched lineage evaluation results
│   └── phase_c/                  # Phase C manifests, provenance, schemas, evaluator blind key
└── exported_packs/
    └── phase_c_author_pack/      # 18 blinded context cards, template, and instructions
```

---

## 2. Key Capabilities

### 1. Unified Search (`retrospect.search`)
Combines structural lexical/AST search with historical Git lineage evidence to rank contemporary code symbols. Supports 4 fusion strategies:
- **Reciprocal Rank Fusion (RRF $k=60$)**: Rank-based fusion providing robust suppression of false positives on unanswerable queries.
- **Linear Fusion**: Weighted linear combination ($w_s \cdot S + w_h \cdot H$).
- **Adaptive Fusion**: Signal-preserving fusion ($S_{\text{max}} + 0.25 \cdot S_{\text{min}}$).
- **Residual Historical Boost**: Baseline-preserving residual boost ($S + \alpha \cdot H \cdot (1 - S)$).

### 2. Transitive Lineage Stitching
Resolves function evolution across multi-hop chained renames and file moves (e.g., $A \to B \to C$) using deterministic AST matching and confidence discounting, ensuring HEAD symbols inherit historical context across long-term refactorings.

### 3. Syntax-Aware Structural Retrieval
Extracts symbols, signatures, docstrings, and call-graph relationships using Tree-sitter WASM parsers. Details available in [STRUCTURAL_RETRIEVAL.md](STRUCTURAL_RETRIEVAL.md).

### 4. Zero Semantic Leakage Phase C Benchmark Suite
Generates blinded author packs with salted HMAC-SHA256 opaque card identifiers (`CARD-[A-Z0-9]{6}`) and an automated fail-closed leakage scanner to enable genuine held-out evaluation without exposing target symbols, file paths, or commit SHAs.

---

## 3. Supported Languages

| Language | File Extensions | Supported Constructs |
| :--- | :--- | :--- |
| **Python** | `.py` | Module-level functions, class methods, nested functions, decorators (`@dec`), default/typed parameters, `*args`/`**kwargs`, return types. |
| **JavaScript** | `.js`, `.jsx`, `.mjs`, `.cjs` | Function declarations, function expressions, arrow functions (`const f = () => {}`), class methods, constructors, async methods, getters. |
| **TypeScript** | `.ts`, `.tsx`, `.mts`, `.cts` | All JS constructs + typed parameters, return type annotations, access modifiers (`public`, `private`, `protected`, `static`), generic parameters (`<T>`), interface method signatures. |
| **Java** | `.java` | Class/interface/enum methods, constructors, overloaded methods (distinguished by parameter count/types), qualified scopes, modifiers, annotations (`@Override`), thrown exceptions. |

---

## 4. Deterministic Matching & Lineage Strategy

Retrospect implements an explainable, deterministic baseline without embeddings or vector databases:

### Tier 1 — Strong Identity Signals
- **Exact Hash Match (`tier1_exact_hash`)**: Identical source code SHA-256 hash and matching symbol name across snapshots $\to$ `unchanged` (score `1.0`).
- **Exact Signature Match (`tier1_exact_signature`)**: Identical qualified name, enclosing scope, and normalized parameter signature with modified body $\to$ `modified` (score `0.98`, `high_confidence`).
- **Name & Scope Match (`tier1_name_and_scope`)**: Identical qualified name and enclosing scope with body token overlap $\to$ `modified` (`high_confidence`).

### Tier 2 — Similarity-Based Matching
When signatures change, functions are renamed, or files are moved:
- **Scoring Signals**: Normalized token Jaccard similarity (`0.35`), function name similarity (`0.25`), normalized signature similarity (`0.15`), enclosing scope similarity (`0.15`), parameter similarity (`0.10`).
- **Thresholds**: High confidence match ($\ge 0.70$), moderate confidence match ($\ge 0.50$).
- **Explicit Uncertainty**: If the top two candidate scores are within `0.08`, the matcher refrains from guessing and flags `uncertain` with `ambiguous_candidates`.
- **Change Vocabulary**: `unchanged`, `modified`, `renamed`, `moved`, `renamed_and_moved`, `new`, `deleted`, `uncertain`.

---

## 5. Usage & JavaScript API

### Installation

```bash
npm install
```

### 1. Unified Search (Structural + Git Lineage Fusion)

The unified search API evaluates contemporary symbols and combines structural and historical evidence using the selected fusion strategy:

```javascript
const retrospect = require('retrospect');

async function runSearch() {
  const query = 'Where is user authentication token validation handled?';
  const repoPath = './my-repository';

  const results = await retrospect.search(repoPath, query, {
    strategy: 'rrf',          // 'rrf' | 'linear' | 'adaptive' | 'residual'
    rrfK: 60,                 // RRF smoothing constant (default: 60)
    weightStructural: 0.60,   // Structural rank weight
    weightHistorical: 0.40,   // Historical rank weight
    maxResults: 5,            // Maximum candidate results
    historyDepth: 15          // Commits to inspect for lineage
  });

  console.log(`Query: "${results.query}" (${results.totalCandidates} candidates evaluated in ${results.timingMs}ms)`);

  for (const hit of results.results) {
    console.log(`\n[#${hit.rank}] ${hit.name} (${hit.kind})`);
    console.log(`  File: ${hit.filePath}:${hit.startLine}-${hit.endLine}`);
    console.log(`  Score: ${hit.score.toFixed(4)} (Structural: ${hit.structuralScore.toFixed(4)}, Historical: ${hit.historicalScore.toFixed(4)})`);

    if (hit.historicalProfile?.hasHistory) {
      console.log(`  Lineage: ${hit.historicalProfile.lineageClassification} (Confidence: ${hit.historicalProfile.lineageConfidence})`);
      console.log(`  Historical Names: ${hit.historicalProfile.historicalNames.join(', ')}`);
      console.log(`  Predecessors: ${hit.historicalProfile.predecessors.length} recorded versions`);
    }
  }
}

runSearch();
```

### 2. Structural Current-Code Retrieval

To query contemporary code directly without historical traversal (see [STRUCTURAL_RETRIEVAL.md](STRUCTURAL_RETRIEVAL.md)):

```javascript
const { searchCurrentCode, indexRepository } = require('retrospect');

async function runStructural() {
  const results = await searchCurrentCode('./my-repository', 'retry logic for failed network requests', {
    maxResults: 5,
    tokenBudget: 2000
  });

  for (const hit of results.results) {
    console.log(`[#${hit.rank}] ${hit.name} - Score: ${hit.score.toFixed(4)}`);
    console.log(`Reasons: ${hit.matchReasons.join('; ')}`);
    console.log(hit.code);
  }
}

runStructural();
```

### 3. Historical Retriever API

To inspect commit-by-commit evolution of specific symbols:

```javascript
const { HistoricalRetriever } = require('retrospect');

async function inspectHistory() {
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

  for (const item of evidence.symbols) {
    console.log(`Symbol: ${item.query.name} (Depth: ${item.historicalDepth})`);
    for (const version of item.history) {
      console.log(` - Commit: ${version.commitHash} [${version.changeClassification}]`);
      console.log(`   Signature: ${version.normalizedSignature}`);
    }
  }
}

inspectHistory();
```

---

## 6. Testing & Evaluation

### Running the Test Suite

Execute the full Jest test suite (16 test suites, 92 tests passing):

```bash
npm test
```

Test coverage includes:
- Multi-language Tree-sitter symbol extraction (Python, JS, TS, Java)
- Deterministic FunctionMatcher (Tier 1 exact & Tier 2 similarity)
- HistoryStore JSONL persistence and corruption recovery
- HistoryTracker commit traversal and merge resolution
- Structural discovery, indexing, query parsing, and ranking
- Transitive lineage stitching across multi-step renames and moves
- Unified search API with exact Phase B evaluation parity (alphabetical tie-breaking & RRF precision)
- Fail-closed Phase C author pack export and leak prevention

---

### Empirical Evaluation Benchmarks

Retrospect includes three distinct, reproducible benchmark suites:

#### A. Phase 1 Multi-Language Lineage Benchmark

```bash
npm run evaluate
```

```
Total Ground-Truth Examples:       13
Top-1 Matching Accuracy:          100.00%
Change Category Accuracy:         100.00%
False Historical Match Rate:        0.00%
Uncertain / No-Match Rate:         15.38%
Average Matching Latency:          0.110 ms
```

#### B. Structural Current-Code Benchmark

Evaluates 22 labeled instances across Python, JavaScript, TypeScript, and Java:

```bash
node scripts/run_structural_eval.js
```

| Split | Labeled Queries | Recall@1 | Recall@5 | MRR | Precision@1 | No-Result Acc |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Held-Out Test Split** | 16 | **100.00%** | **100.00%** | **1.0000** | **100.00%** | **100.00%** |
| **All Benchmark Instances** | 22 | **95.45%** | **95.45%** | **0.9545** | **95.45%** | **100.00%** |

#### C. Phase B Controlled Fusion Evaluation

Evaluates 40 audited lineage queries across 4 real-world repositories (`bottle`, `express`, `gson`, `zod`):

```bash
node scripts/evaluate_phase_b_fusion.js
```

**Held-Out Test Set Performance (17 answerable / 3 negative queries):**

| Retrieval Strategy | Recall@1 | Recall@5 | Recall@10 | MRR | False Positive Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Structural-Only Baseline** | 23.5% (4/17) | 35.3% (6/17) | 35.3% (6/17) | 0.2833 | 33.3% (1/3) |
| **Historical-Only Baseline** | 5.9% (1/17) | 35.3% (6/17) | 41.2% (7/17) | 0.1930 | 100.0% (3/3) |
| **Linear Fusion (0.60S / 0.40H)** | 17.6% (3/17) | 29.4% (5/17) | 52.9% (9/17) | 0.2600 | 33.3% (1/3) |
| **Adaptive Fusion** | 11.8% (2/17) | 29.4% (5/17) | 52.9% (9/17) | 0.2322 | 100.0% (3/3) |
| **Reciprocal Rank Fusion (RRF $k=60$)** | **23.5% (4/17)** | **41.2% (7/17)** | **58.8% (10/17)** | **0.3268** | **0.0% (0/3)** |
| **Residual Historical Boost** | 17.6% (3/17) | 35.3% (6/17) | 58.8% (10/17) | 0.2844 | 66.7% (2/3) |

*Key finding*: **RRF ($k=60$) achieves the highest overall MRR (0.3268) and 0% false positives on unanswerable queries**, proving superior to linear and adaptive fusion by avoiding score distribution mismatches.

#### D. Phase C Independent Blinded Benchmark Pack

Generates 18 blinded context cards with salted HMAC-SHA256 opaque tokens, strict information stripping, and a private evaluator mapping key:

```bash
node scripts/export_phase_c_author_pack.js
```

---

## CLI usage (`rtro`)

`retrospect-cli` installs two commands, `rtro` and `retrospect` (an alias). It needs Node 18 or newer and git on the `PATH`.

### Install

```bash
npm install -g retrospect-cli
```

To install from a local checkout instead, run `npm pack` and then `npm install -g retrospect-cli-1.0.0.tgz`.

### Index a repository: `rtro init`

Run inside any git working tree:

```bash
rtro init                 # default history window: the 400 most recent commits
rtro init --history 1000  # analyse a longer history
```

This builds the structural index and the history index, and stores them in `<repo>/.retrospect/` along with `config.json`. It also adds `.retrospect/` to `.git/info/exclude`. Tracked files are never modified.

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

Search uses Retrospect's lineage gate.
- **Identifiers in the question** (`` `backticks` ``, camelCase, snake_case, dotted names, or a single bare token) are matched against former names recorded in git history. Matching symbols are listed first, each with a `formerly <oldName> (renamed in <sha>, <date>)` line.
- **Without a lineage match**, results come from structural search over the current code.

If HEAD has moved since the index was built, the index is rebuilt first.

### Ask: `rtro ask`

```bash
rtro ask "what happened to show_message?" --dry-run    # print the full prompt; no network call
rtro ask "what happened to show_message?" --model <model-name>
rtro ask "where is filterObject now?" --provider openai-compatible --model llama3
```

`ask` takes the top results (`--k`, default 5) and builds a context within the token budget (default 4000). It sends a prompt with QUESTION, CURRENT CODE and HISTORICAL EVIDENCE sections. It prints the answer, then `Sources:` (file:line, plus the commit sha for historical evidence). The model is told to answer only from that context.

### Configure: `rtro config`

```bash
rtro config get k
rtro config set k 8                       # project keys: history, k, tokenBudget (.retrospect/config.json)
rtro config set provider anthropic --global
rtro config set model <model-name> --global
rtro config set baseUrl http://localhost:11434/v1 --global   # for openai-compatible servers
```

Global keys (`provider`, `model`, `baseUrl`) live in `~/.retrospect/config.json`. API keys are never stored in any file.

### Environment variables

| Variable | Used for |
|---|---|
| `ANTHROPIC_API_KEY` | `--provider anthropic` (the default) |
| `OPENAI_API_KEY` | `--provider openai-compatible` (OpenAI and other remote servers). Not needed when the base URL's host is `localhost`, `127.0.0.1` or `::1` (Ollama, LM Studio); the Authorization header is then omitted. |
| `OPENAI_BASE_URL` | Base URL for `openai-compatible` when `baseUrl` is not configured, e.g. `https://api.openai.com/v1` |
| `RETROSPECT_MODEL` | Default model when neither `--model` nor the `model` config key is set |

If a required key or model is missing, `rtro ask` names the variable or setting to provide. `--dry-run` never needs a key.

---

## 7. CLI Reference

```bash
# Structural Indexing & Search
node scripts/structural_cli.js index ./path/to/repo
node scripts/structural_cli.js search ./path/to/repo "handle multipart form upload" --limit 5

# Benchmark Runners
node scripts/run_structural_eval.js      # Structural current-code evaluation
node scripts/evaluate_phase_b_fusion.js  # Phase B controlled fusion evaluation
node scripts/export_phase_c_author_pack.js # Generate blinded Phase C author pack
```

---

## 8. License

ISC
