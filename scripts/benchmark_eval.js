const fs = require('fs');
const path = require('path');
const { FunctionMatcher, SymbolRecord } = require('../src/index');

const benchmarkPath = 'd:/base papers considered/laya testing/data/benchmark.json';
const data = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
const valItems = data.filter(x => x.split === 'val');
const testItems = data.filter(x => x.split === 'test');

function testParams(thModerate, thAmbiguity) {
  const matcher = new FunctionMatcher({
    thresholdModerate: thModerate,
    thresholdAmbiguityDelta: thAmbiguity
  });

  function evalSplit(items) {
    let correct = 0;
    for (const item of items) {
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

      const result = matcher.match(target, candidates, {
        filePath: item.target_function.file_path
      });

      let pred = 'NEW';
      if (result.selected) {
        pred = result.selected.id;
      }

      if (pred === item.ground_truth_id) {
        correct++;
      }
    }
    return correct / items.length;
  }

  return {
    valAcc: evalSplit(valItems),
    testAcc: evalSplit(testItems)
  };
}

console.log('--- Parameter Sweep on Validation Split (112 instances) ---');
for (const th of [0.35, 0.40, 0.45, 0.48, 0.50]) {
  for (const amb of [0.01, 0.02, 0.05, 0.08]) {
    const res = testParams(th, amb);
    if (res.valAcc >= 1.0) {
      console.log(`thModerate=${th}, ambDelta=${amb} -> Val: ${(res.valAcc * 100).toFixed(2)}%, Test: ${(res.testAcc * 100).toFixed(2)}%`);
    }
  }
}
