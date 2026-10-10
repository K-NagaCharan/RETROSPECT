const fs = require('fs');
const path = require('path');
const os = require('os');
const HistoryStore = require('../../src/storage/HistoryStore');
const { HistoryCache, CACHE_SYSTEM_VERSION } = require('../../src/storage/HistoryCache');
const { HistoryGraph } = require('../../src/model/HistoryGraph');

describe('Storage and Cache Unit Tests', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-test-storage-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('HistoryStore persists graph in JSONL and recovers correctly', async () => {
    const store = new HistoryStore(tempDir);
    const graph = new HistoryGraph({ repository: 'test-repo', targetCommit: 'c1' });

    graph.addNode({
      versionId: 'c1::v1',
      name: 'foo',
      filePath: 'a.js'
    });
    graph.addNode({
      versionId: 'c0::v0',
      name: 'foo',
      filePath: 'a.js'
    });
    graph.addEdge({
      sourceVersionId: 'c1::v1',
      targetVersionId: 'c0::v0',
      childCommit: 'c1',
      parentCommit: 'c0',
      changeClassification: 'modified',
      matchingScore: 0.95
    });

    await store.saveGraph('test-repo', 'c1', graph);

    // Verify file exists
    const graphFile = store.getGraphPath('test-repo', 'c1');
    expect(fs.existsSync(graphFile)).toBe(true);

    // Load back
    const loaded = await store.loadGraph('test-repo', 'c1');
    expect(loaded).toBeDefined();
    expect(loaded.nodes.size).toBe(2);
    expect(loaded.edges.length).toBe(1);
    expect(loaded.getNode('c1::v1').name).toBe('foo');

    // Query function history
    const history = await store.getFunctionHistory('test-repo', 'c1', 'c1::v1');
    expect(history.length).toBe(2);
    expect(history[0].node.versionId).toBe('c1::v1');
    expect(history[1].node.versionId).toBe('c0::v0');
    expect(history[1].edge.changeClassification).toBe('modified');
  });

  test('HistoryStore recovers gracefully from corrupted JSONL lines', async () => {
    const store = new HistoryStore(tempDir);
    const graphFile = store.getGraphPath('test-repo', 'c1');

    const lines = [
      JSON.stringify({ type: 'metadata', repository: 'test-repo' }),
      'CORRUPTED_NON_JSON_LINE_HERE',
      JSON.stringify({ type: 'node', versionId: 'c1::v1', name: 'bar' })
    ];
    await fs.promises.writeFile(graphFile, lines.join('\n'), 'utf8');

    const loaded = await store.loadGraph('test-repo', 'c1');
    expect(loaded).toBeDefined();
    expect(loaded.nodes.size).toBe(1);
    expect(loaded.getNode('c1::v1').name).toBe('bar');
  });

  test('HistoryCache puts, gets, and validates cache entries', async () => {
    const cache = new HistoryCache(tempDir);
    const symbols = [{ id: 's1', name: 'myFunc' }];

    await cache.putSymbols('commit123', 'src/file.py', symbols);
    const retrieved = await cache.getSymbols('commit123', 'src/file.py');
    expect(retrieved).toEqual(symbols);

    // Invalidation
    await cache.invalidate('commit123');
    const afterInvalidation = await cache.getSymbols('commit123', 'src/file.py');
    expect(afterInvalidation).toBeNull();
  });

  test('HistoryCache handles malformed cache files gracefully', async () => {
    const cache = new HistoryCache(tempDir);
    const targetFile = path.join(cache.symbolsDir, 'badcommit_badpath.json');
    await fs.promises.writeFile(targetFile, 'invalid json content', 'utf8');

    const res = await cache.getSymbols('badcommit', 'badpath');
    expect(res).toBeNull();
  });
});
