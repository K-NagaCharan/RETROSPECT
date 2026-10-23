const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const clonesDir = 'D:/clones';
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');

const PREFIXES = ['non', 'multi', 'sub', 'pre', 'post', 'un', 'auto', 'cross', 'read'];
const NON_COMPOUNDS = new Set(['notice', 'nothing', 'uncle', 'under', 'until', 'union', 'unit', 'unique', 'auto', 'read', 'ready', 'real', 'post', 'multi']);

const ACTION_SYNONYMS = {
  'dispatch': 'send',
  'transmit': 'send',
  'retrieve': 'get',
  'fetch': 'get',
  'construct': 'build',
  'create': 'build'
};

function splitCompound(token) {
  if (!token) return [];
  const parts = token.split(/[_.\-$]+/);
  const result = [];
  for (const p of parts) {
    if (!p) continue;
    const camelParts = p.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                        .split(/\s+/);
    for (const cp of camelParts) {
      if (!cp) continue;
      result.push(cp);
      const lower = cp.toLowerCase();
      if (!NON_COMPOUNDS.has(lower)) {
        for (const pfx of PREFIXES) {
          if (lower.startsWith(pfx) && lower.length >= pfx.length + 4) {
            const base = lower.slice(pfx.length);
            if (!NON_COMPOUNDS.has(base)) {
              result.push(cp.slice(0, pfx.length));
              result.push(cp.slice(pfx.length));
              break;
            }
          }
        }
      }
    }
  }
  return result;
}

function processWithPrefixOnly(rawQuery) {
  const baseResult = QueryProcessor.process(rawQuery);
  if (baseResult.isEmpty) return baseResult;
  const terms = [...baseResult.terms];
  for (let i = 0; i < baseResult.terms.length - 1; i++) {
    const t1 = baseResult.terms[i];
    const t2 = baseResult.terms[i + 1];
    if (PREFIXES.includes(t1) && t2.length >= 4 && !NON_COMPOUNDS.has(t2)) {
      const compound = t1 + t2;
      if (!terms.includes(compound)) terms.push(compound);
    }
  }
  return { ...baseResult, terms, stemmedTerms: terms.map(t => QueryProcessor.stem(t)) };
}

function processWithBoth(rawQuery) {
  const res = processWithPrefixOnly(rawQuery);
  const terms = [...res.terms];
  for (const t of res.terms) {
    if (ACTION_SYNONYMS[t] && !terms.includes(ACTION_SYNONYMS[t])) {
      terms.push(ACTION_SYNONYMS[t]);
    }
  }
  return { ...res, terms, stemmedTerms: terms.map(t => QueryProcessor.stem(t)) };
}

async function testIsolated() {
  // DIAG-04 on Guava
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

  const retriever04 = new StructuralRetriever(guavaIndex);
  const allGuava = Array.from(guavaIndex.symbols.values());

  const origSplit = QueryProcessor.splitIdentifiers;

  // 1. Base
  const baseQ4 = QueryProcessor.process(q4_raw);
  const baseRank04 = retriever04.rankCandidates(baseQ4, allGuava);
  const baseIdx04 = baseRank04.findIndex(r => r.symbol.id === target04.id);
  console.log('DIAG-04 Base rank:', baseIdx04 >= 0 ? baseIdx04 + 1 : 'null', 'score:', baseIdx04 >= 0 ? baseRank04[baseIdx04].score : 0);

  // 2. Prefix only
  QueryProcessor.splitIdentifiers = splitCompound;
  const pfxQ4 = processWithPrefixOnly(q4_raw);
  const pfxRank04 = retriever04.rankCandidates(pfxQ4, allGuava);
  const pfxIdx04 = pfxRank04.findIndex(r => r.symbol.id === target04.id);
  console.log('DIAG-04 Prefix-only rank:', pfxIdx04 >= 0 ? pfxIdx04 + 1 : 'null', 'score:', pfxIdx04 >= 0 ? pfxRank04[pfxIdx04].score : 0);

  // DIAG-07 on Undertow
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

  const retriever07 = new StructuralRetriever(undertowIndex);
  const allUndertow = Array.from(undertowIndex.symbols.values());

  // Base
  QueryProcessor.splitIdentifiers = origSplit;
  const baseQ7 = QueryProcessor.process(q7_raw);
  const baseRank07 = retriever07.rankCandidates(baseQ7, allUndertow);
  const baseIdx07 = baseRank07.findIndex(r => r.symbol.id === target07.id);
  console.log('DIAG-07 Base rank:', baseIdx07 >= 0 ? baseIdx07 + 1 : 'null', 'score:', baseIdx07 >= 0 ? baseRank07[baseIdx07].score : 0);

  // Prefix only
  QueryProcessor.splitIdentifiers = splitCompound;
  const pfxQ7 = processWithPrefixOnly(q7_raw);
  const pfxRank07 = retriever07.rankCandidates(pfxQ7, allUndertow);
  const pfxIdx07 = pfxRank07.findIndex(r => r.symbol.id === target07.id);
  console.log('DIAG-07 Prefix-only rank:', pfxIdx07 >= 0 ? pfxIdx07 + 1 : 'null', 'score:', pfxIdx07 >= 0 ? pfxRank07[pfxIdx07].score : 0);

  // Both
  const bothQ7 = processWithBoth(q7_raw);
  const bothRank07 = retriever07.rankCandidates(bothQ7, allUndertow);
  const bothIdx07 = bothRank07.findIndex(r => r.symbol.id === target07.id);
  console.log('DIAG-07 Both rank:', bothIdx07 >= 0 ? bothIdx07 + 1 : 'null', 'score:', bothIdx07 >= 0 ? bothRank07[bothIdx07].score : 0);

  QueryProcessor.splitIdentifiers = origSplit;
}

testIsolated().catch(console.error);
