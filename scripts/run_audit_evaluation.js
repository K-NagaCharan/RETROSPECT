const fs = require('fs');
const path = require('path');
const { indexRepository, searchCurrentCode } = require('../src/structural');

async function runAuditEvaluation() {
  const datasetPath = path.resolve(__dirname, '../data/audit_external_benchmark.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log('================================================================================');
  console.log('       INDEPENDENT RETROSPECT EVALUATION AUDIT ON AUTHENTIC REPOSITORIES        ');
  console.log('================================================================================');
  console.log(`Evaluating ${dataset.length} manually verified queries across 4 authentic repositories:\n`);

  // Index repos
  const repos = [...new Set(dataset.map(d => d.repo_path))];
  const indexStats = {};

  for (const relRepoPath of repos) {
    const fullPath = path.resolve(__dirname, '..', relRepoPath);
    console.log(`[Indexing] ${relRepoPath}...`);
    const t0 = Date.now();
    const idx = await indexRepository(fullPath, { forceRebuild: false });
    const elapsed = Date.now() - t0;
    indexStats[relRepoPath] = {
      indexingTimeMs: elapsed,
      filesCount: idx.files.size,
      symbolsCount: idx.symbols.size
    };
    console.log(`  Done in ${elapsed}ms: ${idx.files.size} files, ${idx.symbols.size} symbols.`);
  }

  console.log('\n--- Running Retrieval Across Test Queries ---\n');

  const records = [];
  const latencies = [];

  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    const fullRepoPath = path.resolve(__dirname, '..', item.repo_path);

    const tStart = Date.now();
    const searchRes = await searchCurrentCode(fullRepoPath, item.query, { maxResults: 10 });
    const latency = Date.now() - tStart;
    latencies.push(latency);

    const returnedNames = searchRes.results.map(r => r.name);
    const expectedSet = new Set(item.expected_symbols);
    const isNoResult = item.is_no_result;

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
    } else {
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
      returnedTop5: searchRes.results.slice(0, 5).map(r => ({
        name: r.name,
        kind: r.kind,
        file: r.filePath,
        line: r.startLine,
        score: Number(r.score.toFixed(4)),
        reasons: r.matchReasons
      })),
      hitAt1,
      hitAt5,
      hitAt10,
      reciprocalRank,
      precisionAt1,
      precisionAt5,
      latencyMs: latency
    };

    records.push(rec);

    const statusStr = isNoResult
      ? (hitAt1 ? 'PASS (0 results)' : `FAIL (${returnedNames.length} returned)`)
      : (hitAt1 ? 'PASS (Rank 1)' : (hitAt5 ? `PASS (Rank <= 5, RR=${reciprocalRank.toFixed(2)})` : 'MISS'));

    console.log(`[#${i + 1}] [${item.repository}] "${item.query}" -> ${statusStr}`);
    if (!hitAt1 && !isNoResult) {
      console.log(`     Expected: ${JSON.stringify(item.expected_symbols)}`);
      console.log(`     Got Top 3: ${JSON.stringify(returnedNames.slice(0, 3))}`);
    }
  }

  // Aggregate Metrics
  function computeSummary(recs) {
    const n = recs.length;
    if (n === 0) return {};
    const h1 = recs.filter(r => r.hitAt1).length;
    const h5 = recs.filter(r => r.hitAt5).length;
    const h10 = recs.filter(r => r.hitAt10).length;
    const totalRR = recs.reduce((a, r) => a + r.reciprocalRank, 0);
    const totalP1 = recs.reduce((a, r) => a + r.precisionAt1, 0);
    const totalP5 = recs.reduce((a, r) => a + r.precisionAt5, 0);
    const noRes = recs.filter(r => r.isNoResult);
    const noResAcc = noRes.length > 0 ? (noRes.filter(r => r.hitAt1).length / noRes.length) : 1.0;

    return {
      queries: n,
      recallAt1: Number(((h1 / n) * 100).toFixed(1)),
      recallAt5: Number(((h5 / n) * 100).toFixed(1)),
      recallAt10: Number(((h10 / n) * 100).toFixed(1)),
      mrr: Number((totalRR / n).toFixed(4)),
      precisionAt1: Number(((totalP1 / n) * 100).toFixed(1)),
      precisionAt5: Number(((totalP5 / n) * 100).toFixed(1)),
      noResultAcc: Number((noResAcc * 100).toFixed(1))
    };
  }

  const overall = computeSummary(records);

  // Per Language / Repo
  const perRepo = {};
  for (const repoName of ['bottle', 'express', 'zod', 'gson']) {
    perRepo[repoName] = computeSummary(records.filter(r => r.repository === repoName));
  }

  // Per Category
  const perCategory = {};
  const cats = [...new Set(records.map(r => r.category))];
  for (const cat of cats) {
    perCategory[cat] = computeSummary(records.filter(r => r.category === cat));
  }

  latencies.sort((a, b) => a - b);
  const meanLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const medLat = latencies[Math.floor(latencies.length / 2)] || 0;
  const p95Lat = latencies[Math.floor(latencies.length * 0.95)] || 0;

  console.log('\n================================================================================');
  console.log('                        AUDIT AGGREGATE SUMMARY                                  ');
  console.log('================================================================================');
  console.log(`Evaluated ${records.length} queries across 4 authentic repositories.`);
  console.log(`Latency: Mean ${meanLat.toFixed(2)}ms | Median ${medLat}ms | p95 ${p95Lat}ms\n`);

  console.log(`  Recall@1:           ${overall.recallAt1}%`);
  console.log(`  Recall@5:           ${overall.recallAt5}%`);
  console.log(`  Recall@10:          ${overall.recallAt10}%`);
  console.log(`  MRR:                ${overall.mrr}`);
  console.log(`  Precision@1:        ${overall.precisionAt1}%`);
  console.log(`  Precision@5:        ${overall.precisionAt5}%`);
  console.log(`  No-Result Accuracy: ${overall.noResultAcc}%\n`);

  console.log('--- Breakdown by Authentic Repository & Language ---');
  console.table(Object.entries(perRepo).map(([repo, m]) => ({
    Repository: repo,
    Queries: m.queries,
    'Recall@1': `${m.recallAt1}%`,
    'Recall@5': `${m.recallAt5}%`,
    'Recall@10': `${m.recallAt10}%`,
    MRR: m.mrr,
    'Precision@1': `${m.precisionAt1}%`
  })));

  console.log('\n--- Breakdown by Query Category ---');
  console.table(Object.entries(perCategory).map(([cat, m]) => ({
    Category: cat,
    Queries: m.queries,
    'Recall@1': `${m.recallAt1}%`,
    'Recall@5': `${m.recallAt5}%`,
    'Recall@10': `${m.recallAt10}%`,
    MRR: m.mrr,
    'No-Result Acc': `${m.noResultAcc}%`
  })));

  // Write out full records to audit_results.json
  const outPath = path.resolve(__dirname, '../data/audit_external_results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    overall,
    perRepo,
    perCategory,
    latencyStats: { meanLat, medLat, p95Lat },
    indexStats,
    records
  }, null, 2));

  console.log(`\nDetailed per-query audit records saved to ${outPath}`);
}

runAuditEvaluation().catch(console.error);
