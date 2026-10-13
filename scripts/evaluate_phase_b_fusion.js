const fs = require('fs');
const path = require('path');
const { StructuralIndex } = require('../src/structural/index/StructuralIndex');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const HistoricalRetrievalAdapter = require('../src/retrieval/HistoricalRetrievalAdapter');

async function runPhaseBEvaluation() {
  console.log('========================================================================');
  console.log('Retrospect Phase B: Controlled Fusion Retrieval Evaluation');
  console.log('========================================================================\n');

  const benchmarkPath = path.resolve(__dirname, '../data/benchmark_lineage_audited_v3.json');
  const queriesPath = path.resolve(__dirname, '../data/evaluation_lineage_queries_v4.json');

  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));

  console.log(`Loaded ${benchmark.length} audited lineage records from benchmark v3.`);
  console.log(`Loaded ${queries.length} queries from query set v4.`);

  const repos = ['bottle', 'express', 'zod', 'gson'];
  const repoIndices = {};
  const repoCandidates = {};
  const histAdapter = new HistoricalRetrievalAdapter();
  const indexTimes = {};
  const historyStats = {};

  // 1. Build identical candidate pools and history profiles for all 4 repositories
  console.log('\n--- Step 1: Building Candidate Pools & Historical Profiles ---');
  for (const repo of repos) {
    const startTime = Date.now();
    const repoPath = path.resolve(__dirname, `../data/external_repos/${repo}`);
    console.log(`Indexing repository: ${repo} (${repoPath})...`);

    const structuralIndex = new StructuralIndex();
    await structuralIndex.build(repoPath);
    const allSymbols = Array.from(structuralIndex.symbols.values());

    const maxCommits = repo === 'express' ? 140 : (repo === 'zod' ? 100 : (repo === 'gson' ? 140 : 80));
    const historyResult = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, {
      maxCommits,
      startCommit: 'HEAD'
    });

    historyStats[repo] = historyResult.stats;
    const candidates = allSymbols.map(sym => ({
      symbol: sym,
      historyProfile: historyResult.profileMap.get(sym.id)
    }));

    const elapsed = Date.now() - startTime;
    indexTimes[repo] = elapsed;
    repoIndices[repo] = structuralIndex;
    repoCandidates[repo] = candidates;

    console.log(`  ${repo}: Indexed ${allSymbols.length} candidates in ${elapsed} ms (${historyResult.stats.symbolsWithHistory} symbols linked to Git history).`);
  }

  // 2. Partition into Dev Set and Held-Out Test Set (50/50 stratified by repo)
  const devQueries = [];
  const testQueries = [];
  for (const repo of repos) {
    const repoQueries = queries.filter(q => q.repository === repo);
    repoQueries.forEach((q, idx) => {
      if (idx % 2 === 0) devQueries.push(q);
      else testQueries.push(q);
    });
  }

  console.log(`\n--- Step 2: Dataset Partitioning ---`);
  console.log(`Development Set: ${devQueries.length} queries (Answerable: ${devQueries.filter(q=>q.has_answer).length}, Negative: ${devQueries.filter(q=>!q.has_answer).length})`);
  console.log(`Held-Out Test Set: ${testQueries.length} queries (Answerable: ${testQueries.filter(q=>q.has_answer).length}, Negative: ${testQueries.filter(q=>!q.has_answer).length})`);
  console.log(`Full Set: ${queries.length} queries (Answerable: ${queries.filter(q=>q.has_answer).length}, Negative: ${queries.filter(q=>!q.has_answer).length})`);

  // Evaluator function
  function evaluateSet(configName, queryList, rankFn) {
    const queryResults = [];
    let r1Count = 0;
    let r5Count = 0;
    let r10Count = 0;
    let mrrSum = 0.0;
    let p5Sum = 0.0;
    let falsePositives = 0;
    let negativeTotal = 0;
    let answerableTotal = 0;

    const perLang = {};
    const perType = {};
    const perRepo = {};
    let totalLatencyMs = 0;

    for (const q of queryList) {
      const candidates = repoCandidates[q.repository];
      const qText = q.query_sanitized || q.query;
      const qStart = Date.now();
      const ranked = rankFn(q, qText, candidates);
      const latency = Date.now() - qStart;
      totalLatencyMs += latency;

      const lang = q.language;
      const type = q.evolution_type;
      const repo = q.repository;

      if (!perLang[lang]) perLang[lang] = { answerable: 0, r1: 0, r5: 0, r10: 0, mrr: 0, fp: 0, neg: 0 };
      if (!perType[type]) perType[type] = { answerable: 0, r1: 0, r5: 0, r10: 0, mrr: 0, fp: 0, neg: 0 };
      if (!perRepo[repo]) perRepo[repo] = { answerable: 0, r1: 0, r5: 0, r10: 0, mrr: 0, fp: 0, neg: 0 };

      if (q.has_answer) {
        answerableTotal++;
        perLang[lang].answerable++;
        perType[type].answerable++;
        perRepo[repo].answerable++;

        let rank = 0;
        let matchedSymbol = null;
        for (let i = 0; i < ranked.length; i++) {
          const item = ranked[i];
          const symName = item.symbol.name;
          const symQual = item.symbol.qualifiedName || symName;
          const symFile = (item.symbol.filePath || '').replace(/\\/g, '/');
          const targetFile = (q.target_file_path || '').replace(/\\/g, '/');

          const nameMatches = symName === q.target_symbol_name ||
                              symName.endsWith('.' + q.target_symbol_name) ||
                              symQual === q.target_symbol_name ||
                              (symQual && symQual.endsWith('.' + q.target_symbol_name));
          const fileMatches = !targetFile || symFile.endsWith(targetFile);

          if (nameMatches && fileMatches) {
            rank = i + 1;
            matchedSymbol = item.symbol.name;
            break;
          }
        }

        const isR1 = rank === 1;
        const isR5 = rank >= 1 && rank <= 5;
        const isR10 = rank >= 1 && rank <= 10;
        const mrr = rank > 0 ? 1.0 / rank : 0.0;
        const p5 = isR5 ? 0.2 : 0.0;

        if (isR1) { r1Count++; perLang[lang].r1++; perType[type].r1++; perRepo[repo].r1++; }
        if (isR5) { r5Count++; perLang[lang].r5++; perType[type].r5++; perRepo[repo].r5++; }
        if (isR10) { r10Count++; perLang[lang].r10++; perType[type].r10++; perRepo[repo].r10++; }
        mrrSum += mrr;
        perLang[lang].mrr += mrr;
        perType[type].mrr += mrr;
        perRepo[repo].mrr += mrr;
        p5Sum += p5;

        queryResults.push({
          query_id: q.query_id,
          repository: q.repository,
          has_answer: true,
          target_symbol: q.target_symbol_name,
          target_role: q.target_role,
          evolution_type: q.evolution_type,
          rank,
          score: rank > 0 ? ranked[rank - 1].score : 0,
          topSymbol: ranked[0]?.symbol.name || 'none',
          topScore: ranked[0]?.score || 0
        });
      } else {
        // Negative query
        negativeTotal++;
        perLang[lang].neg++;
        perType[type].neg++;
        perRepo[repo].neg++;

        const top1 = ranked[0];
        const isFP = top1 && top1.score >= 0.20;
        if (isFP) {
          falsePositives++;
          perLang[lang].fp++;
          perType[type].fp++;
          perRepo[repo].fp++;
        }

        queryResults.push({
          query_id: q.query_id,
          repository: q.repository,
          has_answer: false,
          target_role: 'unanswerable',
          evolution_type: q.evolution_type,
          is_false_positive: isFP,
          topSymbol: top1?.symbol.name || 'none',
          topScore: top1?.score || 0
        });
      }
    }

    const recall1 = answerableTotal > 0 ? (r1Count / answerableTotal) : 0;
    const recall5 = answerableTotal > 0 ? (r5Count / answerableTotal) : 0;
    const recall10 = answerableTotal > 0 ? (r10Count / answerableTotal) : 0;
    const mrr = answerableTotal > 0 ? (mrrSum / answerableTotal) : 0;
    const fpRate = negativeTotal > 0 ? (falsePositives / negativeTotal) : 0;

    return {
      configName,
      metrics: {
        totalQueries: queryList.length,
        answerableTotal,
        negativeTotal,
        recall1: { raw: `${r1Count}/${answerableTotal}`, pct: parseFloat((recall1 * 100).toFixed(1)), val: recall1 },
        recall5: { raw: `${r5Count}/${answerableTotal}`, pct: parseFloat((recall5 * 100).toFixed(1)), val: recall5 },
        recall10: { raw: `${r10Count}/${answerableTotal}`, pct: parseFloat((recall10 * 100).toFixed(1)), val: recall10 },
        mrr: parseFloat(mrr.toFixed(4)),
        falsePositiveRate: { raw: `${falsePositives}/${negativeTotal}`, pct: parseFloat((fpRate * 100).toFixed(1)), val: fpRate },
        noResultAccuracy: { raw: `${negativeTotal - falsePositives}/${negativeTotal}`, pct: parseFloat(((1 - fpRate) * 100).toFixed(1)) }
      },
      perLanguage: perLang,
      perEvolutionType: perType,
      perRepository: perRepo,
      queryResults
    };
  }

  // Pre-compute base scores for speed and consistency
  // Structural ranking helper
  function rankStructural(q, qText, candidates) {
    const retriever = new StructuralRetriever(repoIndices[q.repository]);
    const parsed = QueryProcessor.process(qText);
    const symbols = candidates.map(c => c.symbol);
    const ranked = retriever.rankCandidates(parsed, symbols);
    ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    return ranked;
  }

  // Historical ranking helper
  function rankHistorical(q, qText, candidates) {
    const parsed = QueryProcessor.process(qText);
    return histAdapter.rankHistoricalOnly(parsed, candidates, {}, { enforceCandidateParity: true });
  }

  // Score cache per query to ensure identical base scores across fusion methods
  console.log('\n--- Step 3: Computing Base Structural & Historical Ranks ---');
  const baseScores = new Map();
  for (const q of queries) {
    const candidates = repoCandidates[q.repository];
    const qText = q.query_sanitized || q.query;
    const structRanked = rankStructural(q, qText, candidates);
    const histRanked = rankHistorical(q, qText, candidates);

    const sMap = new Map();
    const sRankMap = new Map();
    structRanked.forEach((r, idx) => {
      sMap.set(r.symbol.id, r.score);
      sRankMap.set(r.symbol.id, idx + 1);
    });

    const hMap = new Map();
    const hRankMap = new Map();
    histRanked.forEach((r, idx) => {
      hMap.set(r.symbol.id, r.score);
      hRankMap.set(r.symbol.id, idx + 1);
    });

    baseScores.set(q.query_id, {
      structRanked,
      histRanked,
      sMap,
      sRankMap,
      hMap,
      hRankMap
    });
  }

  // -------------------------------------------------------------
  // CONFIGURATION DEFINITIONS
  // -------------------------------------------------------------
  const configs = [
    {
      id: 'Config_1_Structural_Only',
      name: 'Structural-Only (Baseline)',
      rankFn: (q) => baseScores.get(q.query_id).structRanked
    },
    {
      id: 'Config_2_Historical_Only',
      name: 'Historical-Only (Baseline)',
      rankFn: (q) => baseScores.get(q.query_id).histRanked
    },
    {
      id: 'Config_3_Linear_0.6_0.4',
      name: 'Linear Fusion 0.60S / 0.40H (Current Baseline)',
      rankFn: (q, qText, candidates) => {
        const { sMap, hMap } = baseScores.get(q.query_id);
        const fused = candidates.map(c => {
          const s = sMap.get(c.symbol.id) || 0;
          const h = hMap.get(c.symbol.id) || 0;
          const score = HistoricalRetrievalAdapter.fuseScores(s, h, { structural: 0.60, historical: 0.40 });
          return { symbol: c.symbol, score, s, h };
        });
        fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
        return fused;
      }
    },
    {
      id: 'Config_4_Adaptive_Fusion',
      name: 'Adaptive Fusion [max(s,h) + 0.25*min(s,h)]',
      rankFn: (q, qText, candidates) => {
        const { sMap, hMap } = baseScores.get(q.query_id);
        const fused = candidates.map(c => {
          const s = sMap.get(c.symbol.id) || 0;
          const h = hMap.get(c.symbol.id) || 0;
          const score = HistoricalRetrievalAdapter.adaptiveFuseScores(s, h, { boost: 0.25 });
          return { symbol: c.symbol, score, s, h };
        });
        fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
        return fused;
      }
    },
    {
      id: 'Config_5_Structural_MaxAnchor',
      name: 'Structural Max-Anchor [max(s, 0.60*s + 0.40*h)]',
      rankFn: (q, qText, candidates) => {
        const { sMap, hMap } = baseScores.get(q.query_id);
        const fused = candidates.map(c => {
          const s = sMap.get(c.symbol.id) || 0;
          const h = hMap.get(c.symbol.id) || 0;
          const lin = HistoricalRetrievalAdapter.fuseScores(s, h, { structural: 0.60, historical: 0.40 });
          const score = Math.max(s, lin);
          return { symbol: c.symbol, score, s, h };
        });
        fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
        return fused;
      }
    },
    {
      id: 'Config_6_Reciprocal_Rank_Fusion',
      name: 'Reciprocal Rank Fusion (RRF k=60, 0.6S / 0.4H)',
      rankFn: (q, qText, candidates) => {
        const { sRankMap, hRankMap, sMap, hMap } = baseScores.get(q.query_id);
        const k = 60;
        const fused = candidates.map(c => {
          const sRank = sRankMap.get(c.symbol.id) || candidates.length;
          const hRank = hRankMap.get(c.symbol.id) || candidates.length;
          const s = sMap.get(c.symbol.id) || 0;
          const h = hMap.get(c.symbol.id) || 0;
          const score = (0.60 / (k + sRank)) + (0.40 / (k + hRank));
          return { symbol: c.symbol, score, s, h };
        });
        fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
        return fused;
      }
    },
    {
      id: 'Config_7_Residual_Historical_Boost',
      name: 'Residual Historical Boost [s + 0.35*h*(1-s)]',
      rankFn: (q, qText, candidates) => {
        const { sMap, hMap } = baseScores.get(q.query_id);
        const fused = candidates.map(c => {
          const s = sMap.get(c.symbol.id) || 0;
          const h = hMap.get(c.symbol.id) || 0;
          const score = parseFloat((s + (0.35 * h * (1.0 - s))).toFixed(4));
          return { symbol: c.symbol, score, s, h };
        });
        fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
        return fused;
      }
    }
  ];

  // -------------------------------------------------------------
  // RUN EVALUATIONS ACROSS DEV, TEST, AND FULL SETS
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('PHASE B EVALUATION EXECUTION');
  console.log('========================================================================\n');

  const allResults = {
    metadata: {
      timestamp: new Date().toISOString(),
      benchmarkFile: benchmarkPath,
      queriesFile: queriesPath,
      candidatePoolCounts: {
        bottle: repoCandidates.bottle.length,
        express: repoCandidates.express.length,
        zod: repoCandidates.zod.length,
        gson: repoCandidates.gson.length,
        total: Object.values(repoCandidates).reduce((acc, c) => acc + c.length, 0)
      },
      partitions: {
        dev: { total: devQueries.length, answerable: 17, negative: 3 },
        test: { total: testQueries.length, answerable: 17, negative: 3 },
        full: { total: queries.length, answerable: 34, negative: 6 }
      }
    },
    dev: {},
    test: {},
    full: {}
  };

  for (const cfg of configs) {
    allResults.dev[cfg.id] = evaluateSet(cfg.name, devQueries, cfg.rankFn);
    allResults.test[cfg.id] = evaluateSet(cfg.name, testQueries, cfg.rankFn);
    allResults.full[cfg.id] = evaluateSet(cfg.name, queries, cfg.rankFn);
  }

  // -------------------------------------------------------------
  // PRINT SUMMARY TABLES
  // -------------------------------------------------------------
  console.log('=== DEVELOPMENT SET (17 answerable / 3 negative queries) ===');
  const devTable = {};
  for (const cfg of configs) {
    const m = allResults.dev[cfg.id].metrics;
    devTable[cfg.name] = {
      'R@1': `${m.recall1.pct}% (${m.recall1.raw})`,
      'R@5': `${m.recall5.pct}% (${m.recall5.raw})`,
      'R@10': `${m.recall10.pct}% (${m.recall10.raw})`,
      'MRR': m.mrr,
      'FP Rate': `${m.falsePositiveRate.pct}% (${m.falsePositiveRate.raw})`
    };
  }
  console.table(devTable);

  console.log('\n=== HELD-OUT TEST SET (17 answerable / 3 negative queries) ===');
  const testTable = {};
  for (const cfg of configs) {
    const m = allResults.test[cfg.id].metrics;
    testTable[cfg.name] = {
      'R@1': `${m.recall1.pct}% (${m.recall1.raw})`,
      'R@5': `${m.recall5.pct}% (${m.recall5.raw})`,
      'R@10': `${m.recall10.pct}% (${m.recall10.raw})`,
      'MRR': m.mrr,
      'FP Rate': `${m.falsePositiveRate.pct}% (${m.falsePositiveRate.raw})`
    };
  }
  console.table(testTable);

  console.log('\n=== FULL DATASET (34 answerable / 6 negative queries) ===');
  const fullTable = {};
  for (const cfg of configs) {
    const m = allResults.full[cfg.id].metrics;
    fullTable[cfg.name] = {
      'R@1': `${m.recall1.pct}% (${m.recall1.raw})`,
      'R@5': `${m.recall5.pct}% (${m.recall5.raw})`,
      'R@10': `${m.recall10.pct}% (${m.recall10.raw})`,
      'MRR': m.mrr,
      'FP Rate': `${m.falsePositiveRate.pct}% (${m.falsePositiveRate.raw})`
    };
  }
  console.table(fullTable);

  // -------------------------------------------------------------
  // REGRESSION ANALYSIS TRACING
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('REGRESSION QUERIES TRACING');
  console.log('========================================================================');
  const regressionIds = ['q_ts_zod_04', 'q_java_gsn_07', 'q_java_gsn_08'];
  for (const qId of regressionIds) {
    const q = queries.find(x => x.query_id === qId);
    console.log(`\nQuery ${q.query_id} [${q.repository}] "${q.query_sanitized || q.query}":`);
    console.log(`Target: ${q.target_symbol_name} in ${q.target_file_path}`);
    for (const cfg of configs) {
      const res = allResults.full[cfg.id].queryResults.find(r => r.query_id === qId);
      console.log(`  - ${cfg.name}: Rank ${res.rank} (score: ${res.score.toFixed(4)}) | Top-1: ${res.topSymbol} (${res.topScore.toFixed(4)})`);
    }
  }

  // -------------------------------------------------------------
  // SAVE RAW RESULTS ARTIFACT
  // -------------------------------------------------------------
  const outPath = path.resolve(__dirname, '../data/phase_b_evaluation_results.json');
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`\nSaved raw evaluation results to: ${outPath}`);

  return allResults;
}

runPhaseBEvaluation().catch(err => {
  console.error(err);
  process.exit(1);
});
