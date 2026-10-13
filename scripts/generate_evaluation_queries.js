const fs = require('fs');
const path = require('path');

const auditedBenchmark = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/benchmark_lineage_audited.json'), 'utf8'));

// Formulate realistic natural-language developer queries without copy-pasting commit messages
const queries = [
  // ----------------------------------------------------
  // PYTHON: Bottle (10 queries)
  // ----------------------------------------------------
  {
    query_id: "q_py_bot_01",
    case_id: "py_bot_01",
    repository: "bottle",
    language: "python",
    evolution_type: "rewrite",
    query: "How does route callback inspection determine parameter lists using signature introspection?",
    has_answer: true,
    target_symbol_name: "get_undecorated_callback",
    target_file_path: "bottle.py",
    predecessor_name: "get_undecorated_callback",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_py_bot_02",
    case_id: "py_bot_02",
    repository: "bottle",
    language: "python",
    evolution_type: "routine_modification",
    query: "Construct reverse URLs with multiple repeating query string parameters",
    has_answer: true,
    target_symbol_name: "build",
    target_file_path: "bottle.py",
    predecessor_name: "build",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_py_bot_03",
    case_id: "py_bot_03",
    repository: "bottle",
    language: "python",
    evolution_type: "routine_modification",
    query: "Serve static assets from disk and handle conditional cache headers and entity tags",
    has_answer: true,
    target_symbol_name: "static_file",
    target_file_path: "bottle.py",
    predecessor_name: "static_file",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_py_bot_04",
    case_id: "py_bot_04",
    repository: "bottle",
    language: "python",
    evolution_type: "routine_modification",
    query: "Format server adapter instance into a readable debug string representation",
    has_answer: true,
    target_symbol_name: "__repr__",
    target_file_path: "bottle.py",
    predecessor_name: "__repr__",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_py_bot_05",
    case_id: "py_bot_05",
    repository: "bottle",
    language: "python",
    evolution_type: "rewrite",
    query: "Convert raw bytes or bytearrays into decoded unicode text safely",
    has_answer: true,
    target_symbol_name: "touni",
    target_file_path: "bottle.py",
    predecessor_name: "touni",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_py_bot_06",
    case_id: "py_bot_06",
    repository: "bottle",
    language: "python",
    evolution_type: "signature_change",
    query: "Register configuration settings with default values and filtering hooks in ConfigDict",
    has_answer: true,
    target_symbol_name: "_define",
    target_file_path: "bottle.py",
    predecessor_name: "_define",
    expected_evolution: "signature_change"
  },
  {
    query_id: "q_py_bot_07",
    case_id: "py_bot_07",
    repository: "bottle",
    language: "python",
    evolution_type: "routine_modification",
    query: "Emit deprecation warning when obsolete framework options are accessed",
    has_answer: true,
    target_symbol_name: "depr",
    target_file_path: "bottle.py",
    predecessor_name: "depr",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_py_bot_08",
    case_id: "py_bot_08",
    repository: "bottle",
    language: "python",
    evolution_type: "rewrite",
    query: "Assemble HTTP response header tuples efficiently without redundant thread-local lookups",
    has_answer: true,
    target_symbol_name: "headerlist",
    target_file_path: "bottle.py",
    predecessor_name: "headerlist",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_py_bot_09",
    case_id: "py_bot_09",
    repository: "bottle",
    language: "python",
    evolution_type: "hard_negative",
    query: "Where is the tonat native string translation helper defined?",
    has_answer: false, // tonat was deleted; tob is not tonat
    target_symbol_name: null,
    target_file_path: null,
    predecessor_name: null,
    expected_evolution: "hard_negative"
  },
  {
    query_id: "q_py_bot_10",
    case_id: "py_bot_10",
    repository: "bottle",
    language: "python",
    evolution_type: "hard_negative",
    query: "Handle RouteReset exception when plugin stack needs full reconfiguration",
    has_answer: false, // RouteReset was removed
    target_symbol_name: null,
    target_file_path: null,
    predecessor_name: null,
    expected_evolution: "hard_negative"
  },

  // ----------------------------------------------------
  // JAVASCRIPT: Express (10 queries)
  // ----------------------------------------------------
  {
    query_id: "q_js_exp_01",
    case_id: "js_exp_01",
    repository: "express",
    language: "javascript",
    evolution_type: "rewrite",
    query: "Send response payload and manage Content-Length alongside chunked Transfer-Encoding",
    has_answer: true,
    target_symbol_name: "send",
    target_file_path: "lib/response.js",
    predecessor_name: "send",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_js_exp_02",
    case_id: "js_exp_02",
    repository: "express",
    language: "javascript",
    evolution_type: "routine_modification",
    query: "Render template view when optional options parameter is omitted or null",
    has_answer: true,
    target_symbol_name: "render",
    target_file_path: "lib/application.js",
    predecessor_name: "render",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_js_exp_03",
    case_id: "js_exp_03",
    repository: "express",
    language: "javascript",
    evolution_type: "routine_modification",
    query: "Start HTTP server listener and forward port arguments using sliced arguments",
    has_answer: true,
    target_symbol_name: "listen",
    target_file_path: "lib/application.js",
    predecessor_name: "listen",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_js_exp_04",
    case_id: "js_exp_04",
    repository: "express",
    language: "javascript",
    evolution_type: "signature_change",
    query: "Check acceptable client languages using modern rest parameter syntax",
    has_answer: true,
    target_symbol_name: "acceptsLanguages",
    target_file_path: "lib/request.js",
    predecessor_name: "acceptsLanguages",
    expected_evolution: "signature_change"
  },
  {
    query_id: "q_js_exp_05",
    case_id: "js_exp_05",
    repository: "express",
    language: "javascript",
    evolution_type: "routine_modification",
    query: "Redirect client with HTML page body containing complete document doctype and title",
    has_answer: true,
    target_symbol_name: "redirect",
    target_file_path: "lib/response.js",
    predecessor_name: "redirect",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_js_exp_06",
    case_id: "js_exp_06",
    repository: "express",
    language: "javascript",
    evolution_type: "routine_modification",
    query: "Log unhandled server exceptions by printing entire error object to console",
    has_answer: true,
    target_symbol_name: "logerror",
    target_file_path: "lib/application.js",
    predecessor_name: "logerror",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_js_exp_07",
    case_id: "js_exp_07",
    repository: "express",
    language: "javascript",
    evolution_type: "routine_modification",
    query: "Detect request protocol using socket encryption state instead of deprecated connection",
    has_answer: true,
    target_symbol_name: "protocol",
    target_file_path: "lib/request.js",
    predecessor_name: "protocol",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_js_exp_08",
    case_id: "js_exp_08",
    repository: "express",
    language: "javascript",
    evolution_type: "routine_modification",
    query: "Verify whether cached client response is fresh for HTTP QUERY requests",
    has_answer: true,
    target_symbol_name: "fresh",
    target_file_path: "lib/request.js",
    predecessor_name: "fresh",
    expected_evolution: "routine_modification"
  },
  {
    query_id: "q_js_exp_09",
    case_id: "js_exp_09",
    repository: "express",
    language: "javascript",
    evolution_type: "hard_negative",
    query: "Set Location response header without sending a 302 redirect response",
    has_answer: true,
    target_symbol_name: "location",
    target_file_path: "lib/response.js",
    predecessor_name: null, // redirect is hard negative, not predecessor
    expected_evolution: "hard_negative"
  },
  {
    query_id: "q_js_exp_10",
    case_id: "js_exp_10",
    repository: "express",
    language: "javascript",
    evolution_type: "signature_change",
    query: "Evaluate acceptable character encodings against Accept-Charset with variable arguments",
    has_answer: true,
    target_symbol_name: "acceptsCharsets",
    target_file_path: "lib/request.js",
    predecessor_name: "acceptsCharsets",
    expected_evolution: "signature_change"
  },

  // ----------------------------------------------------
  // TYPESCRIPT: Zod (10 queries)
  // ----------------------------------------------------
  {
    query_id: "q_ts_zod_01",
    case_id: "ts_zod_01",
    repository: "zod",
    language: "typescript",
    evolution_type: "rename",
    query: "Convert Zod core schema into JSON schema definition without colliding with Node process polyfill",
    has_answer: true,
    target_symbol_name: "processSchema",
    target_file_path: "packages/zod/src/v4/core/to-json-schema.ts",
    predecessor_name: "process",
    expected_evolution: "rename"
  },
  {
    query_id: "q_ts_zod_02",
    case_id: "ts_zod_02",
    repository: "zod",
    language: "typescript",
    evolution_type: "rename",
    query: "Memoize schema evaluation using single prototype-backed caching utility",
    has_answer: true,
    target_symbol_name: "cached",
    target_file_path: "packages/zod/src/v4/core/util.ts",
    predecessor_name: "cachedInternal",
    expected_evolution: "rename"
  },
  {
    query_id: "q_ts_zod_03",
    case_id: "ts_zod_03",
    repository: "zod",
    language: "typescript",
    evolution_type: "rewrite",
    query: "Fast regular expression for validating email addresses without lookaheads",
    has_answer: true,
    target_symbol_name: "email",
    target_file_path: "packages/zod/src/v4/core/regexes.ts",
    predecessor_name: "email",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_ts_zod_04",
    case_id: "ts_zod_04",
    repository: "zod",
    language: "typescript",
    evolution_type: "new_symbol",
    query: "Validate three-letter ISO 4217 financial currency codes",
    has_answer: true,
    target_symbol_name: "currencyCode",
    target_file_path: "packages/zod/src/v4/classic/schemas.ts",
    predecessor_name: null,
    expected_evolution: "new_symbol"
  },
  {
    query_id: "q_ts_zod_05",
    case_id: "ts_zod_05",
    repository: "zod",
    language: "typescript",
    evolution_type: "signature_change",
    query: "Constrain class instance property schema shapes using mapped keys of instance type",
    has_answer: true,
    target_symbol_name: "properties",
    target_file_path: "packages/zod/src/v4/classic/schemas.ts",
    predecessor_name: "properties",
    expected_evolution: "signature_change"
  },
  {
    query_id: "q_ts_zod_06",
    case_id: "ts_zod_06",
    repository: "zod",
    language: "typescript",
    evolution_type: "new_symbol",
    query: "Validate international bank account numbers using mod-97 check digits",
    has_answer: true,
    target_symbol_name: "iban",
    target_file_path: "packages/zod/src/v4/classic/schemas.ts",
    predecessor_name: null,
    expected_evolution: "new_symbol"
  },
  {
    query_id: "q_ts_zod_07",
    case_id: "ts_zod_07",
    repository: "zod",
    language: "typescript",
    evolution_type: "rewrite",
    query: "Execute boolean schema validation and stop processing on first issue encounter",
    has_answer: true,
    target_symbol_name: "validate",
    target_file_path: "packages/zod/src/v4/core/schemas.ts",
    predecessor_name: "validate",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_ts_zod_08",
    case_id: "ts_zod_08",
    repository: "zod",
    language: "typescript",
    evolution_type: "rewrite",
    query: "Verify array container length bounds prior to traversing child items",
    has_answer: true,
    target_symbol_name: "$ZodArray",
    target_file_path: "packages/zod/src/v4/core/schemas.ts",
    predecessor_name: "$ZodArray",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_ts_zod_09",
    case_id: "ts_zod_09",
    repository: "zod",
    language: "typescript",
    evolution_type: "hard_negative",
    query: "Validate payment card numbers using the Luhn checksum algorithm",
    has_answer: true,
    target_symbol_name: "creditCard",
    target_file_path: "packages/zod/src/v4/classic/schemas.ts",
    predecessor_name: null, // iban is hard negative sibling, not predecessor
    expected_evolution: "hard_negative"
  },
  {
    query_id: "q_ts_zod_10",
    case_id: "ts_zod_10",
    repository: "zod",
    language: "typescript",
    evolution_type: "hard_negative",
    query: "Where is the legacy uuidv4 string schema helper defined in Zod v4?",
    has_answer: false, // uuidv4 replaced/reorganized; no specific isolated symbol
    target_symbol_name: null,
    target_file_path: null,
    predecessor_name: null,
    expected_evolution: "hard_negative"
  },

  // ----------------------------------------------------
  // JAVA: Gson (10 queries)
  // ----------------------------------------------------
  {
    query_id: "q_java_gsn_01",
    case_id: "java_gsn_01",
    repository: "gson",
    language: "java",
    evolution_type: "new_symbol",
    query: "Filter elements from non-null list wrapper without O(n^2) quadratic removal overhead",
    has_answer: true,
    target_symbol_name: "removeIf",
    target_file_path: "gson/src/main/java/com/google/gson/internal/NonNullElementWrapperList.java",
    predecessor_name: null,
    expected_evolution: "new_symbol"
  },
  {
    query_id: "q_java_gsn_02",
    case_id: "java_gsn_02",
    repository: "gson",
    language: "java",
    evolution_type: "rewrite",
    query: "Determine whether a class field should be excluded from serialization using modifier rules",
    has_answer: true,
    target_symbol_name: "excludeField",
    target_file_path: "gson/src/main/java/com/google/gson/internal/Excluder.java",
    predecessor_name: "excludeField",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_java_gsn_03",
    case_id: "java_gsn_03",
    repository: "gson",
    language: "java",
    evolution_type: "new_symbol",
    query: "Check if field reflection modifiers include transient or static flags",
    has_answer: true,
    target_symbol_name: "isExcludedByModifier",
    target_file_path: "gson/src/main/java/com/google/gson/internal/Excluder.java",
    predecessor_name: null,
    expected_evolution: "new_symbol"
  },
  {
    query_id: "q_java_gsn_04",
    case_id: "java_gsn_04",
    repository: "gson",
    language: "java",
    evolution_type: "new_symbol",
    query: "Read current character position offset in stream reader during large document parsing",
    has_answer: true,
    target_symbol_name: "getCharacterOffset",
    target_file_path: "gson/src/main/java/com/google/gson/stream/JsonReader.java",
    predecessor_name: null,
    expected_evolution: "new_symbol"
  },
  {
    query_id: "q_java_gsn_05",
    case_id: "java_gsn_05",
    repository: "gson",
    language: "java",
    evolution_type: "rewrite",
    query: "Compute hash code for JsonPrimitive adhering to equals contract across numeric types",
    has_answer: true,
    target_symbol_name: "hashCode",
    target_file_path: "gson/src/main/java/com/google/gson/JsonPrimitive.java",
    predecessor_name: "hashCode",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_java_gsn_06",
    case_id: "java_gsn_06",
    repository: "gson",
    language: "java",
    evolution_type: "new_symbol",
    query: "Compare LazilyParsedNumber instances for ordering in sorted tree structures",
    has_answer: true,
    target_symbol_name: "compareTo",
    target_file_path: "gson/src/main/java/com/google/gson/internal/LazilyParsedNumber.java",
    predecessor_name: null,
    expected_evolution: "new_symbol"
  },
  {
    query_id: "q_java_gsn_07",
    case_id: "java_gsn_07",
    repository: "gson",
    language: "java",
    evolution_type: "move",
    query: "Validate floating point numbers against NaN and infinite values in type adapters",
    has_answer: true,
    target_symbol_name: "checkValidFloatingPoint",
    target_file_path: "gson/src/main/java/com/google/gson/internal/bind/TypeAdapters.java",
    predecessor_name: "checkValidFloatingPoint",
    expected_evolution: "move"
  },
  {
    query_id: "q_java_gsn_08",
    case_id: "java_gsn_08",
    repository: "gson",
    language: "java",
    evolution_type: "rewrite",
    query: "Adjust JSON path stack when promoting object member name to value token in reader",
    has_answer: true,
    target_symbol_name: "promoteNameToValue",
    target_file_path: "gson/src/main/java/com/google/gson/stream/JsonReader.java",
    predecessor_name: "promoteNameToValue",
    expected_evolution: "rewrite"
  },
  {
    query_id: "q_java_gsn_09",
    case_id: "java_gsn_09",
    repository: "gson",
    language: "java",
    evolution_type: "hard_negative",
    query: "Check boolean condition argument assertion in preconditions utility",
    has_answer: true,
    target_symbol_name: "checkArgument",
    target_file_path: "gson/src/main/java/com/google/gson/internal/GsonPreconditions.java",
    predecessor_name: null, // checkNotNull was removed; is not predecessor of checkArgument
    expected_evolution: "hard_negative"
  },
  {
    query_id: "q_java_gsn_10",
    case_id: "java_gsn_10",
    repository: "gson",
    language: "java",
    evolution_type: "hard_negative",
    query: "Deserialize json tree elements back into Java object instances using fromJsonTree",
    has_answer: false, // fromJsonTree does not exist in Gson
    target_symbol_name: null,
    target_file_path: null,
    predecessor_name: null,
    expected_evolution: "hard_negative"
  }
];

const outPath = path.resolve(__dirname, '../data/evaluation_lineage_queries.json');
fs.writeFileSync(outPath, JSON.stringify(queries, null, 2), 'utf8');
console.log(`Successfully generated ${queries.length} evaluation queries: ${outPath}`);
