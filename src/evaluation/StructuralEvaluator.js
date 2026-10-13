const fs = require('fs');
const path = require('path');
const { indexRepository, searchCurrentCode } = require('../structural');

class StructuralEvaluator {
  constructor(options = {}) {
    this.fixturesBaseDir = options.fixturesBaseDir || path.resolve(__dirname, '../../data/fixtures/eval_repos');
    this.topKList = [1, 5, 10];
  }

  /**
   * Run structural retrieval evaluation over the benchmark dataset.
   * @param {string} datasetPath Path to benchmark JSON file
   * @param {object} [options]
   * @param {string} [options.splitFilter='test'] 'all', 'dev', or 'test'
   * @returns {Promise<object>} Evaluation results and metric summaries
   */
  async runEvaluation(datasetPath, options = {}) {
    const splitFilter = options.splitFilter || 'test';
    const rawData = fs.readFileSync(datasetPath, 'utf-8');
    const allInstances = JSON.parse(rawData);

    const instances = splitFilter === 'all'
      ? allInstances
      : allInstances.filter(i => i.split === splitFilter);

    if (instances.length === 0) {
      throw new Error(`StructuralEvaluator: No evaluation instances found for split '${splitFilter}'`);
    }

    const queryLatencies = [];
    const evaluationRecords = [];

    // Pre-index all required fixture repositories
    const repoSet = new Set(instances.map(i => i.repository_fixture));
    const indexTimes = {};
    for (const repoFixture of repoSet) {
      const repoPath = path.join(this.fixturesBaseDir, repoFixture);
      const t0 = Date.now();
      await indexRepository(repoPath, { forceRebuild: true });
      indexTimes[repoFixture] = Date.now() - t0;
    }

    // Evaluate each query instance
    for (const instance of instances) {
      const repoPath = path.join(this.fixturesBaseDir, instance.repository_fixture);
      const res = await searchCurrentCode(repoPath, instance.query, { maxResults: 10 });

      queryLatencies.push(res.latencyMs);

      const returnedNames = res.results.map(r => r.name);
      const expectedSet = new Set(instance.expected_symbols);

      // Check Hits
      const isNoResult = instance.is_no_result === true;
      let hitAt1 = false;
      let hitAt5 = false;
      let hitAt10 = false;
      let reciprocalRank = 0.0;
      let precisionAt1 = 0.0;
      let precisionAt5 = 0.0;

      if (isNoResult) {
        // Zero-result expected
        const correctlyEmpty = returnedNames.length === 0;
        hitAt1 = correctlyEmpty;
        hitAt5 = correctlyEmpty;
        hitAt10 = correctlyEmpty;
        reciprocalRank = correctlyEmpty ? 1.0 : 0.0;
        precisionAt1 = correctlyEmpty ? 1.0 : 0.0;
        precisionAt5 = correctlyEmpty ? 1.0 : 0.0;
      } else {
        // Find rank of first expected symbol
        for (let r = 0; r < returnedNames.length; r++) {
          if (expectedSet.has(returnedNames[r])) {
            reciprocalRank = 1.0 / (r + 1);
            if (r < 1) hitAt1 = true;
            if (r < 5) hitAt5 = true;
            if (r < 10) hitAt10 = true;
            break;
          }
        }

        // Precision@1
        if (returnedNames.length > 0 && expectedSet.has(returnedNames[0])) {
          precisionAt1 = 1.0;
        }

        // Precision@5
        const top5 = returnedNames.slice(0, 5);
        if (top5.length > 0) {
          const matchCount = top5.filter(name => expectedSet.has(name)).length;
          precisionAt5 = matchCount / top5.length;
        }
      }

      evaluationRecords.push({
        queryId: instance.query_id,
        query: instance.query,
        language: instance.language,
        category: instance.category,
        split: instance.split,
        isNoResult,
        expectedSymbols: instance.expected_symbols,
        returnedNames,
        hitAt1,
        hitAt5,
        hitAt10,
        reciprocalRank,
        precisionAt1,
        precisionAt5,
        latencyMs: res.latencyMs
      });
    }

    // Compute Aggregate Metrics
    const metrics = this._computeMetrics(evaluationRecords);

    // Compute Slices (per language and per category)
    const perLanguage = {};
    const languages = [...new Set(evaluationRecords.map(r => r.language))];
    for (const lang of languages) {
      perLanguage[lang] = this._computeMetrics(evaluationRecords.filter(r => r.language === lang));
    }

    const perCategory = {};
    const categories = [...new Set(evaluationRecords.map(r => r.category))];
    for (const cat of categories) {
      perCategory[cat] = this._computeMetrics(evaluationRecords.filter(r => r.category === cat));
    }

    // Latency stats
    queryLatencies.sort((a, b) => a - b);
    const meanLatency = queryLatencies.reduce((a, b) => a + b, 0) / queryLatencies.length;
    const medianLatency = queryLatencies[Math.floor(queryLatencies.length / 2)] || 0;
    const p95Latency = queryLatencies[Math.floor(queryLatencies.length * 0.95)] || 0;

    return {
      split: splitFilter,
      totalQueries: evaluationRecords.length,
      indexingTimesMs: indexTimes,
      overallMetrics: metrics,
      perLanguage,
      perCategory,
      latencyStats: {
        meanLatencyMs: Number(meanLatency.toFixed(2)),
        medianLatencyMs: Number(medianLatency.toFixed(2)),
        p95LatencyMs: Number(p95Latency.toFixed(2))
      },
      records: evaluationRecords
    };
  }

  _computeMetrics(records) {
    if (records.length === 0) {
      return { count: 0, recallAt1: 0, recallAt5: 0, recallAt10: 0, mrr: 0, precisionAt1: 0, precisionAt5: 0, noResultAccuracy: 0 };
    }

    const n = records.length;
    const hits1 = records.filter(r => r.hitAt1).length;
    const hits5 = records.filter(r => r.hitAt5).length;
    const hits10 = records.filter(r => r.hitAt10).length;
    const totalRR = records.reduce((acc, r) => acc + r.reciprocalRank, 0);
    const totalP1 = records.reduce((acc, r) => acc + r.precisionAt1, 0);
    const totalP5 = records.reduce((acc, r) => acc + r.precisionAt5, 0);

    const noResultRecords = records.filter(r => r.isNoResult);
    const noResultAcc = noResultRecords.length > 0
      ? noResultRecords.filter(r => r.hitAt1).length / noResultRecords.length
      : 1.0;

    return {
      count: n,
      recallAt1: Number((hits1 / n).toFixed(4)),
      recallAt5: Number((hits5 / n).toFixed(4)),
      recallAt10: Number((hits10 / n).toFixed(4)),
      mrr: Number((totalRR / n).toFixed(4)),
      precisionAt1: Number((totalP1 / n).toFixed(4)),
      precisionAt5: Number((totalP5 / n).toFixed(4)),
      noResultAccuracy: Number(noResultAcc.toFixed(4))
    };
  }

  printReport(report) {
    console.log('\n================================================================================');
    console.log(`       RETROSPECT STRUCTURAL RETRIEVAL EVALUATION REPORT (${report.split.toUpperCase()} SPLIT)      `);
    console.log('================================================================================');
    console.log(`Evaluated ${report.totalQueries} labeled queries across Python, JavaScript, TypeScript, and Java.`);
    console.log(`Latency: Mean ${report.latencyStats.meanLatencyMs}ms | Median ${report.latencyStats.medianLatencyMs}ms | p95 ${report.latencyStats.p95LatencyMs}ms\n`);

    console.log('--- Aggregate Retrieval Performance ---');
    console.log(`  Recall@1:           ${(report.overallMetrics.recallAt1 * 100).toFixed(2)}%`);
    console.log(`  Recall@5:           ${(report.overallMetrics.recallAt5 * 100).toFixed(2)}%`);
    console.log(`  Recall@10:          ${(report.overallMetrics.recallAt10 * 100).toFixed(2)}%`);
    console.log(`  MRR (Mean Rec. Rank): ${report.overallMetrics.mrr.toFixed(4)}`);
    console.log(`  Precision@1:        ${(report.overallMetrics.precisionAt1 * 100).toFixed(2)}%`);
    console.log(`  Precision@5:        ${(report.overallMetrics.precisionAt5 * 100).toFixed(2)}%`);
    console.log(`  No-Result Accuracy: ${(report.overallMetrics.noResultAccuracy * 100).toFixed(2)}%\n`);

    console.log('--- Breakdown by Language ---');
    console.table(Object.entries(report.perLanguage).map(([lang, m]) => ({
      Language: lang,
      Queries: m.count,
      'Recall@1': `${(m.recallAt1 * 100).toFixed(1)}%`,
      'Recall@5': `${(m.recallAt5 * 100).toFixed(1)}%`,
      MRR: m.mrr.toFixed(3),
      'P@1': `${(m.precisionAt1 * 100).toFixed(1)}%`
    })));

    console.log('\n--- Breakdown by Query Category ---');
    console.table(Object.entries(report.perCategory).map(([cat, m]) => ({
      Category: cat,
      Queries: m.count,
      'Recall@1': `${(m.recallAt1 * 100).toFixed(1)}%`,
      'Recall@5': `${(m.recallAt5 * 100).toFixed(1)}%`,
      MRR: m.mrr.toFixed(3),
      'No-Result Acc': `${(m.noResultAccuracy * 100).toFixed(1)}%`
    })));
  }
}

module.exports = StructuralEvaluator;
