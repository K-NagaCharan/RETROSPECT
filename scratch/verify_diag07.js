const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 1. Load Baseline QueryProcessor logic (from HEAD commit)
const baselineQPSource = execFileSync('git', ['show', 'HEAD:src/structural/query/QueryProcessor.js']).toString('utf8');
const baselineModule = { exports: {} };
const baselineFn = new Function('module', 'exports', baselineQPSource);
baselineFn(baselineModule, baselineModule.exports);
const BaselineQueryProcessor = baselineModule.exports;

// 2. Load Modified QueryProcessor (from current working tree)
const ModifiedQueryProcessor = require('../src/structural/query/QueryProcessor');

// 3. Load retrieval modules
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const HistoricalRetrievalAdapter = require('../src/retrieval/HistoricalRetrievalAdapter');
const { fuseRRFv2 } = require('../src/retrieval/RRFv2');

const undertowPath = 'D:/clones/undertow';
const undertowPin = 'cf3abec9145bb4660659add41b97866ff6ef9c31';

execFileSync('git', ['checkout', '--detach', undertowPin], { cwd: undertowPath, stdio: 'pipe' });

// Diagnostic matching function
function isTargetMatch(cand, target) {
  if (!cand || !target) return false;
  const normCandPath = (cand.filePath || '').replace(/\\/g, '/').toLowerCase();
  const normTarget = (target.file_path || '').replace(/\\/g, '/').toLowerCase();
  const fileMatch = normCandPath.endsWith(normTarget) || normTarget.endsWith(normCandPath);
  if (!fileMatch) return false;

  const targetName = target.symbol_name || '';
  const targetShort = target.short_name || targetName.split('.').pop();
  const candName = cand.name || '';
  const candQName = cand.qualifiedName || '';

  return candName === targetShort ||
         candName === targetName ||
         (candQName && (candQName === targetName || candQName.endsWith('.' + targetShort)));
}

async function verifyDiag07() {
  console.log('=== TASK 2: DIAG-07 BASELINE VS MODIFIED RECONSTRUCTION ===\n');

  const structuralIndex = await indexRepository(undertowPath, { forceRebuild: false });
  const allSymbols = Array.from(structuralIndex.symbols.values());

  const histAdapter = new HistoricalRetrievalAdapter();
  const histResult = await histAdapter.indexRepositoryHistory(undertowPath, allSymbols, {
    maxCommits: 50,
    startCommit: undertowPin
  });
  const candidates = allSymbols.map(sym => ({
    symbol: sym,
    historyProfile: histResult.profileMap.get(sym.id) || null
  }));

  const queryText = 'Process and dispatch websocket binary and text frames internally across stream sink channel';

  // Authentic target definition
  const authenticTarget = {
    file_path: 'core/src/main/java/io/undertow/websockets/core/protocol/version07/WebSocket07FrameSinkChannel.java',
    symbol_name: 'WebSocket07FrameSinkChannel.sendInternal',
    short_name: 'sendInternal'
  };

  // Erroneous target definition (original script typo)
  const flawedTarget = {
    file_path: 'core/src/main/java/io/undertow/websockets/core/WebSocket07FrameSinkChannel.java',
    symbol_name: 'WebSocket07FrameSinkChannel.sendInternal',
    short_name: 'sendInternal'
  };

  // Locate candidate symbol in index
  const matchingSymbols = allSymbols.filter(s => isTargetMatch(s, authenticTarget));
  console.log(`Target symbols matched in index: ${matchingSymbols.length}`);
  const targetSymbol = matchingSymbols[0];
  console.log('Target symbol identity:', {
    id: targetSymbol.id,
    name: targetSymbol.name,
    qualifiedName: targetSymbol.qualifiedName,
    filePath: targetSymbol.filePath
  });

  // Verify flawedTarget matching
  const flawedMatches = allSymbols.filter(s => isTargetMatch(s, flawedTarget));
  console.log(`Flawed target definition matches: ${flawedMatches.length} (evaluates to false due to missing protocol/version07)`);

  const retriever = new StructuralRetriever(structuralIndex);

  // RUN 1: Baseline QueryProcessor with Authentic Target
  const qBase = BaselineQueryProcessor.process(queryText);
  console.log('\n--- Baseline Query Representation ---');
  console.log('terms:', qBase.terms);
  console.log('exactCandidateNames:', qBase.exactCandidateNames);

  const b1_base = retriever.rankCandidates(qBase, allSymbols);
  b1_base.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
  let rank_b1_base = null, score_b1_base = 0;
  for (let i = 0; i < b1_base.length; i++) {
    if (b1_base[i].score > 0 && isTargetMatch(b1_base[i].symbol, authenticTarget)) {
      rank_b1_base = i + 1;
      score_b1_base = b1_base[i].score;
      break;
    }
  }

  const b2_base = histAdapter.rankHistoricalOnly(qBase, candidates, {}, { enforceCandidateParity: true });
  b2_base.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
  let rank_b2_base = null, score_b2_base = 0;
  for (let i = 0; i < b2_base.length; i++) {
    if (b2_base[i].score > 0 && isTargetMatch(b2_base[i].symbol, authenticTarget)) {
      rank_b2_base = i + 1;
      score_b2_base = b2_base[i].score;
      break;
    }
  }

  const b4_base = fuseRRFv2(b1_base, b2_base, { topK: 100, k: 60 });
  let rank_b4_base = null, score_b4_base = 0;
  for (let i = 0; i < b4_base.length; i++) {
    if (isTargetMatch(b4_base[i].symbol, authenticTarget)) {
      rank_b4_base = i + 1;
      score_b4_base = b4_base[i].score;
      break;
    }
  }

  // RUN 2: Modified QueryProcessor with Authentic Target
  const qMod = ModifiedQueryProcessor.process(queryText);
  console.log('\n--- Modified Query Representation ---');
  console.log('terms:', qMod.terms);
  console.log('exactCandidateNames:', qMod.exactCandidateNames);

  const b1_mod = retriever.rankCandidates(qMod, allSymbols);
  b1_mod.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
  let rank_b1_mod = null, score_b1_mod = 0;
  for (let i = 0; i < b1_mod.length; i++) {
    if (b1_mod[i].score > 0 && isTargetMatch(b1_mod[i].symbol, authenticTarget)) {
      rank_b1_mod = i + 1;
      score_b1_mod = b1_mod[i].score;
      break;
    }
  }

  const b2_mod = histAdapter.rankHistoricalOnly(qMod, candidates, {}, { enforceCandidateParity: true });
  b2_mod.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
  let rank_b2_mod = null, score_b2_mod = 0;
  for (let i = 0; i < b2_mod.length; i++) {
    if (b2_mod[i].score > 0 && isTargetMatch(b2_mod[i].symbol, authenticTarget)) {
      rank_b2_mod = i + 1;
      score_b2_mod = b2_mod[i].score;
      break;
    }
  }

  const b4_mod = fuseRRFv2(b1_mod, b2_mod, { topK: 100, k: 60 });
  let rank_b4_mod = null, score_b4_mod = 0;
  for (let i = 0; i < b4_mod.length; i++) {
    if (isTargetMatch(b4_mod[i].symbol, authenticTarget)) {
      rank_b4_mod = i + 1;
      score_b4_mod = b4_mod[i].score;
      break;
    }
  }

  console.log('\n=== DIAG-07 RESULTS RECONSTRUCTION ===');
  console.log('Configuration | Flawed Baseline | Corrected Baseline | Modified QueryProcessor');
  console.log(`B1 Rank       | null            | ${rank_b1_base}                | ${rank_b1_mod}`);
  console.log(`B1 Score      | 0.0000          | ${score_b1_base.toFixed(4)}         | ${score_b1_mod.toFixed(4)}`);
  console.log(`B2 Rank       | null            | ${rank_b2_base}                | ${rank_b2_mod}`);
  console.log(`B2 Score      | 0.0000          | ${score_b2_base.toFixed(4)}         | ${score_b2_mod.toFixed(4)}`);
  console.log(`B4 Rank       | null            | ${rank_b4_base ?? 'null (>100)'}   | ${rank_b4_mod}`);
  console.log(`B4 Score      | 0.0000          | ${score_b4_base.toFixed(4)}         | ${score_b4_mod.toFixed(4)}`);
}

verifyDiag07().catch(console.error);
