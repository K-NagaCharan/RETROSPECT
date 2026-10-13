#!/usr/bin/env node
const path = require('path');
const { indexRepository, searchCurrentCode } = require('../src/structural');
const StructuralEvaluator = require('../src/evaluation/StructuralEvaluator');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (command === 'index') {
    const repoPath = args[1] || '.';
    const outIdx = args.indexOf('--output');
    const persistPath = outIdx !== -1 ? args[outIdx + 1] : null;

    console.log(`[Retrospect] Indexing repository at '${path.resolve(repoPath)}'...`);
    const startTime = Date.now();
    const index = await indexRepository(repoPath, { persistPath });
    const duration = Date.now() - startTime;

    console.log(`[Retrospect] Indexing completed in ${duration}ms:`);
    console.log(`  - Total files indexed: ${index.files.size}`);
    console.log(`  - Total symbols indexed: ${index.symbols.size}`);
    if (persistPath) {
      console.log(`  - Saved index snapshot to: ${persistPath}`);
    }
  } else if (command === 'search') {
    const repoPath = args[1];
    const query = args[2];

    if (!repoPath || !query) {
      console.error('Usage: retrospect-structural search <repoPath> "<query>" [--limit <n>] [--budget <tokens>]');
      process.exit(1);
    }

    const limitIdx = args.indexOf('--limit');
    const maxResults = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 5;

    const budgetIdx = args.indexOf('--budget');
    const tokenBudget = budgetIdx !== -1 ? parseInt(args[budgetIdx + 1], 10) : 4000;

    const res = await searchCurrentCode(repoPath, query, { maxResults, tokenBudget });

    console.log(`\n============================================================`);
    console.log(`Query: "${res.query}"`);
    console.log(`Latency: ${res.latencyMs}ms | Candidates: ${res.totalCandidatesGenerated} | Returned: ${res.returnedCount}`);
    console.log(`============================================================\n`);

    if (res.results.length === 0) {
      console.log('No matching symbols found.');
    } else {
      res.results.forEach((item, idx) => {
        console.log(`[#${idx + 1}] ${item.kind.toUpperCase()}: ${item.name} (Score: ${item.score})`);
        console.log(`  File: ${item.filePath}:${item.range.startLine}-${item.range.endLine}`);
        console.log(`  Signature: ${item.signature}`);
        if (item.matchReasons.length > 0) {
          console.log(`  Match Reasons: ${item.matchReasons.join('; ')}`);
        }
        if (item.docstring) {
          console.log(`  Docstring: ${item.docstring.split('\n')[0].slice(0, 100)}...`);
        }
        console.log(`  Code Preview:`);
        const preview = item.source.split('\n').slice(0, 8).map(l => '    ' + l).join('\n');
        console.log(preview);
        if (item.source.split('\n').length > 8) console.log('    ...');
        console.log('');
      });
    }
  } else if (command === 'evaluate') {
    const dataIdx = args.indexOf('--dataset');
    const datasetPath = dataIdx !== -1 ? args[dataIdx + 1] : path.resolve(__dirname, '../data/structural_eval_benchmark.json');

    console.log(`[Retrospect] Running structural evaluation benchmark...`);
    const evaluator = new StructuralEvaluator();
    const results = await evaluator.runEvaluation(datasetPath);
    evaluator.printReport(results);
  } else {
    console.error(`Unknown command: '${command}'`);
    printHelp();
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Retrospect Structural Current-Code Retrieval CLI

Usage:
  node scripts/structural_cli.js index <repoPath> [--output <indexPath>]
  node scripts/structural_cli.js search <repoPath> "<query>" [--limit <num>] [--budget <tokens>]
  node scripts/structural_cli.js evaluate [--dataset <path>]

Examples:
  node scripts/structural_cli.js index ./
  node scripts/structural_cli.js search ./ "Where is user authentication handled?"
  node scripts/structural_cli.js search ./ "validateImageUpload" --limit 3
  node scripts/structural_cli.js evaluate
`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[Retrospect Error]:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
