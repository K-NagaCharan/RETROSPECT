const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const FunctionExtractor = require('../../src/parser/FunctionExtractor');
const HistoricalRetrievalAdapter = require('../../src/retrieval/HistoricalRetrievalAdapter');

// Fix 1: module-level factory definitions `const X = f(..., () => {...})` (e.g. zod's $constructor).
// Fix 2: TypeScript overload signatures collapse into one callable symbol.
describe('Factory-call extraction and overload-signature collapse', () => {
  const fx = new FunctionExtractor();
  const extract = async (src, file) => (await fx.extract(src, file)).symbols;
  const named = (symbols, name) => symbols.filter(s => s.name === name);

  describe('factory-call extraction', () => {
    test('TS: zod-style $constructor const becomes a symbol spanning the callback', async () => {
      const src = [
        'export interface $ZodArray { kind: string }',
        'export const $ZodArray: core.$constructor<$ZodArray> = /*@__PURE__*/ core.$constructor("$ZodArray", (inst, def) => {',
        '  const max = def.maximum;',
        '  return max;',
        '});'
      ].join('\n');
      const symbols = await extract(src, 'schemas.ts');
      const all = named(symbols, '$ZodArray');
      expect(all.map(s => s.symbolType).sort()).toEqual(['arrow_function', 'interface']);
      const factory = all.find(s => s.symbolType === 'arrow_function');
      expect(factory.metadata.factoryCall).toBe('core.$constructor');
      expect(factory.parameters.map(p => p.name)).toEqual(['inst', 'def']);
      expect(factory.range.startLine).toBe(2);
      expect(factory.range.endLine).toBe(5);
      expect(factory.source).toContain('def.maximum');
    });

    test('JS: exported wrapper call with a function expression becomes a symbol', async () => {
      const symbols = await extract('export const handler = wrap(function (req, res) { return res; });\n', 'app.js');
      const h = named(symbols, 'handler');
      expect(h).toHaveLength(1);
      expect(h[0].symbolType).toBe('function');
      expect(h[0].metadata.factoryCall).toBe('wrap');
    });

    test('calls without a function argument, and calls inside functions, are not extracted', async () => {
      const src = [
        "const dep = require('dep');",
        'const total = compute(1, 2);',
        'function outer(items) {',
        '  const doubled = items.map(x => x * 2);',
        '  return doubled;',
        '}'
      ].join('\n');
      for (const file of ['m.js', 'm.ts']) {
        const names = (await extract(src, file)).map(s => s.name);
        expect(names).toContain('outer');
        expect(names).not.toContain('dep');
        expect(names).not.toContain('total');
        expect(names).not.toContain('doubled');
      }
    });

    test('non-exported computed values with callbacks are not extracted (express/zod false positives)', async () => {
      const src = [
        'const server = app.listen(3000, function () { done(); });',
        'const names = users.map(function (u) { return u.name; });',
        "const html = marked.parse(str).replace(/x/g, () => 'y');",
        'const schema = z.preprocess((v) => String(v), z.string());',
        'if (ready) { const h = wrap(() => 1); }'
      ].join('\n');
      for (const file of ['t.js', 't.ts']) {
        const names = (await extract(src, file)).map(s => s.name);
        for (const n of ['server', 'names', 'html', 'schema', 'h']) {
          expect(names).not.toContain(n);
        }
      }
    });

    test('existing arrow-function consts are unchanged', async () => {
      const symbols = await extract('export const add = (a: number, b: number) => a + b;\n', 'u.ts');
      const add = named(symbols, 'add');
      expect(add).toHaveLength(1);
      expect(add[0].symbolType).toBe('arrow_function');
      expect(add[0].metadata.factoryCall).toBeUndefined();
    });
  });

  describe('overload-signature collapse (TS)', () => {
    test('function overloads collapse into the implementation', async () => {
      const src = [
        'export function f(a: string): string;',
        'export function f(a: number): number;',
        'export function f(a: any) { return a; }'
      ].join('\n');
      const f = named(await extract(src, 'o.ts'), 'f');
      expect(f).toHaveLength(1);
      expect(f[0].metadata.isSignatureOnly).toBe(false);
      expect(f[0].metadata.overloadCount).toBe(2);
      expect(f[0].range.startLine).toBe(3);
    });

    test('signature-only overloads keep a single representative', async () => {
      const src = [
        'declare function g(a: string): void;',
        'declare function g(a: number): void;'
      ].join('\n');
      const g = named(await extract(src, 'd.ts'), 'g');
      expect(g).toHaveLength(1);
      expect(g[0].metadata.isSignatureOnly).toBe(true);
      expect(g[0].metadata.overloadCount).toBe(2);
    });

    test('class method overloads collapse into the implementation', async () => {
      const src = [
        'class C {',
        '  m(a: string): void;',
        '  m(a: number): void;',
        '  m(a: any): void { return; }',
        '}'
      ].join('\n');
      const m = named(await extract(src, 'c.ts'), 'm');
      expect(m).toHaveLength(1);
      expect(m[0].qualifiedName).toBe('C.m');
      expect(m[0].metadata.isSignatureOnly).toBe(false);
    });

    test('single interface method signatures and same-named members of different types are kept', async () => {
      const src = [
        'interface A { parse(x: string): number; }',
        'interface B { parse(x: string): number; }'
      ].join('\n');
      const parse = named(await extract(src, 'i.ts'), 'parse');
      expect(parse.map(s => s.qualifiedName).sort()).toEqual(['A.parse', 'B.parse']);
      expect(parse.every(s => s.metadata.overloadCount === undefined)).toBe(true);
    });
  });

  describe('history attribution for factory symbols', () => {
    let repo;
    const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();

    beforeAll(() => {
      repo = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-factory-history-'));
      git(['init', '-q', '-b', 'main']);
      git(['config', 'user.name', 'Factory Tester']);
      git(['config', 'user.email', 'factory@example.com']);
      const file = path.join(repo, 'src', 'schemas.ts');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const body = check => `export const $ZodArray = core.$constructor("$ZodArray", (inst, def) => {\n  ${check}\n  return inst;\n});\n`;
      fs.writeFileSync(file, body('const n = def.items;'));
      git(['add', '.']);
      git(['commit', '-q', '-m', 'add array schema']);
      fs.writeFileSync(file, body('if (def.items.length > def.maximum) throw new Error("array size bounds");'));
      git(['commit', '-q', '-am', 'check array size bounds before parsing']);
      fs.writeFileSync(path.join(repo, 'README.md'), 'x\n');
      git(['add', '.']);
      git(['commit', '-q', '-m', 'docs']);
    });

    afterAll(() => {
      try { fs.rmSync(repo, { recursive: true, force: true }); } catch (e) {}
    });

    test('an edit inside the factory callback yields a modified history profile for the factory symbol', async () => {
      const src = fs.readFileSync(path.join(repo, 'src', 'schemas.ts'), 'utf8');
      const current = (await extract(src, 'src/schemas.ts')).map(s => ({ ...s, filePath: 'src/schemas.ts' }));
      const target = current.find(s => s.name === '$ZodArray');
      expect(target).toBeDefined();
      const adapter = new HistoricalRetrievalAdapter();
      const { profileMap } = await adapter.indexRepositoryHistory(repo, current, { maxCommits: 50, startCommit: 'HEAD' });
      const profile = profileMap.get(target.id);
      expect(profile).toBeTruthy();
      expect(profile.commitMessage).toContain('check array size bounds');
      expect(profile.evolutionType).not.toBe('unchanged');
    }, 60000);
  });
});
