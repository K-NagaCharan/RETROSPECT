const fs = require('fs');
const { execFileSync } = require('child_process');

const baselineQPSource = execFileSync('git', ['show', 'HEAD:src/structural/query/QueryProcessor.js']).toString('utf8');
const baselineModule = { exports: {} };
const baselineFn = new Function('module', 'exports', baselineQPSource);
baselineFn(baselineModule, baselineModule.exports);
const BaselineQueryProcessor = baselineModule.exports;

const QueryProcessor = require('../src/structural/query/QueryProcessor');
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');

async function testPureBaselineDiag04() {
  const guavaPath = 'D:/clones/guava';
  const guavaPin = 'db74bd2fdac443223d45e6fc5c66548542be1081';
  execFileSync('git', ['checkout', '--detach', guavaPin], { cwd: guavaPath, stdio: 'pipe' });

  // 1. Pure baseline: monkeypatch QueryProcessor static methods to Baseline
  const origSplit = QueryProcessor.splitIdentifiers;
  const origProcess = QueryProcessor.process;

  QueryProcessor.splitIdentifiers = BaselineQueryProcessor.splitIdentifiers;
  QueryProcessor.process = BaselineQueryProcessor.process;

  const guavaIndex = await indexRepository(guavaPath, { forceRebuild: false });
  const allSymbols = Array.from(guavaIndex.symbols.values());
  const retriever = new StructuralRetriever(guavaIndex);

  const qText = 'Check that integer index is non-negative and throw appropriate exception';
  const qBase = QueryProcessor.process(qText);
  const rankedBase = retriever.rankCandidates(qBase, allSymbols);
  const targetBase = rankedBase.find(r => r.symbol.name === 'checkNonnegative' && r.symbol.filePath.includes('CollectPreconditions.java'));

  console.log('Pure Baseline DIAG-04 candidate score:', targetBase ? targetBase.score : 'FILTERED OUT (< 0.08)');
  const rankBase = rankedBase.findIndex(r => r.symbol.name === 'checkNonnegative' && r.symbol.filePath.includes('CollectPreconditions.java'));
  console.log('Pure Baseline DIAG-04 rank:', rankBase >= 0 ? rankBase + 1 : 'null');

  // 2. Modified: restore working tree methods
  QueryProcessor.splitIdentifiers = origSplit;
  QueryProcessor.process = origProcess;

  const qMod = QueryProcessor.process(qText);
  const rankedMod = retriever.rankCandidates(qMod, allSymbols);
  const targetMod = rankedMod.find(r => r.symbol.name === 'checkNonnegative' && r.symbol.filePath.includes('CollectPreconditions.java'));

  console.log('Modified DIAG-04 candidate score:', targetMod ? targetMod.score : 'FILTERED OUT');
  const rankMod = rankedMod.findIndex(r => r.symbol.name === 'checkNonnegative' && r.symbol.filePath.includes('CollectPreconditions.java'));
  console.log('Modified DIAG-04 rank:', rankMod >= 0 ? rankMod + 1 : 'null');
}

testPureBaselineDiag04().catch(console.error);
