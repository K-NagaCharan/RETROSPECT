const fs = require('fs');
const path = require('path');
const HistoryEvaluator = require('./HistoryEvaluator');

function run() {
  const datasetPath = path.resolve(__dirname, 'benchmarks/labeled_dataset.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found at ${datasetPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(datasetPath, 'utf8');
  const dataset = JSON.parse(raw);

  const evaluator = new HistoryEvaluator();
  const results = evaluator.evaluate(dataset);

  console.log('\n================================================================');
  console.log('       RETROSPECT HISTORICAL RETRIEVAL EVALUATION REPORT        ');
  console.log('================================================================\n');
  console.log(`Total Ground-Truth Examples:       ${results.totalExamples}`);
  console.log(`Top-1 Matching Accuracy:          ${results.top1AccuracyPercent}%`);
  console.log(`Change Category Accuracy:         ${results.categoryAccuracyPercent}%`);
  console.log(`False Historical Match Rate:      ${results.falseHistoricalMatchRatePercent}%`);
  console.log(`Uncertain / No-Match Rate:        ${results.uncertainRatePercent}%`);
  console.log(`Average Matching Latency:         ${results.avgLatencyMs} ms\n`);

  console.log('--- Performance Grouped by Target Language ---');
  console.table(results.byLanguage);

  console.log('\n--- Performance Grouped by Change Category ---');
  console.table(results.byCategory);

  console.log('\nEvaluation completed successfully.\n');
}

if (require.main === module) {
  run();
}

module.exports = run;
