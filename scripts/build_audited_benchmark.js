const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function runGit(repoPath, args) {
  return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true });
}

function resolveCommit(repoPath, ref) {
  if (!ref) return null;
  return runGit(repoPath, ['rev-parse', ref]).trim();
}

function getCommitMessage(repoPath, hash) {
  if (!hash) return '';
  return runGit(repoPath, ['log', '-1', '--format=%s%n%b', hash]).trim();
}

const rawAuditedCases = [
  // ==========================================
  // PYTHON: Bottle (10 cases)
  // ==========================================
  {
    case_id: "py_bot_01",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "rewrite",
    current_symbol: {
      name: "get_undecorated_callback",
      qualifiedName: "Route.get_undecorated_callback",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "750fcbe",
      signature: "get_undecorated_callback(self)"
    },
    predecessor_symbol: {
      name: "get_undecorated_callback",
      qualifiedName: "Route.get_undecorated_callback",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "750fcbe^",
      signature: "get_undecorated_callback(self)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected target symbol from makelist to Route.get_undecorated_callback. Replaced deprecated getargspec inspection with modern inspect.signature API (12 diff lines).",
    evidence: {
      rationale: "Route callback inspection logic rewritten to inspect.signature API, removing dependency on deprecated getargspec."
    }
  },
  {
    case_id: "py_bot_02",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "build",
      qualifiedName: "Router.build",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "b5631d1",
      signature: "build(self, _name, *anon, **query)"
    },
    predecessor_symbol: {
      name: "build",
      qualifiedName: "Router.build",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "b5631d1^",
      signature: "build(self, _name, *anon, **query)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected target symbol from FormsDict.getall to Router.build. Evolution reclassified from signature_change to routine_modification (added doseq=True to urlencode, 2 diff lines).",
    evidence: {
      rationale: "Router.build updated to support repeated query parameters by passing doseq=True to urlencode."
    }
  },
  {
    case_id: "py_bot_03",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "static_file",
      qualifiedName: "static_file",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "457a8fa",
      signature: "static_file(filename, root, mimetype=True, download=False, charset='UTF-8', etag=None, headers=None)"
    },
    predecessor_symbol: {
      name: "static_file",
      qualifiedName: "static_file",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "457a8fa^",
      signature: "static_file(filename, root, mimetype=True, download=False, charset='UTF-8', etag=None, headers=None)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to routine_modification. Bugfix on ETag quotation and matching (9 diff lines).",
    evidence: {
      rationale: "ETag handling in static_file fixed to ensure quotes are preserved and matched against If-None-Match headers."
    }
  },
  {
    case_id: "py_bot_04",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "__repr__",
      qualifiedName: "ServerAdapter.__repr__",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "1d5b441",
      signature: "__repr__(self)"
    },
    predecessor_symbol: {
      name: "__repr__",
      qualifiedName: "ServerAdapter.__repr__",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "1d5b441^",
      signature: "__repr__(self)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to routine_modification (3 lines changed formatting options dict via %r).",
    evidence: {
      rationale: "Representation string format simplified to %r string interpolation."
    }
  },
  {
    case_id: "py_bot_05",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "rewrite",
    current_symbol: {
      name: "touni",
      qualifiedName: "touni",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "8804dd9",
      signature: "touni(s, enc='utf8', err='strict')"
    },
    predecessor_symbol: {
      name: "touni",
      qualifiedName: "touni",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "8804dd9^",
      signature: "touni(s, enc='utf8', err='strict')"
    },
    is_valid_predecessor: true,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Substantial rewrite updating bytearray and unicode handling for modern Python 3 str coercion (6 diff lines).",
    evidence: {
      rationale: "Unicode conversion function rewritten to support bytearrays and drop Python 2 unicode constructor."
    }
  },
  {
    case_id: "py_bot_06",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "signature_change",
    current_symbol: {
      name: "_define",
      qualifiedName: "ConfigDict._define",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "ba4efd1",
      signature: "_define(self, key, default=_UNSET, help=_UNSET, filter=_UNSET)"
    },
    predecessor_symbol: {
      name: "_define",
      qualifiedName: "ConfigDict._define",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "ba4efd1^",
      signature: "_define(self, key, default=_UNSET, help=_UNSET, validate=_UNSET)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected hallucinated symbol names meta_filter/meta_validate to ConfigDict._define. Evolution is signature_change (parameter validate renamed to filter).",
    evidence: {
      rationale: "ConfigDict._define method signature changed: parameter 'validate' renamed to 'filter'."
    }
  },
  {
    case_id: "py_bot_07",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "depr",
      qualifiedName: "depr",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "7a7e544",
      signature: "depr(major, minor, cause, fix, stacklevel=3)"
    },
    predecessor_symbol: {
      name: "depr",
      qualifiedName: "depr",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "7a7e544^",
      signature: "depr(major, minor, cause, fix, stacklevel=3)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to routine_modification (single line added returning DeprecationWarning instance).",
    evidence: {
      rationale: "Deprecation warning helper updated to return warning object for test assertions."
    }
  },
  {
    case_id: "py_bot_08",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "rewrite",
    current_symbol: {
      name: "headerlist",
      qualifiedName: "BaseResponse.headerlist",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "775fd57",
      signature: "headerlist(self)"
    },
    predecessor_symbol: {
      name: "headerlist",
      qualifiedName: "BaseResponse.headerlist",
      filePath: "bottle.py",
      symbolType: "method",
      commitRef: "775fd57^",
      signature: "headerlist(self)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Replaced ungrounded json_dump_func with verified rewrite of BaseResponse.headerlist (19 diff lines optimizing thread-local access and list construction).",
    evidence: {
      rationale: "BaseResponse.headerlist performance overhaul avoiding redundant thread-local lookups and list re-encodings."
    }
  },
  {
    case_id: "py_bot_09",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "hard_negative",
    current_symbol: {
      name: "tob",
      qualifiedName: "tob",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "4a18349",
      signature: "tob(s, enc='utf8')"
    },
    predecessor_symbol: {
      name: "tonat",
      qualifiedName: "tonat",
      filePath: "bottle.py",
      symbolType: "function",
      commitRef: "726da54",
      signature: "tonat = touni"
    },
    is_valid_predecessor: false,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified hard negative. tob is byte encoding helper, while tonat was native string alias; tonat was deleted and is not predecessor of tob.",
    evidence: {
      rationale: "tonat is an obsolete string alias; tob is an independent byte encoder."
    }
  },
  {
    case_id: "py_bot_10",
    language: "python",
    repository: "bottle",
    repo_path: "data/external_repos/bottle",
    evolution_type: "hard_negative",
    current_symbol: {
      name: "Route",
      qualifiedName: "Route",
      filePath: "bottle.py",
      symbolType: "class",
      commitRef: "a014a6c",
      signature: "class Route(object)"
    },
    predecessor_symbol: {
      name: "RouteReset",
      qualifiedName: "RouteReset",
      filePath: "bottle.py",
      symbolType: "class",
      commitRef: "686e362",
      signature: "class RouteReset(BottleException)"
    },
    is_valid_predecessor: false,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified hard negative. RouteReset was an exception class removed when plugin reset mechanism was refactored; it is not a predecessor of Route.",
    evidence: {
      rationale: "Route is core route class; RouteReset is a removed control-flow exception."
    }
  },

  // ==========================================
  // JAVASCRIPT: Express (10 cases)
  // ==========================================
  {
    case_id: "js_exp_01",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "rewrite",
    current_symbol: {
      name: "send",
      qualifiedName: "res.send",
      filePath: "lib/response.js",
      symbolType: "method",
      commitRef: "9a34acf",
      signature: "res.send = function send(body)"
    },
    predecessor_symbol: {
      name: "send",
      qualifiedName: "res.send",
      filePath: "lib/response.js",
      symbolType: "method",
      commitRef: "9a34acf^",
      signature: "res.send = function send(body)"
    },
    is_valid_predecessor: true,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified rewrite of header conflict handling and ETag calculation in res.send (10 diff lines).",
    evidence: {
      rationale: "res.send modified to preserve ETag generation while respecting Transfer-Encoding header constraints."
    }
  },
  {
    case_id: "js_exp_02",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "render",
      qualifiedName: "app.render",
      filePath: "lib/application.js",
      symbolType: "method",
      commitRef: "c9ecf7b",
      signature: "app.render = function render(name, options, callback)"
    },
    predecessor_symbol: {
      name: "render",
      qualifiedName: "app.render",
      filePath: "lib/application.js",
      symbolType: "method",
      commitRef: "c9ecf7b^",
      signature: "app.render = function render(name, options, callback)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from signature_change to routine_modification (callable interface unchanged; internal defensive default opts = options || {} added, 2 diff lines).",
    evidence: {
      rationale: "Defensive default added for options argument in app.render."
    }
  },
  {
    case_id: "js_exp_03",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "listen",
      qualifiedName: "app.listen",
      filePath: "lib/application.js",
      symbolType: "method",
      commitRef: "54af593",
      signature: "app.listen = function listen()"
    },
    predecessor_symbol: {
      name: "listen",
      qualifiedName: "app.listen",
      filePath: "lib/application.js",
      symbolType: "method",
      commitRef: "54af593^",
      signature: "app.listen = function listen()"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to routine_modification (cached slice.call helper used, 2 diff lines).",
    evidence: {
      rationale: "Cached slice reference used in app.listen argument unpacking."
    }
  },
  {
    case_id: "js_exp_04",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "signature_change",
    current_symbol: {
      name: "acceptsLanguages",
      qualifiedName: "req.acceptsLanguages",
      filePath: "lib/request.js",
      symbolType: "method",
      commitRef: "3dc9699",
      signature: "req.acceptsLanguages = function(...languages)"
    },
    predecessor_symbol: {
      name: "acceptsLanguages",
      qualifiedName: "req.acceptsLanguages",
      filePath: "lib/request.js",
      symbolType: "method",
      commitRef: "3dc9699^",
      signature: "req.acceptsLanguages = function()"
    },
    predecessor_symbol: {
      name: "acceptsLanguages",
      qualifiedName: "req.acceptsLanguages",
      filePath: "lib/request.js",
      symbolType: "method",
      commitRef: "3dc9699^",
      signature: "req.acceptsLanguages = function()"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to signature_change (function signature refactored to rest parameter ...languages, 5 diff lines).",
    evidence: {
      rationale: "req.acceptsLanguages modernized to ES6 rest parameter syntax."
    }
  },
  {
    case_id: "js_exp_05",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "redirect",
      qualifiedName: "res.redirect",
      filePath: "lib/response.js",
      symbolType: "method",
      commitRef: "9a3f7ff",
      signature: "res.redirect = function redirect(url)"
    },
    predecessor_symbol: {
      name: "redirect",
      qualifiedName: "res.redirect",
      filePath: "lib/response.js",
      symbolType: "method",
      commitRef: "9a3f7ff^",
      signature: "res.redirect = function redirect(url)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to routine_modification (HTML doctype boilerplate polish, 3 diff lines).",
    evidence: {
      rationale: "HTML template body polished in redirect response."
    }
  },
  {
    case_id: "js_exp_06",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "logerror",
      qualifiedName: "logerror",
      filePath: "lib/application.js",
      symbolType: "function",
      commitRef: "90ec620",
      signature: "function logerror(err)"
    },
    predecessor_symbol: {
      name: "logerror",
      qualifiedName: "logerror",
      filePath: "lib/application.js",
      symbolType: "function",
      commitRef: "90ec620^",
      signature: "function logerror(err)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to routine_modification (console.error(err) logging full error, 2 diff lines).",
    evidence: {
      rationale: "Error logger updated to pass entire error object directly to console.error."
    }
  },
  {
    case_id: "js_exp_07",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "protocol",
      qualifiedName: "req.protocol",
      filePath: "lib/request.js",
      symbolType: "getter",
      commitRef: "89f198c",
      signature: "defineGetter(req, 'protocol', function protocol())"
    },
    predecessor_symbol: {
      name: "protocol",
      qualifiedName: "req.protocol",
      filePath: "lib/request.js",
      symbolType: "getter",
      commitRef: "89f198c^",
      signature: "defineGetter(req, 'protocol', function protocol())"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected symbol name from internal property 'connection' to getter 'protocol'. Routine modification replacing deprecated req.connection with req.socket (4 diff lines).",
    evidence: {
      rationale: "Protocol getter migrated from deprecated connection.encrypted to socket.encrypted."
    }
  },
  {
    case_id: "js_exp_08",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "routine_modification",
    current_symbol: {
      name: "fresh",
      qualifiedName: "req.fresh",
      filePath: "lib/request.js",
      symbolType: "getter",
      commitRef: "ae6dd37",
      signature: "defineGetter(req, 'fresh', function())"
    },
    predecessor_symbol: {
      name: "fresh",
      qualifiedName: "req.fresh",
      filePath: "lib/request.js",
      symbolType: "getter",
      commitRef: "ae6dd37^",
      signature: "defineGetter(req, 'fresh', function())"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Evolution reclassified from rewrite to routine_modification (added QUERY HTTP method check, 4 diff lines).",
    evidence: {
      rationale: "Weak freshness check updated to allow conditional revalidation on QUERY requests."
    }
  },
  {
    case_id: "js_exp_09",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "hard_negative",
    current_symbol: {
      name: "location",
      qualifiedName: "res.location",
      filePath: "lib/response.js",
      symbolType: "method",
      commitRef: "91d333b",
      signature: "res.location = function location(url)"
    },
    predecessor_symbol: {
      name: "redirect",
      qualifiedName: "res.redirect",
      filePath: "lib/response.js",
      symbolType: "method",
      commitRef: "28f732e",
      signature: "res.redirect = function redirect(url)"
    },
    is_valid_predecessor: false,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified hard negative. res.location sets header without sending response; res.redirect performs full HTTP redirect.",
    evidence: {
      rationale: "location is header setter; redirect is response handler."
    }
  },
  {
    case_id: "js_exp_10",
    language: "javascript",
    repository: "express",
    repo_path: "data/external_repos/express",
    evolution_type: "signature_change",
    current_symbol: {
      name: "acceptsCharsets",
      qualifiedName: "req.acceptsCharsets",
      filePath: "lib/request.js",
      symbolType: "method",
      commitRef: "6cd404e",
      signature: "req.acceptsCharsets = function(...charsets)"
    },
    predecessor_symbol: {
      name: "acceptsCharsets",
      qualifiedName: "req.acceptsCharsets",
      filePath: "lib/request.js",
      symbolType: "method",
      commitRef: "6cd404e^",
      signature: "req.acceptsCharsets = function()"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Replaced non-existent lib/middleware/init.js at release tag with verified signature_change in req.acceptsCharsets (rest parameter and enhanced charset matching, 17 diff lines).",
    evidence: {
      rationale: "req.acceptsCharsets signature modernized to rest parameters and extended to handle comma-separated charset strings."
    }
  },

  // ==========================================
  // TYPESCRIPT: Zod (10 cases)
  // ==========================================
  {
    case_id: "ts_zod_01",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "rename",
    current_symbol: {
      name: "processSchema",
      qualifiedName: "processSchema",
      filePath: "packages/zod/src/v4/core/to-json-schema.ts",
      symbolType: "function",
      commitRef: "18e71c7",
      signature: "export function processSchema(schema: core.$ZodType, ctx: JSONSchemaGeneratorContext)"
    },
    predecessor_symbol: {
      name: "process",
      qualifiedName: "process",
      filePath: "packages/zod/src/v4/core/to-json-schema.ts",
      symbolType: "function",
      commitRef: "18e71c7^",
      signature: "export function process(schema: core.$ZodType, ctx: JSONSchemaGeneratorContext)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected file path from packages/zod/src/v4/classic/from-json-schema.ts to packages/zod/src/v4/core/to-json-schema.ts. Genuine rename of top-level helper process -> processSchema to prevent bundler polyfill collisions (14 diff lines).",
    evidence: {
      rationale: "Helper process renamed to processSchema so browser polyfills for Node process global do not collide."
    }
  },
  {
    case_id: "ts_zod_02",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "rename",
    current_symbol: {
      name: "cached",
      qualifiedName: "cached",
      filePath: "packages/zod/src/v4/core/util.ts",
      symbolType: "function",
      commitRef: "51caf01",
      signature: "export function cached<T>(fn: () => T): { readonly value: T }"
    },
    predecessor_symbol: {
      name: "cachedInternal",
      qualifiedName: "cachedInternal",
      filePath: "packages/zod/src/v4/core/util.ts",
      symbolType: "function",
      commitRef: "51caf01^",
      signature: "function cachedInternal<T>(fn: () => T): { readonly value: T }"
    },
    is_valid_predecessor: true,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified rename / consolidation: cachedInternal merged back into cached (15 diff lines).",
    evidence: {
      rationale: "Collapsed internal caching helper cachedInternal back into cached."
    }
  },
  {
    case_id: "ts_zod_03",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "rewrite",
    current_symbol: {
      name: "email",
      qualifiedName: "email",
      filePath: "packages/zod/src/v4/core/regexes.ts",
      symbolType: "constant",
      commitRef: "f7fd554",
      signature: "export const email: RegExp"
    },
    predecessor_symbol: {
      name: "email",
      qualifiedName: "email",
      filePath: "packages/zod/src/v4/core/regexes.ts",
      symbolType: "constant",
      commitRef: "f7fd554^",
      signature: "export const email: RegExp"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected file path from packages/zod/src/v4/classic/schemas.ts to packages/zod/src/v4/core/regexes.ts. Substantial rewrite of regex pattern dropping lookaheads for performance (2 diff lines).",
    evidence: {
      rationale: "Email regex pattern rewritten to remove redundant lookaheads."
    }
  },
  {
    case_id: "ts_zod_04",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "new_symbol",
    current_symbol: {
      name: "currencyCode",
      qualifiedName: "currencyCode",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "function",
      commitRef: "d6bc1e3",
      signature: "export const currencyCode: (params?: string | core.ErrorMessage<string>) => ZodString"
    },
    predecessor_symbol: {
      name: null,
      qualifiedName: null,
      filePath: null,
      symbolType: null,
      commitRef: null,
      signature: null
    },
    is_valid_predecessor: false,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified new symbol: z.currencyCode added over vendored ISO 4217 list.",
    evidence: {
      rationale: "currencyCode string format validator newly introduced in Zod."
    }
  },
  {
    case_id: "ts_zod_05",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "signature_change",
    current_symbol: {
      name: "properties",
      qualifiedName: "properties",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "method",
      commitRef: "56222cd",
      signature: "properties<T extends object, S extends { [K in keyof T]?: core.$ZodType }>(shape: S)"
    },
    predecessor_symbol: {
      name: "properties",
      qualifiedName: "properties",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "method",
      commitRef: "56222cd^",
      signature: "properties(shape: $ZodShape)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected file path from packages/zod/src/v4/core/schemas.ts to packages/zod/src/v4/classic/schemas.ts. Signature changed: mapped type over keyof T replaces generic $ZodShape (3 diff lines).",
    evidence: {
      rationale: ".properties() shape signature updated to key off instance type."
    }
  },
  {
    case_id: "ts_zod_06",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "new_symbol",
    current_symbol: {
      name: "iban",
      qualifiedName: "iban",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "function",
      commitRef: "22bed61",
      signature: "export const iban: (params?: string | core.ErrorMessage<string>) => ZodString"
    },
    predecessor_symbol: {
      name: null,
      qualifiedName: null,
      filePath: null,
      symbolType: null,
      commitRef: null,
      signature: null
    },
    is_valid_predecessor: false,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Replaced invalid packaging script rename (meta.mjs) with verified new symbol: z.iban() validator added with ISO 7064 mod-97 checksum.",
    evidence: {
      rationale: "z.iban() string format newly added across Zod and Zod Mini."
    }
  },
  {
    case_id: "ts_zod_07",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "rewrite",
    current_symbol: {
      name: "validate",
      qualifiedName: "validate",
      filePath: "packages/zod/src/v4/core/schemas.ts",
      symbolType: "function",
      commitRef: "764ac59",
      signature: "validate(data: unknown, ctx?: ParseContext): boolean"
    },
    predecessor_symbol: {
      name: "validate",
      qualifiedName: "validate",
      filePath: "packages/zod/src/v4/core/schemas.ts",
      symbolType: "function",
      commitRef: "764ac59^",
      signature: "validate(data: unknown, ctx?: ParseContext): boolean"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected file path from packages/zod/src/v4/core/api.ts to packages/zod/src/v4/core/schemas.ts. Substantial rewrite giving validate an early exit on first failure (63 diff lines).",
    evidence: {
      rationale: "z.validate parse loop rewritten to settle immediately on first failure."
    }
  },
  {
    case_id: "ts_zod_08",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "rewrite",
    current_symbol: {
      name: "$ZodArray",
      qualifiedName: "$ZodArray",
      filePath: "packages/zod/src/v4/core/schemas.ts",
      symbolType: "function",
      commitRef: "e06a510",
      signature: "export const $ZodArray: core.$constructor<$ZodArray>"
    },
    predecessor_symbol: {
      name: "$ZodArray",
      qualifiedName: "$ZodArray",
      filePath: "packages/zod/src/v4/core/schemas.ts",
      symbolType: "function",
      commitRef: "e06a510^",
      signature: "export const $ZodArray: core.$constructor<$ZodArray>"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected file path from packages/zod/src/v4/classic/schemas.ts to packages/zod/src/v4/core/schemas.ts and symbol name from _array to $ZodArray. Substantial rewrite adding capSize guard to check container bounds upfront before element traversal (31 diff lines).",
    evidence: {
      rationale: "Array parsing path updated to check size bounds upfront before element traversal."
    }
  },
  {
    case_id: "ts_zod_09",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "hard_negative",
    current_symbol: {
      name: "iban",
      qualifiedName: "iban",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "function",
      commitRef: "22bed61",
      signature: "export const iban: (params?: string | core.ErrorMessage<string>) => ZodString"
    },
    predecessor_symbol: {
      name: "creditCard",
      qualifiedName: "creditCard",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "function",
      commitRef: "22bed61^",
      signature: "export const creditCard: (params?: string | core.ErrorMessage<string>) => ZodString"
    },
    is_valid_predecessor: false,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Replaced version-bump commit 3b970084 with genuine verified hard negative: iban vs creditCard in schemas.ts (both are financial string format validators, but creditCard is not predecessor of iban).",
    evidence: {
      rationale: "iban and creditCard are distinct payment format checks."
    }
  },
  {
    case_id: "ts_zod_10",
    language: "typescript",
    repository: "zod",
    repo_path: "data/external_repos/zod",
    evolution_type: "hard_negative",
    current_symbol: {
      name: "currencyCode",
      qualifiedName: "currencyCode",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "function",
      commitRef: "d6bc1e3",
      signature: "export const currencyCode: (params?: string | core.ErrorMessage<string>) => ZodString"
    },
    predecessor_symbol: {
      name: "string",
      qualifiedName: "string",
      filePath: "packages/zod/src/v4/classic/schemas.ts",
      symbolType: "function",
      commitRef: "d6bc1e3^",
      signature: "export const string: (params?: string | core.ErrorMessage<string>) => ZodString"
    },
    is_valid_predecessor: false,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Replaced release-workflow commit d821685e with verified hard negative: currencyCode vs string (generic string factory is not predecessor of specific currency code validator).",
    evidence: {
      rationale: "string is base factory; currencyCode is specific ISO standard format validator."
    }
  },

  // ==========================================
  // JAVA: Gson (10 cases)
  // ==========================================
  {
    case_id: "java_gsn_01",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "new_symbol",
    current_symbol: {
      name: "removeIf",
      qualifiedName: "NonNullElementWrapperList.removeIf",
      filePath: "gson/src/main/java/com/google/gson/internal/NonNullElementWrapperList.java",
      symbolType: "method",
      commitRef: "115bcc7",
      signature: "public boolean removeIf(Predicate<? super E> filter)"
    },
    predecessor_symbol: {
      name: null,
      qualifiedName: null,
      filePath: null,
      symbolType: null,
      commitRef: null,
      signature: null
    },
    is_valid_predecessor: false,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Reclassified from rewrite to new_symbol. removeIf did not exist in NonNullElementWrapperList prior to commit 115bcc7; it was newly added as an override method to avoid quadratic complexity.",
    evidence: {
      rationale: "removeIf method newly overridden in NonNullElementWrapperList to delegate bulk removal to ArrayList."
    }
  },
  {
    case_id: "java_gsn_02",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "rewrite",
    current_symbol: {
      name: "excludeField",
      qualifiedName: "Excluder.excludeField",
      filePath: "gson/src/main/java/com/google/gson/internal/Excluder.java",
      symbolType: "method",
      commitRef: "ff521d7",
      signature: "public boolean excludeField(Field field, boolean serialize)"
    },
    predecessor_symbol: {
      name: "excludeField",
      qualifiedName: "Excluder.excludeField",
      filePath: "gson/src/main/java/com/google/gson/internal/Excluder.java",
      symbolType: "method",
      commitRef: "ff521d7^",
      signature: "public boolean excludeField(Field field, boolean serialize)"
    },
    is_valid_predecessor: true,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Substantial rewrite decomposing monolithic excludeField into private helper methods (54 diff lines).",
    evidence: {
      rationale: "Complex monolithic excludeField method decomposed into focused private helper methods."
    }
  },
  {
    case_id: "java_gsn_03",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "new_symbol",
    current_symbol: {
      name: "isExcludedByModifier",
      qualifiedName: "Excluder.isExcludedByModifier",
      filePath: "gson/src/main/java/com/google/gson/internal/Excluder.java",
      symbolType: "method",
      commitRef: "ff521d7",
      signature: "private boolean isExcludedByModifier(int modifiers)"
    },
    predecessor_symbol: {
      name: null,
      qualifiedName: null,
      filePath: null,
      symbolType: null,
      commitRef: null,
      signature: null
    },
    is_valid_predecessor: false,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified new symbol: private helper extracted during Excluder refactor.",
    evidence: {
      rationale: "Newly extracted helper method; did not exist in parent commit."
    }
  },
  {
    case_id: "java_gsn_04",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "new_symbol",
    current_symbol: {
      name: "getCharacterOffset",
      qualifiedName: "JsonReader.getCharacterOffset",
      filePath: "gson/src/main/java/com/google/gson/stream/JsonReader.java",
      symbolType: "method",
      commitRef: "61f2c64",
      signature: "public long getCharacterOffset()"
    },
    predecessor_symbol: {
      name: null,
      qualifiedName: null,
      filePath: null,
      symbolType: null,
      commitRef: null,
      signature: null
    },
    is_valid_predecessor: false,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified new symbol: public API method added to JsonReader to track character position in stream.",
    evidence: {
      rationale: "Newly added API method on JsonReader to track character position in stream."
    }
  },
  {
    case_id: "java_gsn_05",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "rewrite",
    current_symbol: {
      name: "hashCode",
      qualifiedName: "JsonPrimitive.hashCode",
      filePath: "gson/src/main/java/com/google/gson/JsonPrimitive.java",
      symbolType: "method",
      commitRef: "5e277e4",
      signature: "public int hashCode()"
    },
    predecessor_symbol: {
      name: "hashCode",
      qualifiedName: "JsonPrimitive.hashCode",
      filePath: "gson/src/main/java/com/google/gson/JsonPrimitive.java",
      symbolType: "method",
      commitRef: "5e277e4^",
      signature: "public int hashCode()"
    },
    is_valid_predecessor: true,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Substantial rewrite: mathematical hash code logic overhauled to satisfy equals/hashCode contract across primitive types (39 diff lines).",
    evidence: {
      rationale: "Mathematical hash code logic rewritten to satisfy equals/hashCode contract across primitive types."
    }
  },
  {
    case_id: "java_gsn_06",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "new_symbol",
    current_symbol: {
      name: "compareTo",
      qualifiedName: "LazilyParsedNumber.compareTo",
      filePath: "gson/src/main/java/com/google/gson/internal/LazilyParsedNumber.java",
      symbolType: "method",
      commitRef: "4b46b6c",
      signature: "public int compareTo(LazilyParsedNumber other)"
    },
    predecessor_symbol: {
      name: null,
      qualifiedName: null,
      filePath: null,
      symbolType: null,
      commitRef: null,
      signature: null
    },
    is_valid_predecessor: false,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Verified new symbol: class implemented Comparable interface; compareTo added.",
    evidence: {
      rationale: "Class implemented Comparable interface; compareTo method added."
    }
  },
  {
    case_id: "java_gsn_07",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "move",
    current_symbol: {
      name: "checkValidFloatingPoint",
      qualifiedName: "TypeAdapters.checkValidFloatingPoint",
      filePath: "gson/src/main/java/com/google/gson/internal/bind/TypeAdapters.java",
      symbolType: "method",
      commitRef: "286843d",
      signature: "static void checkValidFloatingPoint(double value)"
    },
    predecessor_symbol: {
      name: "checkValidFloatingPoint",
      qualifiedName: "Gson.checkValidFloatingPoint",
      filePath: "gson/src/main/java/com/google/gson/Gson.java",
      symbolType: "method",
      commitRef: "286843d^",
      signature: "static void checkValidFloatingPoint(double value)"
    },
    is_valid_predecessor: true,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Replaced non-existent extras module path with genuine verified method move: checkValidFloatingPoint relocated from Gson.java to TypeAdapters.java in commit 286843d (168 diff lines).",
    evidence: {
      rationale: "Floating-point validation logic relocated from Gson to TypeAdapters during adapter modularization."
    }
  },
  {
    case_id: "java_gsn_08",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "rewrite",
    current_symbol: {
      name: "promoteNameToValue",
      qualifiedName: "JsonReader.promoteNameToValue",
      filePath: "gson/src/main/java/com/google/gson/stream/JsonReader.java",
      symbolType: "method",
      commitRef: "b3f4ca2",
      signature: "public void promoteNameToValue() throws IOException"
    },
    predecessor_symbol: {
      name: "promoteNameToValue",
      qualifiedName: "JsonReader.promoteNameToValue",
      filePath: "gson/src/main/java/com/google/gson/stream/JsonReader.java",
      symbolType: "method",
      commitRef: "b3f4ca2^",
      signature: "public void promoteNameToValue() throws IOException"
    },
    is_valid_predecessor: true,
    verification_status: "manually_verified",
    original_case_audit_verdict: "VERIFIED",
    audit_notes: "Substantial rewrite: JSON path tracking stack maintenance updated after name promotion (29 diff lines).",
    evidence: {
      rationale: "Internal JSON path stack maintenance updated after promoteNameToValue."
    }
  },
  {
    case_id: "java_gsn_09",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "hard_negative",
    current_symbol: {
      name: "checkArgument",
      qualifiedName: "GsonPreconditions.checkArgument",
      filePath: "gson/src/main/java/com/google/gson/internal/GsonPreconditions.java",
      symbolType: "method",
      commitRef: "164ac9d",
      signature: "public static void checkArgument(boolean condition)"
    },
    predecessor_symbol: {
      name: "checkNotNull",
      qualifiedName: "GsonPreconditions.checkNotNull",
      filePath: "gson/src/main/java/com/google/gson/internal/GsonPreconditions.java",
      symbolType: "method",
      commitRef: "164ac9d^",
      signature: "public static <T> T checkNotNull(T obj)"
    },
    is_valid_predecessor: false,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected file path from $Gson$Preconditions.java to GsonPreconditions.java. Sibling assertion methods; checkNotNull from parent revision was removed and is not predecessor of checkArgument.",
    evidence: {
      rationale: "checkArgument and checkNotNull are sibling assertion methods in Preconditions."
    }
  },
  {
    case_id: "java_gsn_10",
    language: "java",
    repository: "gson",
    repo_path: "data/external_repos/gson",
    evolution_type: "hard_negative",
    current_symbol: {
      name: "toJsonTree",
      qualifiedName: "Gson.toJsonTree",
      filePath: "gson/src/main/java/com/google/gson/Gson.java",
      symbolType: "method",
      commitRef: "8526dbd",
      signature: "public JsonElement toJsonTree(Object src)"
    },
    predecessor_symbol: {
      name: "fromJson",
      qualifiedName: "Gson.fromJson",
      filePath: "gson/src/main/java/com/google/gson/Gson.java",
      symbolType: "method",
      commitRef: "8526dbd^",
      signature: "public <T> T fromJson(JsonElement json, Class<T> classOfT)"
    },
    is_valid_predecessor: false,
    verification_status: "verified_with_corrections",
    original_case_audit_verdict: "CORRECTED",
    audit_notes: "Corrected predecessor name from non-existent fromJsonTree to real Gson.fromJson. Sibling conversion methods; neither is predecessor of the other.",
    evidence: {
      rationale: "Opposite complementary serialization vs deserialization methods in Gson."
    }
  }
];

function buildAuditedBenchmark() {
  const dataset = [];

  for (const c of rawAuditedCases) {
    const fullRepo = path.resolve(__dirname, '..', c.repo_path);
    const curHash = resolveCommit(fullRepo, c.current_symbol.commitRef);
    const predHash = resolveCommit(fullRepo, c.predecessor_symbol.commitRef);
    const commitMsg = getCommitMessage(fullRepo, curHash);

    const record = {
      case_id: c.case_id,
      language: c.language,
      repository: c.repository,
      repo_path: c.repo_path,
      evolution_type: c.evolution_type,
      current_symbol: {
        name: c.current_symbol.name,
        qualifiedName: c.current_symbol.qualifiedName,
        filePath: c.current_symbol.filePath,
        symbolType: c.current_symbol.symbolType,
        commitHash: curHash,
        signature: c.current_symbol.signature
      },
      predecessor_symbol: {
        name: c.predecessor_symbol.name,
        qualifiedName: c.predecessor_symbol.qualifiedName,
        filePath: c.predecessor_symbol.filePath,
        symbolType: c.predecessor_symbol.symbolType,
        commitHash: predHash,
        signature: c.predecessor_symbol.signature
      },
      is_valid_predecessor: c.is_valid_predecessor,
      verification_status: c.verification_status,
      original_case_audit_verdict: c.original_case_audit_verdict,
      audit_notes: c.audit_notes,
      evidence: {
        commit_hash: curHash,
        commit_message: commitMsg.split('\n')[0],
        rationale: c.evidence.rationale
      }
    };

    dataset.push(record);
  }

  const outPath = path.resolve(__dirname, '../data/benchmark_lineage_audited.json');
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`Audited benchmark successfully written to: ${outPath} (${dataset.length} cases)`);
}

buildAuditedBenchmark();
