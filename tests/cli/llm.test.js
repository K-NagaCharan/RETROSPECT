const { resolveProvider, requireKey, complete, LlmConfigError } = require('../../src/llm');

describe('provider and model resolution', () => {
  test('defaults to anthropic; model precedence is --model > config > RETROSPECT_MODEL', () => {
    expect(resolveProvider({ env: { RETROSPECT_MODEL: 'env-model' } })).toMatchObject({ provider: 'anthropic', model: 'env-model', keyEnv: 'ANTHROPIC_API_KEY' });
    expect(resolveProvider({ globalConfig: { model: 'cfg-model' }, env: { RETROSPECT_MODEL: 'env-model' } }).model).toBe('cfg-model');
    expect(resolveProvider({ flags: { model: 'flag-model' }, globalConfig: { model: 'cfg-model' }, env: { RETROSPECT_MODEL: 'env-model' } }).model).toBe('flag-model');
  });

  test('provider precedence is --provider > config; base URL from config, else OPENAI_BASE_URL', () => {
    const r = resolveProvider({ flags: { provider: 'openai-compatible', model: 'm' }, globalConfig: { provider: 'anthropic' }, env: { OPENAI_BASE_URL: 'http://localhost:11434/v1/' } });
    expect(r).toMatchObject({ provider: 'openai-compatible', keyEnv: 'OPENAI_API_KEY', baseUrl: 'http://localhost:11434/v1' });
    expect(resolveProvider({ globalConfig: { provider: 'openai-compatible', model: 'm', baseUrl: 'https://api.openai.com/v1' }, env: { OPENAI_BASE_URL: 'http://x' } }).baseUrl).toBe('https://api.openai.com/v1');
  });

  test('clear errors: no model, unknown provider', () => {
    expect(() => resolveProvider({ env: {} })).toThrow(LlmConfigError);
    expect(() => resolveProvider({ env: {} })).toThrow(/RETROSPECT_MODEL/);
    expect(() => resolveProvider({ flags: { provider: 'nope', model: 'm' }, env: {} })).toThrow(/Unknown provider 'nope'/);
  });

  test('missing key errors name the environment variable', () => {
    expect(() => requireKey(resolveProvider({ flags: { model: 'm' }, env: {} }), {})).toThrow(/ANTHROPIC_API_KEY/);
    const oa = resolveProvider({ flags: { provider: 'openai-compatible', model: 'm' }, env: {} });
    expect(() => requireKey(oa, {})).toThrow(/OPENAI_API_KEY/);
    expect(() => requireKey(oa, { OPENAI_API_KEY: 'k' })).toThrow(/OPENAI_BASE_URL/);
  });
});

describe('complete() request shape (mocked fetch, no network)', () => {
  const prompt = { system: 'SYS', user: 'USER' };
  const fakeFetch = (reply) => {
    const calls = [];
    const fn = async (url, init) => { calls.push({ url, init: { ...init, body: JSON.parse(init.body) } }); return { ok: true, status: 200, text: async () => JSON.stringify(reply) }; };
    fn.calls = calls;
    return fn;
  };

  test('anthropic messages API', async () => {
    const f = fakeFetch({ content: [{ type: 'text', text: 'Answer.' }] });
    const r = resolveProvider({ flags: { model: 'claude-x' }, env: {} });
    await expect(complete(r, prompt, { env: { ANTHROPIC_API_KEY: 'sk-test' }, fetchImpl: f })).resolves.toBe('Answer.');
    expect(f.calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(f.calls[0].init.headers['x-api-key']).toBe('sk-test');
    expect(f.calls[0].init.body).toMatchObject({ model: 'claude-x', system: 'SYS', messages: [{ role: 'user', content: 'USER' }] });
  });

  test('openai-compatible chat completions', async () => {
    const f = fakeFetch({ choices: [{ message: { content: ' Hi ' } }] });
    const r = resolveProvider({ flags: { provider: 'openai-compatible', model: 'llama3' }, env: { OPENAI_BASE_URL: 'http://localhost:11434/v1' } });
    await expect(complete(r, prompt, { env: { OPENAI_API_KEY: 'ollama' }, fetchImpl: f })).resolves.toBe('Hi');
    expect(f.calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
    expect(f.calls[0].init.headers.authorization).toBe('Bearer ollama');
    expect(f.calls[0].init.body.messages).toEqual([{ role: 'system', content: 'SYS' }, { role: 'user', content: 'USER' }]);
  });

  test('local openai-compatible endpoints need no key: request is sent without an Authorization header', async () => {
    for (const baseUrl of ['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1', 'http://[::1]:8080/v1']) {
      const f = fakeFetch({ choices: [{ message: { content: 'local answer' } }] });
      const r = resolveProvider({ flags: { provider: 'openai-compatible', model: 'llama3' }, env: { OPENAI_BASE_URL: baseUrl } });
      expect(requireKey(r, {})).toBeNull();
      await expect(complete(r, prompt, { env: {}, fetchImpl: f })).resolves.toBe('local answer');
      expect(f.calls).toHaveLength(1);
      expect(f.calls[0].url).toBe(`${baseUrl}/chat/completions`);
      expect(Object.keys(f.calls[0].init.headers).map(h => h.toLowerCase())).not.toContain('authorization');
    }
  });

  test('a key set for a local endpoint is still sent', async () => {
    const f = fakeFetch({ choices: [{ message: { content: 'ok' } }] });
    const r = resolveProvider({ flags: { provider: 'openai-compatible', model: 'm' }, env: { OPENAI_BASE_URL: 'http://localhost:11434/v1' } });
    await complete(r, prompt, { env: { OPENAI_API_KEY: 'local-key' }, fetchImpl: f });
    expect(f.calls[0].init.headers.authorization).toBe('Bearer local-key');
  });

  test('remote openai-compatible URL with no key keeps the existing error and sends nothing', async () => {
    for (const baseUrl of ['https://api.openai.com/v1', 'http://localhost.example.com/v1', 'http://10.0.0.5:11434/v1']) {
      const never = jest.fn();
      const r = resolveProvider({ flags: { provider: 'openai-compatible', model: 'm' }, env: { OPENAI_BASE_URL: baseUrl } });
      expect(() => requireKey(r, {})).toThrow(/set the OPENAI_API_KEY environment variable/);
      await expect(complete(r, prompt, { env: {}, fetchImpl: never })).rejects.toThrow(/OPENAI_API_KEY/);
      expect(never).not.toHaveBeenCalled();
    }
  });

  test('HTTP errors surface the provider message; missing key fails before any request', async () => {
    const bad = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: { message: 'invalid x-api-key' } }) });
    const r = resolveProvider({ flags: { model: 'm' }, env: {} });
    await expect(complete(r, prompt, { env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: bad })).rejects.toThrow(/401.*invalid x-api-key/);
    const never = jest.fn();
    await expect(complete(r, prompt, { env: {}, fetchImpl: never })).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(never).not.toHaveBeenCalled();
  });
});
