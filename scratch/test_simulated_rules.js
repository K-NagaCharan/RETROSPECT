const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const { execFileSync } = require('child_process');

// Proposed Prefix rules
const PREFIXES = ['non', 'multi', 'sub', 'pre', 'post', 'un', 'auto', 'cross', 'read'];
const NON_COMPOUNDS = new Set(['notice', 'nothing', 'uncle', 'under', 'until', 'union', 'unit', 'unique', 'auto', 'read', 'ready', 'real', 'post', 'multi']);

function splitCompound(token) {
  const parts = QueryProcessor.splitIdentifiers(token);
  const result = [];
  for (const p of parts) {
    result.push(p);
    const lower = p.toLowerCase();
    if (NON_COMPOUNDS.has(lower)) continue;
    for (const prefix of PREFIXES) {
      if (lower.startsWith(prefix) && lower.length >= prefix.length + 4) {
        const rest = lower.slice(prefix.length);
        if (!NON_COMPOUNDS.has(rest)) {
          result.push(p.slice(0, prefix.length));
          result.push(p.slice(prefix.length));
        }
      }
    }
  }
  return result;
}

async function testSimulatedRules() {
  console.log('Testing splitCompound:');
  console.log('checkNonnegative ->', splitCompound('checkNonnegative'));
  console.log('multithreaded ->', splitCompound('multithreaded'));
  console.log('subnetwork ->', splitCompound('subnetwork'));
  console.log('unit ->', splitCompound('unit'));
  console.log('uncle ->', splitCompound('uncle'));
  console.log('notice ->', splitCompound('notice'));

  // DIAG-04 test
  const guavaPath = 'D:/clones/guava';
  const guavaPin = 'db74bd2fdac443223d45e6fc5c66548542be1081';
  execFileSync('git', ['checkout', '--detach', guavaPin], { cwd: guavaPath, stdio: 'pipe' });
  const guavaIndex = await indexRepository(guavaPath, { forceRebuild: false });
  const q4_raw = 'Check that integer index is non-negative and throw appropriate exception';

  let target04 = null;
  for (const sym of guavaIndex.symbols.values()) {
    if (sym.filePath.replace(/\\/g, '/').includes('CollectPreconditions.java') && sym.name === 'checkNonnegative') {
      target04 = sym;
      break;
    }
  }

  const origQ4 = QueryProcessor.process(q4_raw);
  const retriever = new StructuralRetriever(guavaIndex);
  const origScore4 = retriever._scoreCandidate(origQ4, target04, new Set());
  console.log('Orig DIAG-04 score:', origScore4.score);

  // Simulated Q4 with compound rule & multi-token compound formation
  const modQ4 = { ...origQ4, terms: [...origQ4.terms, 'nonnegative'] };
  const modTargetSubtokens = splitCompound(target04.name).map(t => t.toLowerCase());
  console.log('Target04 decomposed subtokens:', modTargetSubtokens);

  // Undertow test
  const undertowPath = 'D:/clones/undertow';
  const undertowPin = 'cf3abec9145bb4660659add41b97866ff6ef9c31';
  execFileSync('git', ['checkout', '--detach', undertowPin], { cwd: undertowPath, stdio: 'pipe' });
  const undertowIndex = await indexRepository(undertowPath, { forceRebuild: false });
  const q7_raw = 'Process and dispatch websocket binary and text frames internally across stream sink channel';

  let target07 = null;
  for (const sym of undertowIndex.symbols.values()) {
    if (sym.filePath.replace(/\\/g, '/').includes('WebSocket07FrameSinkChannel.java') && sym.name === 'sendInternal') {
      target07 = sym;
      break;
    }
  }

  const origQ7 = QueryProcessor.process(q7_raw);
  const uRetriever = new StructuralRetriever(undertowIndex);
  const origScore7 = uRetriever._scoreCandidate(origQ7, target07, new Set());
  console.log('Orig DIAG-07 score:', origScore7.score);

  // With synonym dispatch -> send
  const modQ7 = { ...origQ7, terms: [...origQ7.terms, 'send'] };
  const modScore7 = uRetriever._scoreCandidate(modQ7, target07, new Set());
  console.log('Mod DIAG-07 score with synonym:', modScore7.score);
}

testSimulatedRules().catch(console.error);
