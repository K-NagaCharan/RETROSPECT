const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const { execFileSync } = require('child_process');

async function traceFailureCases() {
  console.log('=================== TRACING DIAG-04 ===================');
  const guavaPath = 'D:/clones/guava';
  const guavaPin = 'db74bd2fdac443223d45e6fc5c66548542be1081';
  execFileSync('git', ['checkout', '--detach', guavaPin], { cwd: guavaPath, stdio: 'pipe' });

  const guavaIndex = await indexRepository(guavaPath, { forceRebuild: false });
  const q4_raw = 'Check that integer index is non-negative and throw appropriate exception';
  const q4 = QueryProcessor.process(q4_raw);
  console.log('DIAG-04 raw query:', q4_raw);
  console.log('DIAG-04 processed terms:', q4.terms);
  console.log('DIAG-04 stemmedTerms:', q4.stemmedTerms);
  console.log('DIAG-04 exactCandidateNames:', q4.exactCandidateNames);
  console.log('DIAG-04 queryWords:', q4.queryWords);

  // Find target in guavaIndex
  let target04 = null;
  for (const sym of guavaIndex.symbols.values()) {
    if (sym.filePath.replace(/\\/g, '/').includes('CollectPreconditions.java') && sym.name === 'checkNonnegative') {
      target04 = sym;
      break;
    }
  }
  console.log('Target04 found in index:', !!target04);
  if (target04) {
    console.log('Target04 details:', {
      name: target04.name,
      filePath: target04.filePath,
      parameters: target04.parameters,
      docstring: target04.docstring,
      calls: target04.calls
    });
    // Check subtokens of target
    const nameSubtokens = QueryProcessor.splitIdentifiers(target04.name);
    console.log('Target04 name subtokens:', nameSubtokens);

    // Score target with StructuralRetriever
    const retriever = new StructuralRetriever(guavaIndex);
    const scoreResult = retriever._scoreCandidate(q4, target04, new Set());
    console.log('Target04 _scoreCandidate result:', scoreResult);

    // Check candidate generation
    const candidates = retriever.generateCandidates(q4);
    const inGenerated = candidates.some(c => c.id === target04.id);
    console.log('Target04 in generated candidates:', inGenerated);
  }

  console.log('\n=================== TRACING DIAG-07 ===================');
  const undertowPath = 'D:/clones/undertow';
  const undertowPin = 'cf3abec9145bb4660659add41b97866ff6ef9c31';
  execFileSync('git', ['checkout', '--detach', undertowPin], { cwd: undertowPath, stdio: 'pipe' });

  const undertowIndex = await indexRepository(undertowPath, { forceRebuild: false });
  const q7_raw = 'Process and dispatch websocket binary and text frames internally across stream sink channel';
  const q7 = QueryProcessor.process(q7_raw);
  console.log('DIAG-07 raw query:', q7_raw);
  console.log('DIAG-07 processed terms:', q7.terms);
  console.log('DIAG-07 stemmedTerms:', q7.stemmedTerms);
  console.log('DIAG-07 exactCandidateNames:', q7.exactCandidateNames);
  console.log('DIAG-07 queryWords:', q7.queryWords);

  let target07 = null;
  for (const sym of undertowIndex.symbols.values()) {
    if (sym.filePath.replace(/\\/g, '/').includes('WebSocket07FrameSinkChannel.java') && sym.name === 'sendInternal') {
      target07 = sym;
      break;
    }
  }
  console.log('Target07 found in index:', !!target07);
  if (target07) {
    console.log('Target07 details:', {
      name: target07.name,
      filePath: target07.filePath,
      parameters: target07.parameters,
      docstring: target07.docstring,
      calls: target07.calls
    });
    const nameSubtokens = QueryProcessor.splitIdentifiers(target07.name);
    console.log('Target07 name subtokens:', nameSubtokens);

    const retriever = new StructuralRetriever(undertowIndex);
    const scoreResult = retriever._scoreCandidate(q7, target07, new Set());
    console.log('Target07 _scoreCandidate result:', scoreResult);

    const candidates = retriever.generateCandidates(q7);
    const inGenerated = candidates.some(c => c.id === target07.id);
    console.log('Target07 in generated candidates:', inGenerated);
  }
}

traceFailureCases().catch(console.error);
