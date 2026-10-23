# Diagnosis: Tree-sitter WASM abort during history indexing (read-only; no code changed)

## Symptom

During long history passes, the history window stopped being processed:
- **H = 400:** guava, lodash, moment, typeorm, zod.
- **H = 50:** never.

Every later parse in the same Node process threw `ExitStatus: Program terminated with exit(1)`. Retrospect swallowed these errors, so structural indexes came back empty (0 symbols) and history profiles were silently truncated.

## Root cause: WASM memory leak (two allocations never freed)

`web-tree-sitter` 0.20.8 allocates parsers and syntax trees in the WASM module's linear memory, which JavaScript's garbage collector does not reclaim. They must be freed with `.delete()`. Retrospect frees neither:

1. **`src/languages/LanguageAdapter.js:25-28`:** `parse()` calls `TreeSitterManager.createParser()` on **every call**, which creates a new `Parser` that is never deleted.
2. **`src/parser/FunctionExtractor.js:25`:** the `Tree` returned by `adapter.parse()` is used for `extractSymbols`/`extractImports` and **never deleted**. There is no `.delete()` call anywhere under `src/`.

Trees dominate the leak, because their size scales with file size. When the WASM heap reaches its limit, the Emscripten runtime aborts with `exit(1)`. The module is a process-wide singleton (`TreeSitterManager`), so it stays dead for the rest of the process.

### Why errors were invisible

- `StructuralIndex._indexFile` (`src/structural/index/StructuralIndex.js:156-160`) catches extraction errors and `return`s, which produces an empty index.
- `HistoricalRetrievalAdapter.indexRepositoryHistory` (`src/retrieval/HistoricalRetrievalAdapter.js:477-488`) catches them and returns `[]`. Failures are not cached, so every later file version is retried and fails too; all remaining commits contribute no history.

## Evidence

**1. Stress test** (`scratchpad/wasm_leak_test.js`): one 317 KB guava file (`PublicSuffixPatterns.java`) parsed repeatedly, with the same `createParser` → `parse` calls as Retrospect.

| Mode | Result |
|---|---|
| As in Retrospect (no `.delete()`) | **Fails at parse #418** with `ExitStatus: exit(1)`, the same error seen in the benchmark |
| `tree.delete()` after use | 6,000 parses, no failure |
| `tree.delete()` + `parser.delete()` | 6,000 parses, no failure |

**2. Stage probe** (guava): the extractor still works after structural indexing and after the H = 50 history pass. It fails after the H = 400 pass.

**3. Failure depends on bytes parsed, not commit count.** Approximate parses per H = 400 pass:

| Repository | Approximate parses | Aborted? |
|---|---|---|
| zod | 2,800 | **Yes** |
| moment | 5,100 | **Yes** |
| lodash | 5,200 | **Yes** |
| guava | 13,500 | **Yes** |
| typeorm | 20,800 | **Yes** |
| sonarqube | 2,400 | No |
| spring-boot | 17,400 | No |

Repositories with very large source files (lodash and moment bundles, zod's large `.ts` files, guava's generated tables) exhaust the heap first. The leak accumulates across everything one process parses: structural index, then H = 50, then H = 400.

**4. Deleting the tree is safe.** For one file per language, extracted symbols and imports are byte-identical before and after `tree.delete()`. The symbols hold no live `Node`, `Tree` or `TreeCursor` objects; adapters copy text into strings.

| Language | File | Symbols |
|---|---|---|
| Java | jfinal `Controller.java` | 176 |
| Python | black `linegen.py` | 77 |
| JavaScript | koa `application.js` | 18 |
| TypeScript | vue `component.ts` | 49 |

## Impact

**This evaluation:** the repositories listed above have truncated H = 400 history. They are flagged per case (`parser_healthy_after_history`), and the primary analysis has a sensitivity check without them.

**Earlier experiments:** E1, E2, E3-Reach and E-Lineage ran without probes, so silent truncation there is **not ruled out**.

- E3-Reach (Java, H = 400, Category-B repositories) is the most exposed.
- The earlier worker ran one snapshot per process, which limits accumulation to a single repository's index plus history.
- Whether any of those snapshots crossed the limit is unknown until they are re-checked.

**Production use:** any long-running Retrospect process, such as a server or an index-many-repositories job, will eventually stop extracting symbols and give no error.

## Proposed fix (not applied; awaiting approval)

These changes are minimal and leave ranking logic and weights unchanged.

1. **`FunctionExtractor.extract`:** wrap extraction in `try { ... } finally { tree.delete(); }`.
2. **`LanguageAdapter.parse`:** reuse one parser per language (cache it in `TreeSitterManager`) instead of creating a parser per call. Alternatively, delete the parser after use. Parsing output is unchanged either way.
3. **Make failures visible:** count extraction failures in `StructuralIndex` and in history indexing, and expose them in stats. Optionally fail fast on `ExitStatus`. This only changes error reporting, not retrieval.
4. **Regression tests:**
   - a unit test with a spy adapter asserting the tree is deleted, even when `extractSymbols` throws;
   - a parse-reuse test;
   - an optional slow stress test (≥ 1,000 parses of a large generated source).

**Verification after the fix:**
- The safe Jest subset passes.
- **E1 reproduces 116/116 ranks.** Expected unchanged: its snapshots should be far below the limit.
- Re-running the five aborted repositories at H = 400 on the frozen cases, into a new run folder, shows no abort.

**This changes results only for cases whose history was previously truncated.** Any rerun on the held-out set is therefore a re-measurement with corrected software, not tuning, and should be reported as such alongside the as-run results.
