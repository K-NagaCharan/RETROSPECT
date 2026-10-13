const path = require('path');
const StructuralEvaluator = require('../src/evaluation/StructuralEvaluator');

async function run() {
  const datasetPath = path.resolve(__dirname, '../data/structural_eval_benchmark.json');
  console.log(`[Evaluation] Loading benchmark dataset from: ${datasetPath}`);

  const evaluator = new StructuralEvaluator();

  // Run on Dev split
  console.log('\n>>> Evaluating DEV split (tuning / validation)...');
  const devReport = await evaluator.runEvaluation(datasetPath, { splitFilter: 'dev' });
  evaluator.printReport(devReport);

  // Run on Held-Out TEST split
  console.log('\n>>> Evaluating HELD-OUT TEST split (final evaluation)...');
  const testReport = await evaluator.runEvaluation(datasetPath, { splitFilter: 'test' });
  evaluator.printReport(testReport);

  // Also full dataset
  console.log('\n>>> Evaluating ALL benchmark instances...');
  const allReport = await evaluator.runEvaluation(datasetPath, { splitFilter: 'all' });
  evaluator.printReport(allReport);
}

if (require.main === module) {
  run().catch(err => {
    console.error('Evaluation failed:', err);
    process.exit(1);
  });
}

module.exports = { run };
