/**
 * Minimal argument parser (no dependencies).
 * Supports positionals, --flag, --key value, --key=value. Booleans are declared per command.
 */
function parseArgs(argv, { booleans = [], strings = [] } = {}) {
  const out = { _: [], flags: {} };
  const bools = new Set(booleans);
  const strs = new Set(strings);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (bools.has(key)) { out.flags[key] = eq > 0 ? a.slice(eq + 1) !== 'false' : true; continue; }
      if (!strs.has(key)) throw new UsageError(`Unknown option --${key}`);
      const val = eq > 0 ? a.slice(eq + 1) : argv[++i];
      if (val === undefined) throw new UsageError(`Option --${key} needs a value`);
      out.flags[key] = val;
    } else if (a === '-h') {
      out.flags.help = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Parse a positive integer option, or throw a UsageError naming the option. */
function positiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new UsageError(`--${name} must be a positive integer (got '${value}')`);
  return n;
}

module.exports = { parseArgs, UsageError, positiveInt };
