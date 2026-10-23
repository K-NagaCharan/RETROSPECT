/**
 * LLM providers (Node built-in fetch; no dependencies). API keys are read from the environment only.
 *   anthropic          ANTHROPIC_API_KEY             (default provider)
 *   openai-compatible  OPENAI_API_KEY + base URL     (config baseUrl or OPENAI_BASE_URL; OpenAI, Ollama, other compatible servers)
 *                      no key needed when the base URL host is localhost, 127.0.0.1 or ::1 (Authorization header omitted)
 * Model: --model, else global config "model", else RETROSPECT_MODEL.
 */
const PROVIDERS = ['anthropic', 'openai-compatible'];

class LlmConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LlmConfigError';
  }
}

function resolveProvider({ flags = {}, globalConfig = {}, env = process.env } = {}) {
  const provider = flags.provider || globalConfig.provider || 'anthropic';
  if (!PROVIDERS.includes(provider)) throw new LlmConfigError(`Unknown provider '${provider}'. Use one of: ${PROVIDERS.join(', ')}`);
  const model = flags.model || globalConfig.model || env.RETROSPECT_MODEL;
  if (!model) {
    throw new LlmConfigError('No model set. Pass --model <name>, run: rtro config set model <name> --global, or set RETROSPECT_MODEL.');
  }
  const out = { provider, model };
  if (provider === 'anthropic') {
    out.keyEnv = 'ANTHROPIC_API_KEY';
    out.baseUrl = 'https://api.anthropic.com';
  } else {
    out.keyEnv = 'OPENAI_API_KEY';
    out.baseUrl = (globalConfig.baseUrl || env.OPENAI_BASE_URL || '').replace(/\/+$/, '') || null;
  }
  return out;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** True when the base URL points at this machine (Ollama, LM Studio and similar local servers need no key). */
function isLocalBaseUrl(baseUrl) {
  try {
    return LOCAL_HOSTS.has(new URL(baseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Resolve the API key for a resolved provider; throws naming the missing variable.
 * Returns null for an openai-compatible endpoint on localhost / 127.0.0.1 / ::1 when no key is set.
 */
function requireKey(resolved, env = process.env) {
  const key = env[resolved.keyEnv] || null;
  const local = resolved.provider === 'openai-compatible' && !!resolved.baseUrl && isLocalBaseUrl(resolved.baseUrl);
  if (!key && !local) throw new LlmConfigError(`Missing API key: set the ${resolved.keyEnv} environment variable (keys are never read from config files).`);
  if (resolved.provider === 'openai-compatible' && !resolved.baseUrl) {
    throw new LlmConfigError('Missing base URL for openai-compatible: set OPENAI_BASE_URL or run: rtro config set baseUrl <url> --global (e.g. https://api.openai.com/v1).');
  }
  return key;
}

async function postJson(url, headers, body, fetchImpl) {
  const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) {
    const msg = data && (data.error && (data.error.message || data.error)) ? (data.error.message || JSON.stringify(data.error)) : text.slice(0, 300);
    throw new Error(`LLM request failed (${res.status}): ${msg}`);
  }
  return data;
}

/**
 * Call the provider. Returns the answer text.
 * @param {object} resolved from resolveProvider
 * @param {{system: string, user: string}} prompt
 * @param {object} [opts] { env, fetchImpl, maxTokens }
 */
async function complete(resolved, prompt, opts = {}) {
  const env = opts.env || process.env;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available; Node 18 or newer is required');
  const key = requireKey(resolved, env);
  const maxTokens = opts.maxTokens || 1024;
  if (resolved.provider === 'anthropic') {
    const data = await postJson(`${resolved.baseUrl}/v1/messages`, { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      { model: resolved.model, max_tokens: maxTokens, system: prompt.system, messages: [{ role: 'user', content: prompt.user }] }, fetchImpl);
    return (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  }
  const data = await postJson(`${resolved.baseUrl}/chat/completions`, key ? { authorization: `Bearer ${key}` } : {},
    { model: resolved.model, max_tokens: maxTokens, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }] }, fetchImpl);
  return ((data.choices || [])[0] || {}).message ? data.choices[0].message.content.trim() : '';
}

module.exports = { PROVIDERS, LlmConfigError, resolveProvider, requireKey, isLocalBaseUrl, complete };
