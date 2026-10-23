const fs = require('fs');
const os = require('os');
const path = require('path');
const { UsageError } = require('./args');

/**
 * Configuration.
 *  - Project keys (history, k, tokenBudget) live in <repo>/.retrospect/config.json.
 *  - Global keys (provider, model, baseUrl) live in ~/.retrospect/config.json.
 * API keys are never stored: they are read from environment variables only.
 */
const PROJECT_DEFAULTS = { history: 400, k: 5, tokenBudget: 4000 };
const PROJECT_KEYS = { history: 'int', k: 'int', tokenBudget: 'int' };
const GLOBAL_KEYS = { provider: ['anthropic', 'openai-compatible'], model: 'string', baseUrl: 'url' };
const SECRET_LIKE = /(api[-_]?key|secret|token$|password)/i;

// Home directory from the process environment first (USERPROFILE on Windows, HOME elsewhere), then os.homedir().
// Reading process.env lets a caller (or a test) point the global config at a different home.
function homeDir() {
  const env = process.env;
  const first = process.platform === 'win32' ? [env.USERPROFILE, env.HOME] : [env.HOME, env.USERPROFILE];
  return first.find(Boolean) || os.homedir();
}

function globalDir() {
  return path.join(homeDir(), '.retrospect');
}

function globalConfigPath() {
  return path.join(globalDir(), 'config.json');
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function projectConfigPath(retroDir) {
  return path.join(retroDir, 'config.json');
}

function readProjectConfig(retroDir) {
  return { ...PROJECT_DEFAULTS, ...readJson(projectConfigPath(retroDir), {}) };
}

function readGlobalConfig() {
  return readJson(globalConfigPath(), {});
}

function coerce(key, raw, schema) {
  const type = schema[key];
  if (type === 'int') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw new UsageError(`'${key}' must be a positive integer (got '${raw}')`);
    return n;
  }
  if (Array.isArray(type)) {
    if (!type.includes(raw)) throw new UsageError(`'${key}' must be one of: ${type.join(', ')} (got '${raw}')`);
    return raw;
  }
  if (type === 'url') {
    try { new URL(raw); } catch { throw new UsageError(`'${key}' must be a URL (got '${raw}')`); }
    return raw.replace(/\/+$/, '');
  }
  if (!raw) throw new UsageError(`'${key}' must not be empty`);
  return raw;
}

function checkKey(key, isGlobal) {
  if (SECRET_LIKE.test(key)) {
    throw new UsageError(`Refusing to store '${key}': API keys are read from environment variables only (ANTHROPIC_API_KEY, OPENAI_API_KEY)`);
  }
  const schema = isGlobal ? GLOBAL_KEYS : PROJECT_KEYS;
  if (!(key in schema)) {
    const other = isGlobal ? PROJECT_KEYS : GLOBAL_KEYS;
    const hint = key in other ? ` ('${key}' is a ${isGlobal ? 'project' : 'global'} key${isGlobal ? '; drop --global' : '; use --global'})` : '';
    throw new UsageError(`Unknown ${isGlobal ? 'global' : 'project'} config key '${key}'${hint}. Valid: ${Object.keys(schema).join(', ')}`);
  }
  return schema;
}

function getValue(key, { isGlobal, retroDir }) {
  checkKey(key, isGlobal);
  const cfg = isGlobal ? readGlobalConfig() : readProjectConfig(retroDir);
  return cfg[key];
}

function setValue(key, raw, { isGlobal, retroDir }) {
  const schema = checkKey(key, isGlobal);
  const value = coerce(key, raw, schema);
  if (isGlobal) {
    const cfg = readGlobalConfig();
    cfg[key] = value;
    writeJson(globalConfigPath(), cfg);
  } else {
    const cfg = readProjectConfig(retroDir);
    cfg[key] = value;
    writeJson(projectConfigPath(retroDir), cfg);
  }
  return value;
}

module.exports = {
  PROJECT_DEFAULTS, PROJECT_KEYS, GLOBAL_KEYS,
  globalConfigPath, projectConfigPath, readProjectConfig, readGlobalConfig, writeJson, readJson,
  getValue, setValue
};
