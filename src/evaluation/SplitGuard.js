/**
 * SplitGuard.js - Enforces benchmark split discipline and prevents accidental evaluation of sealed test cases.
 */

class SplitGuardViolationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SplitGuardViolationError';
    this.details = details;
  }
}

class SplitGuard {
  static ALLOWED_DIAGNOSTIC_SPLITS = ['dev', 'val'];
  static SEALED_TEST_SPLIT = 'test_confirmatory';

  /**
   * Validates an individual benchmark case against active split permissions.
   * @param {object} benchmarkCase The benchmark case to check.
   * @param {object} options Evaluation options.
   * @param {boolean} [options.allowSealedTest=false] Explicit override allowing sealed test execution.
   * @returns {boolean} True if allowed.
   * @throws {SplitGuardViolationError} If a sealed test case is encountered without explicit authorization.
   */
  static validateCase(benchmarkCase, options = {}) {
    if (!benchmarkCase) {
      throw new SplitGuardViolationError('Benchmark case is null or undefined.');
    }

    const split = (benchmarkCase.split || 'dev').toLowerCase();
    const allowSealedTest = options.allowSealedTest === true;

    if (split === SplitGuard.SEALED_TEST_SPLIT) {
      if (!allowSealedTest) {
        throw new SplitGuardViolationError(
          `[SPLIT GUARD VIOLATION] Attempted to evaluate sealed case '${benchmarkCase.case_id || 'unknown'}' in '${SplitGuard.SEALED_TEST_SPLIT}' split. ` +
          `Diagnostic runs are strictly restricted to 'dev' and 'val' splits. Sealed test evaluation requires explicit confirmation flag '--allow-sealed-test'.`,
          {
            case_id: benchmarkCase.case_id,
            split: benchmarkCase.split,
            repo: benchmarkCase.repo
          }
        );
      }
    }

    return true;
  }

  /**
   * Filters an array of cases, enforcing split boundaries.
   * @param {Array<object>} cases Array of benchmark cases.
   * @param {object} options
   * @param {string} [options.targetSplit] Specific split to retain ('dev' or 'val').
   * @param {boolean} [options.allowSealedTest=false] Explicit override allowing sealed test.
   * @returns {Array<object>} Filtered valid cases.
   */
  static filterAndGuard(cases, options = {}) {
    if (!Array.isArray(cases)) {
      throw new SplitGuardViolationError('Cases input must be an array.');
    }

    const targetSplit = options.targetSplit ? options.targetSplit.toLowerCase() : null;
    const validated = [];

    for (const c of cases) {
      // Enforce sealed test guard
      SplitGuard.validateCase(c, options);

      // Apply target split filter if specified
      if (targetSplit) {
        const caseSplit = (c.split || 'dev').toLowerCase();
        if (caseSplit === targetSplit) {
          validated.push(c);
        }
      } else {
        validated.push(c);
      }
    }

    return validated;
  }

  /**
   * Partitions an array of cases into allowed cases and rejected sealed cases without throwing.
   * @param {Array<object>} cases
   * @param {object} options
   * @returns {{ allowed: Array<object>, rejected: Array<object> }}
   */
  static filterAllowedCases(cases, options = {}) {
    if (!Array.isArray(cases)) {
      return { allowed: [], rejected: [] };
    }

    const allowSealedTest = options.allowSealedTest === true;
    const allowed = [];
    const rejected = [];

    for (const c of cases) {
      const split = (c.split || 'dev').toLowerCase();
      if (split === SplitGuard.SEALED_TEST_SPLIT && !allowSealedTest) {
        rejected.push(c);
      } else {
        allowed.push(c);
      }
    }

    return { allowed, rejected };
  }
}

module.exports = {
  SplitGuard,
  SplitGuardViolationError
};

