/**
 * BenchmarkCaseLoader.js - Robust, benchmark-agnostic case loader and validator for the Git-first benchmark.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { SplitGuard } = require('./SplitGuard');

class BenchmarkCaseLoader {
  /**
   * @param {object} options
   * @param {string} [options.clonesDir='D:/clones'] Directory containing authentic git repository clones.
   * @param {boolean} [options.verifyGitTree=true] Whether to verify commit SHAs and target file existence in git.
   * @param {boolean} [options.allowSealedTest=false] Flag allowing loading of sealed test split cases.
   * @param {string} [options.targetSplit=null] Target split filter ('dev', 'val').
   */
  constructor(options = {}) {
    this.clonesDir = options.clonesDir || 'D:/clones';
    this.verifyGitTree = options.verifyGitTree !== false;
    this.allowSealedTest = options.allowSealedTest === true;
    this.targetSplit = options.targetSplit ? options.targetSplit.toLowerCase() : null;
  }

  /**
   * Resolves repository slug (e.g. 'google/guava') to local directory path.
   * @param {string} repoSlug
   * @returns {string|null} Local directory path if found, otherwise null.
   */
  resolveRepoPath(repoSlug) {
    if (!repoSlug) return null;
    const parts = repoSlug.split('/');
    const shortName = parts[parts.length - 1];

    // Try shortName, hyphenated slug, then full slug
    const directPath = path.join(this.clonesDir, shortName);
    if (fs.existsSync(directPath)) return directPath;

    const hyphenPath = path.join(this.clonesDir, repoSlug.replace(/\//g, '-'));
    if (fs.existsSync(hyphenPath)) return hyphenPath;

    const fullPath = path.join(this.clonesDir, repoSlug);
    if (fs.existsSync(fullPath)) return fullPath;

    return null;
  }

  /**
   * Normalizes a raw case object from either canonical or legacy schema.
   * @param {object} rawCase
   * @returns {object} Canonical case object.
   */
  normalizeCase(rawCase) {
    if (!rawCase || typeof rawCase !== 'object') {
      throw new Error('Case record must be a non-null object.');
    }

    // 1. Core identifiers
    const caseId = rawCase.case_id || rawCase.id || `CASE-${Math.random().toString(16).substring(2, 8).toUpperCase()}`;
    const repo = rawCase.repo || rawCase.repository_id || rawCase.repository;
    const pinSha = rawCase.pin_sha || rawCase.source_revision_sha || rawCase.commit;

    // 2. Query
    let queryText = '';
    if (typeof rawCase.query === 'string') {
      queryText = rawCase.query;
    } else if (rawCase.query && typeof rawCase.query === 'object') {
      queryText = rawCase.query.query_text || rawCase.query.text || '';
    }

    // 3. Target definition
    let target = null;
    if (rawCase.target && typeof rawCase.target === 'object') {
      target = {
        file_path: rawCase.target.file_path || rawCase.target.filePath,
        symbol_name: rawCase.target.symbol_name || rawCase.target.symbolName || rawCase.target.name,
        parameter_types: Array.isArray(rawCase.target.parameter_types) ? rawCase.target.parameter_types : [],
        line_span: Array.isArray(rawCase.target.line_span) ? rawCase.target.line_span : (rawCase.target.line_range || null)
      };
    } else if (Array.isArray(rawCase.target_symbols) && rawCase.target_symbols.length > 0) {
      const ts = rawCase.target_symbols[0];
      target = {
        file_path: ts.file_path || ts.filePath,
        symbol_name: ts.symbol_name || ts.name,
        parameter_types: Array.isArray(ts.parameter_types) ? ts.parameter_types : [],
        line_span: Array.isArray(ts.line_range) ? ts.line_range : (ts.line_span || null)
      };
    }

    // 4. Decoys / Hard negatives
    let decoys = [];
    const rawDecoys = rawCase.decoys || rawCase.hard_negatives || [];
    if (Array.isArray(rawDecoys)) {
      decoys = rawDecoys.map(d => ({
        file_path: d.file_path || d.filePath,
        symbol_name: d.symbol_name || d.name,
        distractor_type: d.distractor_type || d.negative_type || 'same_file_adjacent',
        distractor_rationale: d.distractor_rationale || d.rationale || 'Unspecified distractor rationale'
      }));
    }

    // 5. Evolutionary metadata
    const category = rawCase.category || 'historical_evolution';
    const language = rawCase.language || rawCase.target_language || 'Java';
    const originCommit = rawCase.origin_commit || (rawCase.historical_evidence && rawCase.historical_evidence.origin_commit_sha) || null;
    const commitDistance = typeof rawCase.commit_distance_origin_to_pin === 'number'
      ? rawCase.commit_distance_origin_to_pin
      : (typeof rawCase.commit_distance === 'number' ? rawCase.commit_distance : null);

    const containsHistId = typeof rawCase.contains_historical_identifier === 'boolean'
      ? rawCase.contains_historical_identifier
      : false;

    const split = (rawCase.split || 'dev').toLowerCase();

    return {
      case_id: caseId,
      repo,
      pin_sha: pinSha,
      query: queryText,
      target,
      decoys,
      category,
      language,
      origin_commit: originCommit,
      commit_distance_origin_to_pin: commitDistance,
      contains_historical_identifier: containsHistId,
      split,
      _raw: rawCase
    };
  }

  /**
   * Validates a canonical case against integrity and git constraints.
   * @param {object} c Normalized case.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateCase(c) {
    const errors = [];

    // Core schema validation
    if (!c.repo || typeof c.repo !== 'string') {
      errors.push("Missing or invalid 'repo' string.");
    }
    if (!c.pin_sha || !/^[0-9a-f]{40}$/i.test(c.pin_sha)) {
      errors.push(`Invalid 'pin_sha' (expected 40-character hex SHA, got '${c.pin_sha}').`);
    }
    if (!c.query || typeof c.query !== 'string' || c.query.trim().length < 5) {
      errors.push("Query must be a non-empty string of at least 5 characters.");
    }

    // Target validation
    if (!c.target || typeof c.target !== 'object') {
      errors.push("Missing 'target' specification object.");
    } else {
      if (!c.target.file_path || typeof c.target.file_path !== 'string') {
        errors.push("Target missing valid 'file_path'.");
      }
      if (!c.target.symbol_name || typeof c.target.symbol_name !== 'string') {
        errors.push("Target missing valid 'symbol_name'.");
      }
      if (!Array.isArray(c.target.line_span) || c.target.line_span.length !== 2 ||
          typeof c.target.line_span[0] !== 'number' || typeof c.target.line_span[1] !== 'number' ||
          c.target.line_span[0] > c.target.line_span[1] || c.target.line_span[0] < 1) {
        errors.push(`Target 'line_span' must be a 2-element array [start, end] with 1 <= start <= end (got ${JSON.stringify(c.target.line_span)}).`);
      }
    }

    // Decoys validation
    if (!Array.isArray(c.decoys) || c.decoys.length === 0) {
      errors.push("Case must define at least one valid distractor in 'decoys'.");
    } else {
      c.decoys.forEach((d, idx) => {
        if (!d.symbol_name || !d.file_path) {
          errors.push(`Decoy at index ${idx} missing 'symbol_name' or 'file_path'.`);
        }
      });
    }

    // Git verification if requested
    if (errors.length === 0 && this.verifyGitTree) {
      const repoPath = this.resolveRepoPath(c.repo);
      if (!repoPath) {
        errors.push(`Repository clone not found for repo '${c.repo}' in clones directory '${this.clonesDir}'.`);
      } else {
        // Verify pin_sha in git
        try {
          execFileSync('git', ['cat-file', '-e', c.pin_sha], { cwd: repoPath, stdio: 'pipe' });
        } catch (e) {
          errors.push(`Commit 'pin_sha' (${c.pin_sha}) does not exist in Git repository '${repoPath}'.`);
        }

        // Verify target file at pin_sha
        if (c.target && c.target.file_path) {
          try {
            execFileSync('git', ['cat-file', '-e', `${c.pin_sha}:${c.target.file_path}`], { cwd: repoPath, stdio: 'pipe' });
          } catch (e) {
            errors.push(`Target file '${c.target.file_path}' does not exist in repository at commit ${c.pin_sha.substring(0, 10)}.`);
          }
        }

        // Verify origin_commit if specified
        if (c.origin_commit) {
          if (!/^[0-9a-f]{40}$/i.test(c.origin_commit)) {
            errors.push(`Invalid 'origin_commit' hash format: '${c.origin_commit}'.`);
          } else {
            try {
              execFileSync('git', ['cat-file', '-e', c.origin_commit], { cwd: repoPath, stdio: 'pipe' });
            } catch (e) {
              errors.push(`Origin commit (${c.origin_commit}) does not exist in Git repository '${repoPath}'.`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Loads and validates benchmark cases from a file path or array.
   * @param {string|Array<object>} source File path or raw array of cases.
   * @returns {{ validCases: Array<object>, excludedCases: Array<object>, summary: object }}
   */
  load(source) {
    let rawItems = [];

    if (typeof source === 'string') {
      if (!fs.existsSync(source)) {
        throw new Error(`Benchmark source file not found: '${source}'`);
      }
      const content = fs.readFileSync(source, 'utf8');
      rawItems = JSON.parse(content);
    } else if (Array.isArray(source)) {
      rawItems = source;
    } else {
      throw new Error("Source must be a JSON file path or an array of objects.");
    }

    const validCases = [];
    const excludedCases = [];

    for (let idx = 0; idx < rawItems.length; idx++) {
      const raw = rawItems[idx];
      let normalized = null;

      try {
        normalized = this.normalizeCase(raw);
      } catch (err) {
        excludedCases.push({
          case_id: raw ? (raw.case_id || `ITEM-${idx}`) : `ITEM-${idx}`,
          index: idx,
          reason: `Normalization error: ${err.message}`,
          error_type: 'SCHEMA_NORMALIZATION_FAILURE',
          raw_case: raw
        });
        continue;
      }

      // Check SplitGuard
      try {
        SplitGuard.validateCase(normalized, { allowSealedTest: this.allowSealedTest });
      } catch (err) {
        excludedCases.push({
          case_id: normalized.case_id,
          index: idx,
          reason: err.message,
          error_type: 'SEALED_TEST_SPLIT_GUARD',
          raw_case: raw
        });
        continue;
      }

      // Apply target split filter
      if (this.targetSplit && normalized.split !== this.targetSplit) {
        excludedCases.push({
          case_id: normalized.case_id,
          index: idx,
          reason: `Case split '${normalized.split}' filtered out (target split is '${this.targetSplit}').`,
          error_type: 'SPLIT_FILTERED',
          raw_case: raw
        });
        continue;
      }

      // Validate integrity and git requirements
      const val = this.validateCase(normalized);
      if (!val.valid) {
        excludedCases.push({
          case_id: normalized.case_id,
          index: idx,
          reason: val.errors.join('; '),
          error_type: 'VALIDATION_FAILURE',
          raw_case: raw
        });
      } else {
        validCases.push(normalized);
      }
    }

    return {
      validCases,
      excludedCases,
      summary: {
        total_examined: rawItems.length,
        valid_count: validCases.length,
        excluded_count: excludedCases.length,
        clones_dir: this.clonesDir,
        git_verification_enabled: this.verifyGitTree,
        split_filter: this.targetSplit || 'all_unsealed'
      }
    };
  }
}

module.exports = BenchmarkCaseLoader;
