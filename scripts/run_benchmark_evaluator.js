#!/usr/bin/env node
/**
 * scripts/run_benchmark_evaluator.js
 *
 * CLI execution harness for the rebuilt Retrospect benchmark evaluator.
 *
 * Usage:
 *   node scripts/run_benchmark_evaluator.js --dataset path/to/dataset.json [options]
 *
 * Options:
 *   --split <dev|val>                 Evaluate only cases matching the given split (default: all unsealed)
 *   --clones-dir <dir>                Directory containing git repository clones (default: D:/clones)
 *   --horizon <int>                   Historical commit lookback horizon (default: 50)
 *   --output-dir <dir>                Directory to save evaluation artifacts (default: reports/evaluator_runs/<timestamp>)
 *   --allow-sealed-test               Explicit confirmation override to permit evaluation of test_confirmatory split
 *   --no-git-verify                   Disable git cat-file object checks during loader validation
 *   --bootstrap-replicates <int>      Number of cluster bootstrap iterations (default: 1000)
 *   --help                            Display usage instructions
 */

const fs = require('fs');
const path = require('path');
const RetrospectEvaluator = require('../src/evaluation/RetrospectEvaluator');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dataset: null,
    split: null,
    clonesDir: 'D:/clones',
    horizon: 50,
    outputDir: null,
    allowSealedTest: false,
    verifyGitTree: true,
    bootstrapReplicates: 1000
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dataset' && i + 1 < args.length) {
      options.dataset = args[++i];
    } else if (arg === '--split' && i + 1 < args.length) {
      options.split = args[++i].toLowerCase();
    } else if (arg === '--clones-dir' && i + 1 < args.length) {
      options.clonesDir = args[++i];
    } else if (arg === '--horizon' && i + 1 < args.length) {
      options.horizon = parseInt(args[++i], 10);
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      options.outputDir = args[++i];
    } else if (arg === '--allow-sealed-test') {
      options.allowSealedTest = true;
    } else if (arg === '--no-git-verify') {
      options.verifyGitTree = false;
    } else if (arg === '--bootstrap-replicates' && i + 1 < args.length) {
      options.bootstrapReplicates = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Retrospect Benchmark Evaluator (Git-First Harness)

Options:
  --dataset <path>             Benchmark JSON file path (Required)
  --split <dev|val>            Evaluate specific split partition
  --clones-dir <dir>           Path to cloned git repositories (Default: D:/clones)
  --horizon <int>              Commit lookback depth (Default: 50)
  --output-dir <dir>           Directory to write output reports and CSVs
  --allow-sealed-test          Confirm execution on sealed 'test_confirmatory' split
  --no-git-verify              Skip local git tree verification
  --bootstrap-replicates <int> Cluster bootstrap resamples (Default: 1000)
`);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('================================================================================');
  console.log('      RETROSPECT BENCHMARK EVALUATOR — REBUILT GIT-FIRST HARNESS               ');
  console.log('================================================================================');
  console.log(`Frozen Implementation Commit: 17ea399217737f8d5fe2c32c310b69c2f812b84d`);
  console.log(`Historical Diagnostic Status: FROZEN (Previous results marked LEGACY DIAGNOSTIC)`);
  console.log(`Historical Horizon:           ${options.horizon} commits`);
  console.log(`Clones Directory:             ${options.clonesDir}`);
  console.log(`Split Filter:                 ${options.split || 'all_unsealed'}`);
  console.log(`Allow Sealed Test:            ${options.allowSealedTest ? 'YES (OVERRIDE)' : 'NO (PROTECTED)'}`);
  console.log(`Bootstrap Replicates:         ${options.bootstrapReplicates}`);
  console.log('================================================================================\n');

  if (!options.dataset) {
    console.error('Error: --dataset argument is required.');
    console.error('Run with --help for full usage information.');
    process.exit(1);
  }

  const datasetPath = path.resolve(options.dataset);
  if (!fs.existsSync(datasetPath)) {
    console.error(`Error: Dataset file not found: '${datasetPath}'`);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.join(__dirname, '..', 'reports', 'evaluator_runs', `run_${timestamp}`);

  fs.mkdirSync(outputDir, { recursive: true });

  const evaluator = new RetrospectEvaluator({
    clonesDir: options.clonesDir,
    searchHorizon: options.horizon,
    allowSealedTest: options.allowSealedTest,
    verifyGitTree: options.verifyGitTree,
    targetSplit: options.split,
    bootstrapReplicates: options.bootstrapReplicates
  });

  console.log(`Loading and validating benchmark dataset from: ${datasetPath}...`);
  const results = await evaluator.evaluate(datasetPath);

  console.log(`\nValidation & Loading Summary:`);
  console.log(`  Total Cases Examined: ${results.loader_summary.total_examined}`);
  console.log(`  Valid Cases Loaded:   ${results.loader_summary.valid_count}`);
  console.log(`  Excluded Cases:       ${results.loader_summary.excluded_count}`);

  if (results.loader_summary.valid_count === 0) {
    console.warn('\nWarning: No valid benchmark cases available to evaluate.');
  } else {
    console.log('\n================================================================================');
    console.log('                          PRIMARY EVALUATION METRICS                            ');
    console.log('================================================================================');
    console.log('Configuration   | Success@10           | Recall@1             | MRR     | Abstention');
    console.log('--------------------------------------------------------------------------------');

    for (const [cfg, m] of Object.entries(results.metrics_summary)) {
      const name = cfg.padEnd(15);
      const s10Str = `${m.success_at_10.numerator}/${m.success_at_10.denominator} (${m.success_at_10.percentage}%)`.padEnd(20);
      const r1Str = `${m.recall_at_1.numerator}/${m.recall_at_1.denominator} (${m.recall_at_1.percentage}%)`.padEnd(20);
      const mrrStr = `${m.mrr.mean}`.padEnd(7);
      const abstStr = `${m.abstention.numerator}/${m.abstention.denominator} (${m.abstention.percentage}%)`;
      console.log(`${name} | ${s10Str} | ${r1Str} | ${mrrStr} | ${abstStr}`);
    }

    console.log('\n--- Cluster Bootstrap Uncertainty Estimates (95% CI) ---');
    for (const [cfg, m] of Object.entries(results.metrics_summary)) {
      if (m.success_at_10.bootstrap) {
        const b = m.success_at_10.bootstrap;
        console.log(`  ${cfg} Success@10: ${b.observed} [95% CI: ${b.ci_lower} .. ${b.ci_upper}] (Clusters: ${b.cluster_count})`);
      }
    }

    if (results.cluster_inventory.warning) {
      console.log(`\n${results.cluster_inventory.warning}`);
    }

    console.log('\n--- Paired Configuration Differences (Success@10) ---');
    for (const [comp, diff] of Object.entries(results.paired_differences)) {
      console.log(`  ${comp}: observed delta = ${diff.observed_delta >= 0 ? '+' : ''}${diff.observed_delta} [95% CI: ${diff.ci_lower} .. ${diff.ci_upper}]`);
    }

    console.log('\n--- Stratified Reporting ---');
    console.log('1. By Historical Identifier Presence:');
    console.table(results.stratified_report.by_historical_identifier);

    console.log('\n2. By Commit Distance Bands:');
    console.table(results.stratified_report.by_commit_distance_band);
  }

  // Save artifacts
  const resultsJsonPath = path.join(outputDir, 'per_case_results.json');
  fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nSaved JSON results to: ${resultsJsonPath}`);

  if (results.per_case_results.length > 0) {
    const csvContent = RetrospectEvaluator.generateCSV(results.per_case_results);
    const csvPath = path.join(outputDir, 'per_case_results.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`Saved CSV results to:  ${csvPath}`);
  }

  if (results.excluded_cases.length > 0) {
    const exclPath = path.join(outputDir, 'validation_exclusions.json');
    fs.writeFileSync(exclPath, JSON.stringify(results.excluded_cases, null, 2), 'utf-8');
    console.log(`Saved exclusions to:   ${exclPath}`);
  }

  console.log('\nEvaluator execution finished successfully.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('\nFatal Evaluator Error:', err);
    process.exit(1);
  });
}

module.exports = main;
