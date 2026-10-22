const fs = require('fs');
const os = require('os');
const path = require('path');
const FunctionExtractor = require('../../src/parser/FunctionExtractor');
const TreeSitterManager = require('../../src/parser/TreeSitterManager');
const { defaultRegistry } = require('../../src/languages/LanguageAdapterRegistry');
const { StructuralIndex } = require('../../src/structural/index/StructuralIndex');
const HistoricalRetrievalAdapter = require('../../src/retrieval/HistoricalRetrievalAdapter');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'parserfix');
const FILES = [['java', 'Sample.java'], ['python', 'sample.py'], ['javascript', 'sample.js'], ['typescript', 'sample.ts']];

describe('Parser memory fix: equivalence with pre-fix output', () => {
  // prefix_snapshot.json was generated from base commit 17ea399 (before the fix); it is byte-identical to the
  // output of the pre-fix working tree for these fixtures.
  const snapshot = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'prefix_snapshot.json'), 'utf8'));

  test.each(FILES)('%s: extracted symbols and imports deep-equal the pre-fix snapshot', async (lang, file) => {
    const src = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
    const r = await new FunctionExtractor().extract(src, file, lang);
    const actual = JSON.parse(JSON.stringify({ symbols: r.symbols, imports: r.imports, hasSyntaxError: r.hasSyntaxError }));
    expect(actual).toEqual(snapshot[lang]);
  });

  test('repeated extraction of the same file is stable with a reused parser', async () => {
    const src = fs.readFileSync(path.join(FIXTURES, 'Sample.java'), 'utf8');
    const ex = new FunctionExtractor();
    const first = JSON.stringify((await ex.extract(src, 'Sample.java', 'java')).symbols);
    for (let i = 0; i < 20; i++) {
      expect(JSON.stringify((await ex.extract(src, 'Sample.java', 'java')).symbols)).toBe(first);
    }
  });
});

describe('Parser memory fix: resource lifecycle', () => {
  test('one parser per language is reused across parses', async () => {
    const a = await TreeSitterManager.getParser('java');
    const b = await TreeSitterManager.getParser('java');
    const c = await TreeSitterManager.getParser('python');
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  test('the tree is deleted after extraction, including when extractSymbols throws', async () => {
    const adapter = defaultRegistry.getAdapter('java');
    const realParse = adapter.parse.bind(adapter);
    const deleted = [];
    const parseSpy = jest.spyOn(adapter, 'parse').mockImplementation(async (src) => {
      const tree = await realParse(src);
      const realDelete = tree.delete.bind(tree);
      tree.delete = () => { deleted.push(true); realDelete(); };
      return tree;
    });
    try {
      await new FunctionExtractor().extract('class A { void f() {} }', 'A.java', 'java');
      expect(deleted.length).toBe(1);

      const extractSpy = jest.spyOn(adapter, 'extractSymbols').mockImplementation(() => { throw new Error('boom'); });
      await expect(new FunctionExtractor().extract('class B { void g() {} }', 'B.java', 'java')).rejects.toThrow('boom');
      expect(deleted.length).toBe(2);
      extractSpy.mockRestore();
    } finally {
      parseSpy.mockRestore();
    }
  });
});

describe('Parser memory fix: extraction failures are counted, not thrown', () => {
  const failingExtractor = { extract: async () => { throw new Error('forced parse error'); } };

  test('StructuralIndex records extractionFailures and keeps building', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-fail-'));
    const file = path.join(dir, 'a.js');
    fs.writeFileSync(file, 'function a() { return 1; }\n');
    const discoverer = {
      discover: async () => ({ files: [{ filePath: file, relativePath: 'a.js', language: 'javascript', mtimeMs: 1, size: 27 }], stats: {} })
    };
    const index = new StructuralIndex({ extractor: failingExtractor, discoverer });
    await expect(index.build(dir)).resolves.toBe(index);
    expect(index.symbols.size).toBe(0);
    expect(index.extractionFailures.count).toBe(1);
    expect(index.extractionFailures.firstError).toMatch(/a\.js: forced parse error/);
    expect(index.stats.extractionFailures).toEqual({ count: 1, firstError: index.extractionFailures.firstError });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('StructuralIndex reports zero failures on a normal build', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-ok-'));
    const file = path.join(dir, 'a.js');
    fs.writeFileSync(file, 'function a() { return 1; }\n');
    const discoverer = {
      discover: async () => ({ files: [{ filePath: file, relativePath: 'a.js', language: 'javascript', mtimeMs: 1, size: 27 }], stats: {} })
    };
    const index = await new StructuralIndex({ discoverer }).build(dir);
    expect(index.symbols.size).toBe(1);
    expect(index.stats.extractionFailures).toEqual({ count: 0, firstError: null });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('history indexing records extractionFailures and returns profiles', async () => {
    const gitReader = {
      getCommitHistory: async () => [{ hash: 'c1c1c1c1c1c1c1', parents: ['c0c0c0c0c0c0c0'] }, { hash: 'c0c0c0c0c0c0c0', parents: [] }],
      getChangedFiles: async () => [{ newPath: 'a.js', oldPath: 'a.js', status: 'modified' }],
      getFileContent: async () => 'function a() {}',
      getFileDiff: async () => ''
    };
    const adapter = new HistoricalRetrievalAdapter({ gitReader, extractor: failingExtractor });
    const current = [{ id: 'a.js::a::1', name: 'a', qualifiedName: 'a', filePath: 'a.js' }];
    const res = await adapter.indexRepositoryHistory('/repo', current, { maxCommits: 2 });
    expect(res.profileMap.size).toBe(1);
    expect(res.stats.extractionFailures.count).toBe(2); // child and parent version of a.js
    expect(res.stats.extractionFailures.firstError).toMatch(/a\.js: forced parse error/);
  });
});
