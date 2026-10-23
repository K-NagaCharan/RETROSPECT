const fs = require('fs');
const path = require('path');
const { parseArgs, UsageError, positiveInt } = require('./args');
const store = require('./store');
const config = require('./config');
const { rankG, formatResults, toJson } = require('./search');
const { buildPrompt, formatSources } = require('./prompt');
const llm = require('../llm');

const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')).version;

const HELP = {
  main: `rtro ${VERSION} — evolution-aware code search for git repositories

Usage: rtro <command> [options]        (alias: retrospect)

Commands:
  init      Index this repository (code + git history) into .retrospect/
  status    Show index freshness, history window, sizes and the active model
  search    Find current code for a question, including former names
  ask       Answer a question with an LLM, grounded in retrieved code and history
  config    Get or set configuration

Options:
  --help, -h     Show help (also: rtro <command> --help)
  --version      Print the version

Run "rtro init" inside a git repository first.`,
  init: `Usage: rtro init [--history <n>]

Index the current git repository into <repo>/.retrospect/ and add ".retrospect/" to .git/info/exclude
(tracked files are never edited).

Options:
  --history <n>   History window: number of most recent commits to analyse (default 400)`,
  status: `Usage: rtro status

Show whether the repository is initialised, the indexed HEAD vs the current HEAD (fresh/stale),
the history window, index sizes and the active provider/model.`,
  search: `Usage: rtro search "<question>" [--k <n>] [--json]

Rank code with Retrospect's lineage gate: identifiers in the question (\`backticks\`, camelCase, snake_case,
dotted names, or a single bare token) are matched against former names from git history; otherwise
structural search is used. Rebuilds the index first if HEAD has changed.

Options:
  --k <n>     Number of results (default 10)
  --json      Machine-readable output`,
  ask: `Usage: rtro ask "<question>" [--k <n>] [--dry-run] [--provider <p>] [--model <m>]

Retrieve the top results, build a context within the token budget, and ask an LLM. Prints the
answer followed by "Sources:".

Options:
  --k <n>            Number of code results in the context (default: config k, 5)
  --dry-run          Print the full prompt; make no network call
  --provider <p>     anthropic (default) or openai-compatible
  --model <m>        Model name (else config "model", else RETROSPECT_MODEL)

Environment:
  ANTHROPIC_API_KEY  for provider anthropic
  OPENAI_API_KEY     for provider openai-compatible (plus OPENAI_BASE_URL or config baseUrl)
  RETROSPECT_MODEL   default model`,
  config: `Usage: rtro config get <key> [--global]
       rtro config set <key> <value> [--global]

Project keys (.retrospect/config.json):   history, k, tokenBudget
Global keys  (~/.retrospect/config.json): provider, model, baseUrl   (use --global)
API keys are never stored in files; set them as environment variables.`
};

function out(io, s) { io.stdout.write(s + '\n'); }

async function cmdInit(argv, io) {
  const a = parseArgs(argv, { booleans: ['help'], strings: ['history'] });
  if (a.flags.help) return out(io, HELP.init);
  const root = store.repoRoot(io.cwd);
  const p = store.paths(root);
  fs.mkdirSync(p.dir, { recursive: true });
  if (a.flags.history) config.setValue('history', String(positiveInt(a.flags.history, 'history')), { isGlobal: false, retroDir: p.dir });
  else if (!fs.existsSync(p.config)) config.writeJson(p.config, { ...config.PROJECT_DEFAULTS });
  const added = store.ensureExcluded(root);
  out(io, `Initialising Retrospect in ${root}`);
  if (added) out(io, 'Added ".retrospect/" to .git/info/exclude');
  const meta = await store.buildIndexes(root, { log: m => out(io, `  ${m}`) });
  out(io, `Indexed HEAD ${meta.indexedHead ? meta.indexedHead.slice(0, 12) : '(no commits)'}: ${meta.counts.symbols} symbols, ` +
    `${meta.counts.symbolsWithHistory} with history (${(meta.timings.structuralSeconds + meta.timings.historySeconds).toFixed(1)}s total)`);
}

function fileSize(p) { try { return fs.statSync(p).size; } catch { return 0; } }
const kb = n => `${(n / 1024).toFixed(1)} KB`;

async function cmdStatus(argv, io) {
  const a = parseArgs(argv, { booleans: ['help'] });
  if (a.flags.help) return out(io, HELP.status);
  const root = store.repoRoot(io.cwd);
  const p = store.paths(root);
  out(io, `Repository: ${root}`);
  if (!store.isInitialised(root)) {
    out(io, 'Initialised: no — run: rtro init');
  } else {
    const meta = config.readJson(p.meta, {});
    const f = store.freshness(root);
    const cfg = config.readProjectConfig(p.dir);
    out(io, 'Initialised: yes');
    out(io, `Indexed HEAD: ${f.indexedHead ? f.indexedHead.slice(0, 12) : '(none)'}  Current HEAD: ${f.currentHead ? f.currentHead.slice(0, 12) : '(none)'}  -> ${f.stale ? 'stale (rebuilt on next search/ask)' : 'fresh'}`);
    out(io, `History window: ${meta.historyWindow} commits (config: ${cfg.history})`);
    out(io, `Index: ${meta.counts.symbols} symbols in ${meta.counts.files} files; ${meta.counts.symbolsWithHistory} with history; ` +
      `${meta.counts.commitsAnalyzed} commits analysed`);
    out(io, `Index size on disk: structural ${kb(fileSize(p.structural))}, history ${kb(fileSize(p.history))}`);
    out(io, `Built: ${meta.builtAt}`);
  }
  const g = config.readGlobalConfig();
  let model = '(not set)';
  try { model = llm.resolveProvider({ globalConfig: g, env: io.env }).model; } catch { /* reported as not set */ }
  const provider = g.provider || 'anthropic';
  const keyEnv = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  out(io, `LLM: provider ${provider}, model ${model}; ${keyEnv} ${io.env[keyEnv] ? 'is set' : 'is not set'}`);
}

/** Load the indexes, rebuilding first (with a one-line notice) when HEAD has changed. */
async function freshIndexes(root, io) {
  if (!store.isInitialised(root)) throw new store.NotInitialisedError();
  const f = store.freshness(root);
  if (f.stale) {
    io.stderr.write(`Index is stale (indexed ${String(f.indexedHead).slice(0, 7)}, HEAD ${String(f.currentHead).slice(0, 7)}); rebuilding...\n`);
    await store.buildIndexes(root);
  }
  return store.loadIndexes(root);
}

async function cmdSearch(argv, io) {
  const a = parseArgs(argv, { booleans: ['help', 'json'], strings: ['k'] });
  if (a.flags.help) return out(io, HELP.search);
  const question = a._.join(' ').trim();
  if (!question) throw new UsageError('Missing question. Usage: rtro search "<question>"');
  const root = store.repoRoot(io.cwd);
  const k = a.flags.k ? positiveInt(a.flags.k, 'k') : 10;
  const idx = await freshIndexes(root, io);
  const res = rankG(question, idx, k);
  out(io, a.flags.json ? JSON.stringify(toJson(question, res, idx.meta), null, 2) : formatResults(res));
}

async function cmdAsk(argv, io) {
  const a = parseArgs(argv, { booleans: ['help', 'dry-run'], strings: ['k', 'provider', 'model'] });
  if (a.flags.help) return out(io, HELP.ask);
  const question = a._.join(' ').trim();
  if (!question) throw new UsageError('Missing question. Usage: rtro ask "<question>"');
  const root = store.repoRoot(io.cwd);
  const cfg = config.readProjectConfig(store.paths(root).dir);
  const k = a.flags.k ? positiveInt(a.flags.k, 'k') : cfg.k;
  const idx = await freshIndexes(root, io);
  const res = rankG(question, idx, k);
  const prompt = buildPrompt(question, res.results, { k, tokenBudget: cfg.tokenBudget, lineage: idx.lineage });
  if (a.flags['dry-run']) {
    out(io, '=== SYSTEM ===');
    out(io, prompt.system);
    out(io, '=== USER ===');
    out(io, prompt.user);
    out(io, '=== (dry run: no request sent) ===');
    out(io, formatSources(prompt.sources));
    return;
  }
  const resolved = llm.resolveProvider({ flags: { provider: a.flags.provider, model: a.flags.model }, globalConfig: config.readGlobalConfig(), env: io.env });
  llm.requireKey(resolved, io.env);
  const answer = await llm.complete(resolved, prompt, { env: io.env, fetchImpl: io.fetch });
  out(io, answer);
  out(io, '');
  out(io, formatSources(prompt.sources));
}

async function cmdConfig(argv, io) {
  const a = parseArgs(argv, { booleans: ['help', 'global'] });
  if (a.flags.help || !a._.length) return out(io, HELP.config);
  const [op, key, value] = a._;
  const isGlobal = !!a.flags.global;
  let retroDir = null;
  if (!isGlobal) {
    const root = store.repoRoot(io.cwd);
    if (!store.isInitialised(root)) throw new store.NotInitialisedError();
    retroDir = store.paths(root).dir;
  }
  if (op === 'get') {
    if (!key) throw new UsageError('Usage: rtro config get <key> [--global]');
    const v = config.getValue(key, { isGlobal, retroDir });
    out(io, v === undefined ? '(not set)' : String(v));
  } else if (op === 'set') {
    if (!key || value === undefined) throw new UsageError('Usage: rtro config set <key> <value> [--global]');
    const v = config.setValue(key, value, { isGlobal, retroDir });
    out(io, `${key} = ${v} (${isGlobal ? config.globalConfigPath() : config.projectConfigPath(retroDir)})`);
  } else {
    throw new UsageError(`Unknown config operation '${op}'. Use get or set.`);
  }
}

const COMMANDS = { init: cmdInit, status: cmdStatus, search: cmdSearch, ask: cmdAsk, config: cmdConfig };

/**
 * CLI entry point. Returns the exit code.
 * @param {string[]} argv arguments after the program name
 * @param {object} [io] { stdout, stderr, cwd, env, fetch } (injectable for tests)
 */
async function main(argv, io = {}) {
  io = { stdout: process.stdout, stderr: process.stderr, cwd: process.cwd(), env: process.env, fetch: globalThis.fetch, ...io };
  const [cmd, ...rest] = argv;
  try {
    if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { out(io, HELP.main); return 0; }
    if (cmd === '--version' || cmd === '-v' || cmd === 'version') { out(io, VERSION); return 0; }
    const fn = COMMANDS[cmd];
    if (!fn) throw new UsageError(`Unknown command '${cmd}'. Run: rtro --help`);
    await fn(rest, io);
    return 0;
  } catch (err) {
    const known = err instanceof UsageError || err instanceof store.NotGitRepoError || err instanceof store.NotInitialisedError || err instanceof llm.LlmConfigError;
    io.stderr.write(`${known ? '' : 'Error: '}${err && err.message ? err.message : err}\n`);
    return err instanceof UsageError ? 2 : 1;
  }
}

module.exports = { main, VERSION, HELP };
