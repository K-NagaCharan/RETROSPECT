const fs = require('fs');
const path = require('path');
const { FunctionMatcher, SymbolRecord } = require('../src/index');

const benchmarkPath = 'd:/base papers considered/laya testing/data/benchmark.json';
const data = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
const valItems = data.filter(x => x.split === 'val');
const testItems = data.filter(x => x.split === 'test');

const matcher = new FunctionMatcher({
  thresholdModerate: 0.50,
  thresholdAmbiguityDelta: 0.08
});

function runEval(items) {
  const predsList = [];
  const latencies = [];

  for (const item of items) {
    const t0 = process.hrtime.bigint();

    const target = new SymbolRecord({
      name: item.target_function.name,
      source: item.target_function.source,
      filePath: item.target_function.file_path,
      language: item.language
    });

    const candidates = item.candidates.map(c => new SymbolRecord({
      id: c.candidate_id,
      name: c.name,
      source: c.source,
      filePath: c.file_path,
      language: item.language
    }));

    // Perform matching
    const matchResult = matcher.match(target, candidates, {
      filePath: item.target_function.file_path
    });

    const t1 = process.hrtime.bigint();
    const latMs = Number(t1 - t0) / 1e6;
    latencies.push(latMs);

    // Compute candidate scores map for MRR
    const scores = {};
    if (matchResult.rankedAlternatives && matchResult.rankedAlternatives.length > 0) {
      for (const alt of matchResult.rankedAlternatives) {
        scores[alt.id] = alt.score;
      }
    }
    if (matchResult.selected) {
      scores[matchResult.selected.id] = matchResult.score;
    }
    // Ensure all candidates have a score entry
    for (const c of item.candidates) {
      if (!(c.candidate_id in scores)) {
        scores[c.candidate_id] = 0.0;
      }
    }

    let prediction = 'NEW';
    let confidence = 0.5;

    if (matchResult.selected && matchResult.decisionStatus !== 'uncertain' && matchResult.decisionStatus !== 'no_match') {
      prediction = matchResult.selected.id;
      confidence = matchResult.score;
    } else {
      prediction = 'NEW';
      const maxScore = Math.max(0, ...Object.values(scores));
      confidence = Math.max(0.1, 1.0 - maxScore);
    }

    predsList.push({
      instance_id: item.instance_id,
      language: item.language,
      change_type: item.change_type,
      repository: item.repository,
      ground_truth_id: item.ground_truth_id,
      prediction,
      is_correct: prediction === item.ground_truth_id,
      confidence,
      scores,
      latency_ms: latMs
    });
  }

  return { predsList, latencies };
}

const { predsList: testPreds, latencies } = runEval(testItems);

// Calculate metrics identically to evaluator.py
const n = testPreds.length;
let correctTop1 = 0;
let rrTotal = 0;
let tpNew = 0, fpNew = 0, fnNew = 0, tnNew = 0;
let tpMatch = 0, fpMatch = 0, fnMatch = 0, tnMatch = 0;

for (const p of testPreds) {
  const gt = p.ground_truth_id;
  const pred = p.prediction;
  if (p.is_correct) correctTop1++;

  if (gt === 'NEW') {
    rrTotal += (pred === 'NEW' ? 1.0 : 0.0);
    if (pred === 'NEW') tpNew++;
    else fnNew++;
  } else {
    const sortedCands = Object.keys(p.scores).sort((a, b) => p.scores[b] - p.scores[a]);
    const rank = sortedCands.indexOf(gt) + 1;
    rrTotal += (rank > 0 ? 1.0 / rank : 0.0);
    if (pred === 'NEW') fpNew++;
    else tnNew++;
  }

  if (gt !== 'NEW') {
    if (pred === gt) tpMatch++;
    else fnMatch++;
  } else {
    if (pred !== 'NEW') fpMatch++;
    else tnMatch++;
  }
}

const precNew = (tpNew + fpNew > 0) ? tpNew / (tpNew + fpNew) : 0;
const recNew = (tpNew + fnNew > 0) ? tpNew / (tpNew + fnNew) : 0;
const f1New = (precNew + recNew > 0) ? (2 * precNew * recNew) / (precNew + recNew) : 0;
const fprNew = (fpNew + tnNew > 0) ? fpNew / (fpNew + tnNew) : 0;

const precMatch = (tpMatch + fpMatch > 0) ? tpMatch / (tpMatch + fpMatch) : 0;
const recMatch = (tpMatch + fnMatch > 0) ? tpMatch / (tpMatch + fnMatch) : 0;
const f1Match = (precMatch + recMatch > 0) ? (2 * precMatch * recMatch) / (precMatch + recMatch) : 0;
const macroF1 = (f1Match + f1New) / 2.0;

latencies.sort((a, b) => a - b);
const meanLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const medianLat = latencies[Math.floor(latencies.length / 2)];
const p95Lat = latencies[Math.floor(latencies.length * 0.95)];

console.log('--- Retrospect Evaluation on Held-Out Test Set (168 instances) ---');
console.log('Count:            ', n);
console.log('Top-1 Accuracy:   ', (correctTop1 / n * 100).toFixed(2) + '% (' + correctTop1 + '/' + n + ')');
console.log('MRR:              ', (rrTotal / n).toFixed(4));
console.log('Macro-F1:         ', macroF1.toFixed(4));
console.log('Match Precision:  ', precMatch.toFixed(4));
console.log('Match Recall:     ', recMatch.toFixed(4));
console.log('Match F1:         ', f1Match.toFixed(4));
console.log('NEW Precision:    ', precNew.toFixed(4));
console.log('NEW Recall:       ', recNew.toFixed(4));
console.log('NEW F1:           ', f1New.toFixed(4));
console.log('NEW FPR:          ', fprNew.toFixed(4));
console.log('Mean Latency:     ', meanLat.toFixed(3), 'ms');
console.log('Median Latency:   ', medianLat.toFixed(3), 'ms');
console.log('P95 Latency:      ', p95Lat.toFixed(3), 'ms');
