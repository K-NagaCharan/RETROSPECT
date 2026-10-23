const fs = require('fs');
const path = require('path');
const { makeRenameRepo, run, withTempHome } = require('./helpers');

jest.setTimeout(120000);

describe('rtro config (project and global, temp HOME)', () => {
  let home, repo;
  beforeAll(async () => {
    home = withTempHome();
    repo = makeRenameRepo();
    const r = await run(['init'], { cwd: repo });
    expect(r.code).toBe(0);
  });
  afterAll(() => home.restore());

  test('project keys: defaults, set and get, stored in .retrospect/config.json', async () => {
    expect((await run(['config', 'get', 'k'], { cwd: repo })).stdout.trim()).toBe('5');
    expect((await run(['config', 'get', 'tokenBudget'], { cwd: repo })).stdout.trim()).toBe('4000');
    expect((await run(['config', 'set', 'k', '7'], { cwd: repo })).code).toBe(0);
    expect((await run(['config', 'get', 'k'], { cwd: repo })).stdout.trim()).toBe('7');
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.retrospect', 'config.json'), 'utf8')).k).toBe(7);
    const bad = await run(['config', 'set', 'k', 'zero'], { cwd: repo });
    expect(bad.code).toBe(2);
    expect(bad.stderr).toMatch(/positive integer/);
  });

  test('global keys live in ~/.retrospect/config.json (temp HOME)', async () => {
    expect((await run(['config', 'set', 'provider', 'openai-compatible', '--global'], { cwd: repo })).code).toBe(0);
    expect((await run(['config', 'set', 'model', 'llama3', '--global'], { cwd: repo })).code).toBe(0);
    expect((await run(['config', 'set', 'baseUrl', 'http://localhost:11434/v1/', '--global'], { cwd: repo })).code).toBe(0);
    const g = JSON.parse(fs.readFileSync(path.join(home.home, '.retrospect', 'config.json'), 'utf8'));
    expect(g).toEqual({ provider: 'openai-compatible', model: 'llama3', baseUrl: 'http://localhost:11434/v1' });
    expect((await run(['config', 'get', 'model', '--global'], { cwd: repo })).stdout.trim()).toBe('llama3');
    expect((await run(['config', 'set', 'provider', 'bogus', '--global'], { cwd: repo })).stderr).toMatch(/one of: anthropic, openai-compatible/);
  });

  test('wrong scope and API keys are refused; nothing secret is written', async () => {
    expect((await run(['config', 'set', 'model', 'x'], { cwd: repo })).stderr).toMatch(/global key; use --global/);
    expect((await run(['config', 'set', 'k', '3', '--global'], { cwd: repo })).stderr).toMatch(/project key; drop --global/);
    for (const key of ['apiKey', 'api_key', 'ANTHROPIC_API_KEY']) {
      const r = await run(['config', 'set', key, 'sk-secret', '--global'], { cwd: repo });
      expect(r.code).toBe(2);
      expect(r.stderr).toMatch(/environment variables only/);
    }
    const files = [path.join(home.home, '.retrospect', 'config.json'), path.join(repo, '.retrospect', 'config.json')];
    for (const f of files) expect(fs.readFileSync(f, 'utf8')).not.toContain('sk-secret');
  });
});
