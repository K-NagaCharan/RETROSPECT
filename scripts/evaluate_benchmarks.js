const fs = require('fs');
const path = require('path');
const { indexRepository, searchCurrentCode } = require('../src/structural');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');

async function runEvaluation(datasetFile, splitName) {
  const datasetPath = path.resolve(__dirname, '..', datasetFile);
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log('================================================================================');
  console.log(`        RETROSPECT STRUCTURAL RETRIEVAL EVALUATION (${splitName.toUpperCase()} SPLIT)`);
  console.log('================================================================================');
  console.log(`Evaluating ${dataset.length} queries across authentic repositories: Bottle, Express, Zod, Gson.\n`);

  const repos = [...new Set(dataset.map(d => d.repo_path))];
  const indexStats = {};
  const indexMap = {};

  for (const relRepoPath of repos) {
    const fullPath = path.resolve(__dirname, '..', relRepoPath);
    const t0 = Date.now();
    const idx = await indexRepository(fullPath, { forceRebuild: false });
    const elapsed = Date.now() - t0;
    indexStats[relRepoPath] = {
      indexingTimeMs: elapsed,
      filesCount: idx.files.size,
      symbolsCount: idx.symbols.size
    };
    indexMap[relRepoPath] = idx;
    console.log(`[Indexed] ${relRepoPath}: ${idx.files.size} files, ${idx.symbols.size} symbols in ${elapsed}ms.`);
  }

  console.log('\n--- Evaluating Queries ---\n');

  const records = [];
  const latencies = [];

  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    const fullRepoPath = path.resolve(__dirname, '..', item.repo_path);
    const idx = indexMap[item.repo_path];
    const retriever = new StructuralRetriever(idx);

    const q = QueryProcessor.process(item.query);
    const candidates = retriever.generateCandidates(q);
    const candidateNames = new Set(candidates.map(c => c.name));

    const tStart = Date.now();
    const searchRes = await searchCurrentCode(fullRepoPath, item.query, { maxResults: 10 });
    const latency = Date.now() - tStart;
    latencies.push(latency);

    const returnedNames = searchRes.results.map(r => r.name);
    const expectedSet = new Set(item.expected_symbols);
    const isNoResult = item.is_no_result;

    let candidateRecall = false;
    let hitAt1 = false;
    let hitAt5 = false;
    let hitAt10 = false;
    let reciprocalRank = 0.0;
    let precisionAt1 = 0.0;
    let precisionAt5 = 0.0;

    if (isNoResult) {
      const correctlyEmpty = returnedNames.length === 0;
      hitAt1 = correctlyEmpty;
      hitAt5 = correctlyEmpty;
      hitAt10 = correctlyEmpty;
      reciprocalRank = correctlyEmpty ? 1.0 : 0.0;
      precisionAt1 = correctlyEmpty ? 1.0 : 0.0;
      precisionAt5 = correctlyEmpty ? 1.0 : 0.0;
      candidateRecall = correctlyEmpty;
    } else {
      candidateRecall = item.expected_symbols.some(name => candidateNames.has(name));

      for (let r = 0; r < returnedNames.length; r++) {
        if (expectedSet.has(returnedNames[r])) {
          reciprocalRank = 1.0 / (r + 1);
          if (r < 1) hitAt1 = true;
          if (r < 5) hitAt5 = true;
          if (r < 10) hitAt10 = true;
          break;
        }
      }

      if (returnedNames.length > 0 && expectedSet.has(returnedNames[0])) {
        precisionAt1 = 1.0;
      }

      const top5 = returnedNames.slice(0, 5);
      if (top5.length > 0) {
        const matches = top5.filter(n => expectedSet.has(n)).length;
        precisionAt5 = matches / top5.length;
      }
    }

    const rec = {
      queryId: item.query_id,
      query: item.query,
      language: item.language,
      repository: item.repository,
      category: item.category,
      isNoResult,
      expectedSymbols: item.expected_symbols,
      candidateRecall,
      hitAt1,
      hitAt5,
      hitAt10,
      reciprocalRank,
      precisionAt1,
      precisionAt5,
      returnedTop5: searchRes.results.slice(0, 5).map(r => ({
        name: r.name,
        kind: r.kind,
        file: r.filePath,
        line: r.startLine,
        score: Number(r.score.toFixed(4)),
        reasons: r.matchReasons
      })),
      latencyMs: latency
    };

    records.push(rec);

    const statusStr = isNoResult
      ? (hitAt1 ? 'PASS (0 results, true negative)' : `FAIL (${returnedNames.length} returned, false positive)`)
      : (hitAt1 ? 'PASS (Rank 1 hit)' : (hitAt5 ? `PASS (Rank <= 5, RR=${reciprocalRank.toFixed(2)})` : (candidateRecall ? 'RANKING MISS' : 'CANDIDATE MISS')));

    console.log(`[#${i + 1}] [${item.repository}] "${item.query}" -> ${statusStr}`);
    if (!hitAt1 && !isNoResult) {
      console.log(`     Expected: ${JSON.stringify(item.expected_symbols)}`);
      console.log(`     Got: ${JSON.stringify(returnedNames.slice(0, 3))}`);
    }
  }

  // Calculate separate metrics for Answerable vs Unanswerable (No-Result) Queries
  const answerable = records.filter(r => !r.isNoResult);
  const unanswerable = records.filter(r => r.isNoResult);

  function computeAnswerableMetrics(recs) {
    const n = recs.length;
    if (n === 0) return { count: 0, candidateRecall: 0, recallAt1: 0, recallAt5: 0, recallAt10: 0, mrr: 0, precisionAt1: 0, precisionAt5: 0 };
    const candHits = recs.filter(r => r.candidateRecall).length;
    const h1 = recs.filter(r => r.hitAt1).length;
    const h5 = recs.filter(r => r.hitAt5).length;
    const h10 = recs.filter(r => r.hitAt10).length;
    const totalRR = recs.reduce((a, r) => a + r.reciprocalRank, 0);
    const totalP1 = recs.reduce((a, r) => a + r.precisionAt1, 0);
    const totalP5 = recs.reduce((a, r) => a + r.precisionAt5, 0);

    return {
      count: n,
      candidateRecall: Number(((candHits / n) * 100).toFixed(1)),
      recallAt1: Number(((h1 / n) * 100).toFixed(1)),
      recallAt5: Number(((h5 / n) * 100).toFixed(1)),
      recallAt10: Number(((h10 / n) * 100).toFixed(1)),
      mrr: Number((totalRR / n).toFixed(4)),
      precisionAt1: Number(((totalP1 / n) * 100).toFixed(1)),
      precisionAt5: Number(((totalP5 / n) * 100).toFixed(1))
    };
  }

  function computeNoResultMetrics(recs) {
    const n = recs.length;
    if (n === 0) return { count: 0, trueNegatives: 0, falsePositives: 0, accuracy: 100, precision: 100, recall: 100 };
    const tn = recs.filter(r => r.hitAt1).length;
    const fp = n - tn;
    return {
      count: n,
      trueNegatives: tn,
      falsePositives: fp,
      accuracy: Number(((tn / n) * 100).toFixed(1)),
      precision: Number(((tn / (tn + fp)) * 100).toFixed(1)),
      recall: Number(((tn / n) * 100).toFixed(1))
    };
  }

  const ansMetrics = computeAnswerableMetrics(answerable);
  const noResMetrics = computeNoResultMetrics(unanswerable);

  // Breakdown per repository (answerable)
  const perRepo = {};
  for (const repo of ['bottle', 'express', 'zod', 'gson']) {
    perRepo[repo] = computeAnswerableMetrics(answerable.filter(r => r.repository === repo));
  }

  // Breakdown per category
  const perCategory = {};
  const cats = [...new Set(records.map(r => r.category))];
  for (const cat of cats) {
    if (cat === 'no_result') {
      perCategory[cat] = computeNoResultMetrics(records.filter(r => r.category === cat));
    } else {
      perCategory[cat] = computeAnswerableMetrics(records.filter(r => r.category === cat));
    }
  }

  latencies.sort((a, b) => a - b);
  const meanLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const medLat = latencies[Math.floor(latencies.length / 2)] || 0;
  const p95Lat = latencies[Math.floor(latencies.length * 0.95)] || 0;

  console.log('\n================================================================================');
  console.log(`                  RETRIEVAL RESULTS SUMMARY (${splitName.toUpperCase()} SPLIT)`);
  console.log('================================================================================');
  console.log(`Evaluated ${dataset.length} total queries (${answerable.length} answerable, ${unanswerable.length} unanswerable).`);
  console.log(`Latency: Mean ${meanLat.toFixed(2)}ms | Median ${medLat}ms | p95 ${p95Lat}ms\n`);

  console.log('--- Performance on Answerable Queries ---');
  console.log(`  Candidate Recall:   ${ansMetrics.candidateRecall}%`);
  console.log(`  Recall@1:           ${ansMetrics.recallAt1}%`);
  console.log(`  Recall@5:           ${ansMetrics.recallAt5}%`);
  console.log(`  Recall@10:          ${ansMetrics.recallAt10}%`);
  console.log(`  MRR:                ${ansMetrics.mrr}`);
  console.log(`  Precision@1:        ${ansMetrics.precisionAt1}%`);
  console.log(`  Precision@5:        ${ansMetrics.precisionAt5}%\n`);

  console.log('--- Unanswerable Queries (No-Result Detection) ---');
  console.log(`  Total No-Result:    ${noResMetrics.count}`);
  console.log(`  True Negatives:     ${noResMetrics.trueNegatives}`);
  console.log(`  False Positives:    ${noResMetrics.falsePositives}`);
  console.log(`  No-Result Recall:   ${noResMetrics.recall}%`);
  console.log(`  No-Result Precision:${noResMetrics.precision}%`);
  console.log(`  No-Result Accuracy: ${noResMetrics.accuracy}%\n`);

  console.log('--- Answerable Performance by Repository & Language ---');
  console.table(Object.entries(perRepo).map(([repo, m]) => ({
    Repository: repo,
    Queries: m.count,
    'CandRecall': `${m.candidateRecall}%`,
    'Recall@1': `${m.recallAt1}%`,
    'Recall@5': `${m.recallAt5}%`,
    'Recall@10': `${m.recallAt10}%`,
    MRR: m.mrr,
    'P@1': `${m.precisionAt1}%`
  })));

  console.log('\n--- Performance by Query Category ---');
  console.table(Object.entries(perCategory).map(([cat, m]) => {
    if (cat === 'no_result') {
      return {
        Category: cat,
        Queries: m.count,
        'CandRecall': 'N/A',
        'Recall@1': 'N/A',
        'Recall@5': 'N/A',
        MRR: 'N/A',
        'Accuracy/TN': `${m.accuracy}%`
      };
    }
    return {
      Category: cat,
      Queries: m.count,
      'CandRecall': `${m.candidateRecall}%`,
      'Recall@1': `${m.recallAt1}%`,
      'Recall@5': `${m.recallAt5}%`,
      MRR: m.mrr,
      'Accuracy/TN': 'N/A'
    };
  }));

  const outReportPath = path.resolve(__dirname, `../data/benchmark_results_${splitName}.json`);
  fs.writeFileSync(outReportPath, JSON.stringify({
    split: splitName,
    datasetFile,
    timestamp: new Date().toISOString(),
    answerableMetrics: ansMetrics,
    noResultMetrics: noResMetrics,
    perRepo,
    perCategory,
    latencyStats: { meanLat, medLat, p95Lat },
    indexStats,
    records
  }, null, 2));

  console.log(`\nDetailed per-query results saved to ${outReportPath}`);
  return { ansMetrics, noResMetrics, perRepo, perCategory };
}

async function main() {
  const arg = process.argv[2] || 'test';
  if (arg === 'dev') {
    await runEvaluation('data/benchmark_external_dev.json', 'dev');
  } else if (arg === 'test') {
    await runEvaluation('data/benchmark_external_test.json', 'test');
  } else if (arg === 'both') {
    await runEvaluation('data/benchmark_external_dev.json', 'dev');
    console.log('\n\n');
    await runEvaluation('data/benchmark_external_test.json', 'test');
  } else {
    await runEvaluation('data/benchmark_external_test.json', 'test');
  }
}

main().catch(console.error);
