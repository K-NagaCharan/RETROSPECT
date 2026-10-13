const fs = require('fs');
const path = require('path');
const { indexRepository } = require('../src/structural');
const { StructuralRetriever, DEFAULT_WEIGHTS } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const ContextBuilder = require('../src/structural/context/ContextBuilder');

async function loadDataset(datasetFile) {
  const datasetPath = path.resolve(__dirname, '..', datasetFile);
  return JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
}

async function prepareIndices(dataset) {
  const repos = [...new Set(dataset.map(d => d.repo_path))];
  const indexMap = {};
  for (const relRepoPath of repos) {
    const fullPath = path.resolve(__dirname, '..', relRepoPath);
    indexMap[relRepoPath] = await indexRepository(fullPath, { forceRebuild: false });
  }
  return indexMap;
}

function evaluateConfig(dataset, indexMap, retrieverOptionsBuilder) {
  let ansCount = 0;
  let candRecallHits = 0;
  let recallAt1Hits = 0;
  let recallAt5Hits = 0;
  let recallAt10Hits = 0;
  let sumRR = 0;
  let pAt1Hits = 0;
  let pAt5Sum = 0;

  let noResCount = 0;
  let trueNegatives = 0;
  let falsePositives = 0;

  const perQueryDetails = [];
  const latencies = [];

  for (const item of dataset) {
    const idx = indexMap[item.repo_path];
    const opts = retrieverOptionsBuilder(item);
    const retriever = new StructuralRetriever(idx, opts.retrieverOpts);

    const tStart = Date.now();
    const query = QueryProcessor.process(item.query);
    const candidates = retriever.generateCandidates(query, opts.searchOpts);
    const ranked = retriever.rankCandidates(query, candidates, opts.searchOpts);
    const context = ContextBuilder.buildContext(ranked, { maxResults: 10 });
    const latency = Date.now() - tStart;
    latencies.push(latency);

    const returnedSymbols = context.results;
    const returnedNames = returnedSymbols.map(r => r.name);
    const expectedSet = new Set(item.expected_symbols);
    const isNoResult = item.is_no_result;

    if (isNoResult) {
      noResCount++;
      if (returnedSymbols.length === 0) {
        trueNegatives++;
      } else {
        falsePositives++;
      }
      perQueryDetails.push({
        id: item.query_id,
        query: item.query,
        category: item.category,
        isNoResult: true,
        returnedCount: returnedSymbols.length,
        topCandidate: returnedSymbols[0] ? returnedSymbols[0].name : null,
        topScore: returnedSymbols[0] ? returnedSymbols[0].score : null
      });
    } else {
      ansCount++;
      const candNames = new Set(candidates.map(c => c.name));
      const candRecall = item.expected_symbols.some(exp => candNames.has(exp));
      if (candRecall) candRecallHits++;

      let firstMatchRank = -1;
      for (let r = 0; r < returnedSymbols.length; r++) {
        if (expectedSet.has(returnedSymbols[r].name)) {
          firstMatchRank = r + 1;
          break;
        }
      }

      const hit1 = firstMatchRank === 1;
      const hit5 = firstMatchRank > 0 && firstMatchRank <= 5;
      const hit10 = firstMatchRank > 0 && firstMatchRank <= 10;
      const rr = firstMatchRank > 0 ? (1.0 / firstMatchRank) : 0;

      if (hit1) recallAt1Hits++;
      if (hit5) recallAt5Hits++;
      if (hit10) recallAt10Hits++;
      sumRR += rr;

      if (returnedSymbols.length > 0 && expectedSet.has(returnedSymbols[0].name)) {
        pAt1Hits++;
      }
      const top5 = returnedSymbols.slice(0, 5);
      const top5Matches = top5.filter(s => expectedSet.has(s.name)).length;
      pAt5Sum += top5.length > 0 ? (top5Matches / top5.length) : 0;

      perQueryDetails.push({
        id: item.query_id,
        query: item.query,
        category: item.category,
        isNoResult: false,
        expectedSymbols: item.expected_symbols,
        candidateRecall: candRecall,
        totalCandidates: candidates.length,
        returnedCount: returnedSymbols.length,
        firstMatchRank,
        reciprocalRank: rr,
        topResults: returnedSymbols.slice(0, 5).map(r => ({
          name: r.name,
          score: r.score,
          filePath: r.filePath,
          breakdown: r.scoreBreakdown
        }))
      });
    }
  }

  const meanLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  latencies.sort((a, b) => a - b);
  const medLat = latencies[Math.floor(latencies.length / 2)];
  const p95Lat = latencies[Math.floor(latencies.length * 0.95)];

  return {
    ansCount,
    candidateRecall: ansCount > 0 ? Number(((candRecallHits / ansCount) * 100).toFixed(1)) : 0,
    recallAt1: ansCount > 0 ? Number(((recallAt1Hits / ansCount) * 100).toFixed(1)) : 0,
    recallAt5: ansCount > 0 ? Number(((recallAt5Hits / ansCount) * 100).toFixed(1)) : 0,
    recallAt10: ansCount > 0 ? Number(((recallAt10Hits / ansCount) * 100).toFixed(1)) : 0,
    mrr: ansCount > 0 ? Number((sumRR / ansCount).toFixed(4)) : 0,
    precisionAt1: ansCount > 0 ? Number(((pAt1Hits / ansCount) * 100).toFixed(1)) : 0,
    precisionAt5: ansCount > 0 ? Number(((pAt5Sum / ansCount) * 100).toFixed(1)) : 0,
    noResultCount: noResCount,
    trueNegatives,
    falsePositives,
    noResultAccuracy: noResCount > 0 ? Number(((trueNegatives / noResCount) * 100).toFixed(1)) : 0,
    noResultPrecision: (trueNegatives + falsePositives > 0) ? Number(((trueNegatives / (trueNegatives + falsePositives)) * 100).toFixed(1)) : 100,
    noResultRecall: noResCount > 0 ? Number(((trueNegatives / noResCount) * 100).toFixed(1)) : 0,
    latency: { meanLat: Number(meanLat.toFixed(2)), medLat, p95Lat },
    details: perQueryDetails
  };
}

async function runAudit() {
  console.log('Loading datasets and initializing indices...');
  const devData = await loadDataset('data/benchmark_external_dev.json');
  const testData = await loadDataset('data/benchmark_external_test.json');
  const devIndices = await prepareIndices(devData);

  console.log('\n======================================================');
  console.log(' STEP 1: DETAILED AUDIT OF DEV SET RANKING ERRORS');
  console.log('======================================================\n');

  // Baseline config
  const currentConfigBuilder = () => ({ retrieverOpts: {}, searchOpts: {} });
  const devCurrent = evaluateConfig(devData, devIndices, currentConfigBuilder);

  for (const q of devCurrent.details) {
    if (q.isNoResult) {
      const status = q.returnedCount === 0 ? 'TRUE NEGATIVE (PASS)' : `FALSE POSITIVE (Returned ${q.returnedCount}, top: ${q.topCandidate} score: ${q.topScore})`;
      console.log(`[Unanswerable] ${q.id}: "${q.query}" -> ${status}`);
    } else {
      const rankStr = q.firstMatchRank > 0 ? `Rank ${q.firstMatchRank}` : 'NOT IN TOP 10';
      const status = q.firstMatchRank === 1 ? 'PASS (Rank 1)' : (q.firstMatchRank <= 5 ? `ACCEPTABLE (${rankStr})` : `MISS (${rankStr})`);
      console.log(`\n[${q.category}] ${q.id}: "${q.query}"`);
      console.log(`  Expected: ${JSON.stringify(q.expectedSymbols)}`);
      console.log(`  Result: ${status} (Candidates generated: ${q.totalCandidates}, Cand Recall: ${q.candidateRecall})`);
      console.log(`  Top Retrieved Candidates:`);
      for (let i = 0; i < q.topResults.length; i++) {
        const res = q.topResults[i];
        const isExp = q.expectedSymbols.includes(res.name) ? ' [EXPECTED]' : '';
        console.log(`    #${i + 1} ${res.name}${isExp} (score: ${res.score}, file: ${res.filePath})`);
        if (res.breakdown) {
          console.log(`       breakdown: exact=${res.breakdown.exactScore}, token=${res.breakdown.tokenScore}, doc=${res.breakdown.docstringScore}, path=${res.breakdown.pathScore}, sig=${res.breakdown.signatureScore}, graph=${res.breakdown.graphScore}, kind=${res.breakdown.kindScore}`);
        }
      }
    }
  }

  console.log('\n======================================================');
  console.log(' STEP 2: LEXICAL-ONLY VS STRUCTURAL COMPARISON (DEV SET)');
  console.log('======================================================\n');

  // Pure lexical: only exact and token weights (50/50), no other signals
  const lexicalOnlyBuilder = () => ({
    retrieverOpts: {
      weights: {
        exact: 0.50,
        token: 0.50,
        docstring: 0,
        path: 0,
        signature: 0,
        graph: 0,
        kind: 0
      },
      minScoreThreshold: 0.08
    },
    searchOpts: {}
  });

  const devLexical = evaluateConfig(devData, devIndices, lexicalOnlyBuilder);

  console.log('--- Dev Metrics: Lexical-Only vs Structural ---');
  console.table([
    {
      Strategy: 'Lexical-Only Baseline',
      'Cand Recall': `${devLexical.candidateRecall}%`,
      'Recall@1': `${devLexical.recallAt1}%`,
      'Recall@5': `${devLexical.recallAt5}%`,
      'Recall@10': `${devLexical.recallAt10}%`,
      MRR: devLexical.mrr,
      'P@5': `${devLexical.precisionAt5}%`,
      'No-Result Acc': `${devLexical.noResultAccuracy}%`
    },
    {
      Strategy: 'Retrospect Structural',
      'Cand Recall': `${devCurrent.candidateRecall}%`,
      'Recall@1': `${devCurrent.recallAt1}%`,
      'Recall@5': `${devCurrent.recallAt5}%`,
      'Recall@10': `${devCurrent.recallAt10}%`,
      MRR: devCurrent.mrr,
      'P@5': `${devCurrent.precisionAt5}%`,
      'No-Result Acc': `${devCurrent.noResultAccuracy}%`
    }
  ]);

  console.log('\n======================================================');
  console.log(' STEP 3: ABLATION EXPERIMENTS ON INDIVIDUAL SIGNALS (DEV)');
  console.log('======================================================\n');

  const ablations = [
    {
      name: 'Full Structural (Default)',
      builder: () => ({ retrieverOpts: {}, searchOpts: {} })
    },
    {
      name: 'Ablation: No Call Graph (graph=0)',
      builder: () => ({ retrieverOpts: { weights: { ...DEFAULT_WEIGHTS, graph: 0 } }, searchOpts: {} })
    },
    {
      name: 'Ablation: No File Path (path=0)',
      builder: () => ({ retrieverOpts: { weights: { ...DEFAULT_WEIGHTS, path: 0 } }, searchOpts: {} })
    },
    {
      name: 'Ablation: No Docstring (docstring=0)',
      builder: () => ({ retrieverOpts: { weights: { ...DEFAULT_WEIGHTS, docstring: 0 } }, searchOpts: {} })
    },
    {
      name: 'Ablation: No Target Kind (kind=0)',
      builder: () => ({ retrieverOpts: { weights: { ...DEFAULT_WEIGHTS, kind: 0 } }, searchOpts: {} })
    },
    {
      name: 'Ablation: No Signature (signature=0)',
      builder: () => ({ retrieverOpts: { weights: { ...DEFAULT_WEIGHTS, signature: 0 } }, searchOpts: {} })
    }
  ];

  const ablationResults = ablations.map(ab => {
    const res = evaluateConfig(devData, devIndices, ab.builder);
    return {
      Configuration: ab.name,
      'Recall@1': `${res.recallAt1}%`,
      'Recall@5': `${res.recallAt5}%`,
      'Recall@10': `${res.recallAt10}%`,
      MRR: res.mrr,
      'P@5': `${res.precisionAt5}%`,
      'No-Res Acc': `${res.noResultAccuracy}%`
    };
  });

  console.table(ablationResults);

  // Save audit output to file
  const auditReport = {
    timestamp: new Date().toISOString(),
    devLexical,
    devCurrent,
    ablationResults
  };
  fs.writeFileSync(path.resolve(__dirname, '../data/audit_ranking_experiments.json'), JSON.stringify(auditReport, null, 2));
  console.log('\nAudit experiment output saved to data/audit_ranking_experiments.json');
}

runAudit().catch(console.error);
