const fs = require('fs');
const path = require('path');
const { indexRepository } = require('../src/structural');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');

async function diagnose() {
  const datasetPath = path.resolve(__dirname, '../data/audit_external_benchmark.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const repos = ['data/external_repos/bottle', 'data/external_repos/express', 'data/external_repos/zod', 'data/external_repos/gson'];
  const indexMap = {};

  for (const r of repos) {
    const fullPath = path.resolve(__dirname, '..', r);
    console.log(`Indexing ${r}...`);
    indexMap[r] = await indexRepository(fullPath, { forceRebuild: false });
  }

  console.log('\n=== DIAGNOSING ALL 24 BENCHMARK QUERIES ===\n');

  const detailedDiagnostics = [];

  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    const index = indexMap[item.repo_path];
    const retriever = new StructuralRetriever(index);

    const query = QueryProcessor.process(item.query);
    const candidates = retriever.generateCandidates(query);
    const candidateIds = new Set(candidates.map(c => c.id));
    const candidateNames = new Set(candidates.map(c => c.name));

    // Verify expected symbols in index
    const expectedDetails = [];
    for (const expName of item.expected_symbols) {
      const matchingSymbols = [];
      for (const [id, sym] of index.symbols.entries()) {
        if (sym.name === expName) {
          matchingSymbols.push({
            id: sym.id,
            name: sym.name,
            kind: sym.symbolType,
            filePath: sym.filePath,
            startLine: sym.startLine,
            signature: sym.normalizedSignature,
            docstring: sym.docstring ? sym.docstring.slice(0, 80) : null
          });
        }
      }
      expectedDetails.push({
        name: expName,
        foundInIndexCount: matchingSymbols.length,
        matchingSymbols
      });
    }

    // Check candidate recall
    let inCandidateSet = false;
    if (item.is_no_result) {
      inCandidateSet = candidates.length === 0;
    } else {
      for (const expName of item.expected_symbols) {
        if (candidateNames.has(expName)) {
          inCandidateSet = true;
          break;
        }
      }
    }

    // Rank candidates
    const ranked = retriever.rankCandidates(query, candidates);
    const rankedNames = ranked.map(r => r.symbol.name);

    let rankOfFirstMatch = -1;
    let matchingRankedItem = null;
    if (!item.is_no_result) {
      for (let r = 0; r < ranked.length; r++) {
        if (item.expected_symbols.includes(ranked[r].symbol.name)) {
          rankOfFirstMatch = r + 1;
          matchingRankedItem = ranked[r];
          break;
        }
      }
    }

    const top10 = ranked.slice(0, 10).map((r, idx) => ({
      rank: idx + 1,
      name: r.symbol.name,
      kind: r.symbol.symbolType,
      file: r.symbol.filePath,
      score: r.score,
      breakdown: r.scoreBreakdown,
      reasons: r.matchReasons
    }));

    // Determine precise failure category
    let failureCategory = 'SUCCESS';
    let failureDetail = '';

    if (item.is_no_result) {
      if (ranked.length > 0) {
        failureCategory = 'FALSE_POSITIVE_NO_RESULT';
        failureDetail = `Expected 0 results, but got ${ranked.length} candidates above threshold (top score: ${ranked[0].score.toFixed(4)} by ${ranked[0].symbol.name})`;
      }
    } else {
      const anyInIndex = expectedDetails.some(ed => ed.foundInIndexCount > 0);
      if (!anyInIndex) {
        failureCategory = 'PARSER_EXTRACTION_FAILURE';
        failureDetail = `Expected symbol(s) ${JSON.stringify(item.expected_symbols)} NOT FOUND in index!`;
      } else if (!inCandidateSet) {
        failureCategory = 'CANDIDATE_GENERATION_FAILURE';
        failureDetail = `Symbol is in index, but NOT present in candidate set (candidates: ${candidates.length}).`;
      } else if (rankOfFirstMatch === 1) {
        failureCategory = 'SUCCESS';
        failureDetail = `Rank 1 hit.`;
      } else if (rankOfFirstMatch > 1 && rankOfFirstMatch <= 5) {
        failureCategory = 'RANKING_ERROR_TOP5';
        failureDetail = `Retrieved at rank ${rankOfFirstMatch} (score: ${matchingRankedItem.score.toFixed(4)} vs top 1: ${top10[0].score.toFixed(4)}).`;
      } else if (rankOfFirstMatch > 5) {
        failureCategory = 'RANKING_ERROR_BELOW5';
        failureDetail = `Retrieved at rank ${rankOfFirstMatch} (score: ${matchingRankedItem.score.toFixed(4)} vs top 1: ${top10[0].score.toFixed(4)}).`;
      } else {
        failureCategory = 'THRESHOLD_SUPPRESSED';
        failureDetail = `Present in candidates, but filtered out by minScoreThreshold.`;
      }
    }

    const diag = {
      index: i + 1,
      queryId: item.query_id,
      query: item.query,
      repo: item.repository,
      category: item.category,
      isNoResult: item.is_no_result,
      expectedSymbols: item.expected_symbols,
      expectedDetails,
      terms: query.terms,
      stemmedTerms: query.stemmedTerms,
      totalCandidatesGenerated: candidates.length,
      candidateRecall: inCandidateSet,
      totalRankedReturned: ranked.length,
      rankOfFirstMatch,
      top10,
      failureCategory,
      failureDetail
    };

    detailedDiagnostics.push(diag);
  }

  fs.writeFileSync(
    path.resolve(__dirname, '../data/detailed_diagnostics.json'),
    JSON.stringify(detailedDiagnostics, null, 2)
  );

  console.log('Diagnostics summary by failure category:');
  const catCounts = {};
  detailedDiagnostics.forEach(d => {
    catCounts[d.failureCategory] = (catCounts[d.failureCategory] || 0) + 1;
    console.log(`[#${d.index}] [${d.repo}] "${d.query}" -> ${d.failureCategory} | ${d.failureDetail}`);
  });
  console.log('\nCategory breakdown:', catCounts);
}

diagnose().catch(console.error);
