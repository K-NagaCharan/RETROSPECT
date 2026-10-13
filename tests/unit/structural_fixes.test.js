const QueryProcessor = require('../../src/structural/query/QueryProcessor');
const { StructuralIndex } = require('../../src/structural/index/StructuralIndex');
const { StructuralRetriever } = require('../../src/structural/retrieval/StructuralRetriever');
const SymbolRecord = require('../../src/model/SymbolRecord');

describe('Structural Retrieval Root-Cause Fixes & Regression Tests', () => {
  test('Exact candidate extraction ignores common lowercase words in multi-word queries', () => {
    const q = QueryProcessor.process('Mount middleware functions into the request processing chain');
    expect(q.exactCandidateNames).toEqual([]);
    expect(q.queryWords).toContain('Mount');
    expect(q.queryWords).toContain('middleware');
    expect(q.queryWords).toContain('request');
  });

  test('Exact candidate extraction retains genuine identifiers (camelCase, snake_case, dot, single-word)', () => {
    const q1 = QueryProcessor.process('tob');
    expect(q1.exactCandidateNames).toContain('tob');

    const q2 = QueryProcessor.process('Where is app.listen configured?');
    expect(q2.exactCandidateNames).toContain('app.listen');

    const q3 = QueryProcessor.process('Call validateUserToken or process_order_data');
    expect(q3.exactCandidateNames).toContain('validateUserToken');
    expect(q3.exactCandidateNames).toContain('process_order_data');
  });

  test('QueryProcessor.stem strips -ly adverbs and canonicalizes sync/async', () => {
    expect(QueryProcessor.stem('safely')).toBe('safe');
    expect(QueryProcessor.stem('recursively')).toBe('recursive');
    expect(QueryProcessor.stem('synchronously')).toBe('sync');
    expect(QueryProcessor.stem('asynchronously')).toBe('async');
  });

  test('Incidental single-word match discount suppresses multi-word unanswerable queries', async () => {
    const index = new StructuralIndex();
    const sym = new SymbolRecord({
      name: 'keys',
      normalizedSignature: 'keys()',
      symbolType: 'method',
      filePath: 'dict_tools.py',
      source: 'def keys(): pass',
      language: 'python'
    });
    index.symbols.set(sym.id, sym);
    index._indexSymbolTokens(sym);

    const retriever = new StructuralRetriever(index);
    const searchRes = await retriever.search('Quantum key distribution encryption handshake');
    expect(searchRes.results.length).toBe(0);
  });

  test('Test and mock files are deprioritized relative to implementation source files', async () => {
    const index = new StructuralIndex();
    const implSym = new SymbolRecord({
      name: 'serialize',
      normalizedSignature: 'serialize(obj)',
      symbolType: 'method',
      filePath: 'src/main/serializer.js',
      source: 'function serialize(obj) {}',
      language: 'javascript'
    });
    const testSym = new SymbolRecord({
      name: 'serialize',
      normalizedSignature: 'serialize(mock)',
      symbolType: 'method',
      filePath: 'tests/mock_serializer.js',
      source: 'function serialize(mock) {}',
      language: 'javascript'
    });

    index.symbols.set(implSym.id, implSym);
    index.symbols.set(testSym.id, testSym);
    index._indexSymbolTokens(implSym);
    index._indexSymbolTokens(testSym);

    const retriever = new StructuralRetriever(index);
    const searchRes = await retriever.search('serialize');
    expect(searchRes.results.length).toBe(2);
    expect(searchRes.results[0].filePath).toBe('src/main/serializer.js');
    expect(searchRes.results[1].filePath).toBe('tests/mock_serializer.js');
    expect(searchRes.results[0].score).toBeGreaterThan(searchRes.results[1].score);
  });

  test('Compound word matching matches subtoken roots (e.g. multipart matches multi and part)', async () => {
    const index = new StructuralIndex();
    const sym = new SymbolRecord({
      name: '_MultipartParser',
      normalizedSignature: 'class _MultipartParser',
      symbolType: 'class',
      filePath: 'core/parser.py',
      source: 'class _MultipartParser: pass',
      language: 'python'
    });
    index.symbols.set(sym.id, sym);
    index._indexSymbolTokens(sym);

    const retriever = new StructuralRetriever(index);
    const query = QueryProcessor.process('multi part upload');
    const candidates = retriever.generateCandidates(query);
    const ranked = retriever.rankCandidates(query, candidates);

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].symbol.name).toBe('_MultipartParser');
  });

  test('Domain terms (languages, formats, protocols) in multi-word queries are not promoted to exact identifiers', () => {
    const qMulti = QueryProcessor.process('Serialize Java object into JSON string format');
    expect(qMulti.exactCandidateNames).toEqual([]);

    const qGraph = QueryProcessor.process('GraphQL subscription query execution engine');
    expect(qGraph.exactCandidateNames).toEqual([]);

    // Single-word queries retain exact lookup capability
    const qSingle = QueryProcessor.process('graphql');
    expect(qSingle.exactCandidateNames).toContain('graphql');
  });

  test('Windows backslash paths in test/script files are correctly deprioritized', async () => {
    const index = new StructuralIndex();
    const implSym = new SymbolRecord({
      name: 'parse',
      normalizedSignature: 'parse()',
      symbolType: 'function',
      filePath: 'src\\parser\\core.js',
      source: 'function parse() {}',
      language: 'javascript'
    });
    const scriptSym = new SymbolRecord({
      name: 'parse',
      normalizedSignature: 'parse()',
      symbolType: 'function',
      filePath: 'scripts\\build-tools.js',
      source: 'function parse() {}',
      language: 'javascript'
    });

    index.symbols.set(implSym.id, implSym);
    index.symbols.set(scriptSym.id, scriptSym);
    index._indexSymbolTokens(implSym);
    index._indexSymbolTokens(scriptSym);

    const retriever = new StructuralRetriever(index);
    const searchRes = await retriever.search('parse');
    expect(searchRes.results.length).toBe(2);
    expect(searchRes.results[0].filePath).toBe('src\\parser\\core.js');
    expect(searchRes.results[0].score).toBeGreaterThan(searchRes.results[1].score);
  });
});
