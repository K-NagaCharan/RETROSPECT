const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const retrospectRoot = 'd:/base papers considered/Retrospect';
const clonesRoot = 'D:/clones';
const repoPath = path.join(clonesRoot, 'guava');
const commit = 'db74bd2fdac443223d45e6fc5c66548542be1081';

const { indexRepository } = require(path.join(retrospectRoot, 'src/structural/index'));
const { StructuralRetriever } = require(path.join(retrospectRoot, 'src/structural/retrieval/StructuralRetriever'));
const QueryProcessor = require(path.join(retrospectRoot, 'src/structural/query/QueryProcessor'));
const HistoricalRetrievalAdapter = require(path.join(retrospectRoot, 'src/retrieval/HistoricalRetrievalAdapter'));
const { fuseRRFv2 } = require(path.join(retrospectRoot, 'src/retrieval/RRFv2'));

const target = {
  symbol_name: 'CollectPreconditions.checkNonnegative',
  short_name: 'checkNonnegative',
  file_path: 'guava/src/com/google/common/collect/CollectPreconditions.java',
  line_range: [38, 44]
};

const queryText = 'Multisets.checkNonnegative';

async function runTrace() {
  console.log(`Checking out guava to ${commit}...`);
  const origBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath }).toString().trim();
  execSync(`git checkout --detach ${commit}`, { cwd: repoPath });

  try {
    console.log('Indexing guava structural symbols...');
    const sIndex = await indexRepository(repoPath, { forceRebuild: true });
    const allSymbols = Array.from(sIndex.symbols.values());
    console.log(`Total symbols indexed: ${allSymbols.length}`);

    console.log('Indexing guava history (50 commits)...');
    const histAdapter = new HistoricalRetrievalAdapter();
    const histRes = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, { maxCommits: 50, startCommit: commit });
    const candidates = allSymbols.map(sym => ({
      symbol: sym,
      historyProfile: histRes.profileMap.get(sym.id) || null
    }));

    const q = QueryProcessor.process(queryText);

    // B1: Structural
    const retriever = new StructuralRetriever(sIndex);
    const b1_ranked = retriever.rankCandidates(q, allSymbols);
    b1_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    // B2: Historical
    const b2_ranked = histAdapter.rankHistoricalOnly(q, candidates, {}, { enforceCandidateParity: true });
    b2_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    // B3: Linear
    const sMap = new Map();
    b1_ranked.forEach(r => sMap.set(r.symbol.id, r.score));
    const hMap = new Map();
    b2_ranked.forEach(r => hMap.set(r.symbol.id, r.score));

    const b3_fused = candidates.map(c => {
      const sScore = sMap.get(c.symbol.id) || 0.0;
      const hScore = hMap.get(c.symbol.id) || 0.0;
      return {
        symbol: c.symbol,
        score: HistoricalRetrievalAdapter.fuseScores(sScore, hScore, { structural: 0.60, historical: 0.40 }),
        structuralScore: sScore,
        historicalScore: hScore
      };
    });
    b3_fused.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

    // B4: RRF-v2
    const b4_fused = fuseRRFv2(
      candidates.map(c => c.symbol),
      b1_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      b2_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
      { k: 60, weightStructural: 0.60, weightHistorical: 0.40 }
    );

    function findMatch(rankedList, matchMode) {
      for (let i = 0; i < rankedList.length; i++) {
        const sym = rankedList[i].symbol || rankedList[i];
        const normPath = (sym.filePath || '').replace(/\\/g, '/').toLowerCase();
        const normTarget = target.file_path.replace(/\\/g, '/').toLowerCase();
        
        let pathMatches = false;
        if (matchMode === 'endsWith') {
          pathMatches = normPath.endsWith(normTarget) || normTarget.endsWith(normPath);
        } else if (matchMode === 'exact') {
          pathMatches = normPath === normTarget;
        }

        const nameMatches = sym.name === target.short_name ||
                            sym.name === target.symbol_name ||
                            (sym.qualifiedName && sym.qualifiedName.endsWith('.' + target.short_name));

        if (pathMatches && nameMatches) {
          return {
            rank: i + 1,
            score: rankedList[i].score,
            symbol: sym
          };
        }
      }
      return null;
    }

    console.log('\n======================================================');
    console.log('RESULTS WITH MATCH MODE: endsWith (Diagnostic Harness Matching)');
    console.log('======================================================');
    console.log('B1:', findMatch(b1_ranked, 'endsWith'));
    console.log('B2:', findMatch(b2_ranked, 'endsWith'));
    console.log('B3:', findMatch(b3_fused, 'endsWith'));
    console.log('B4:', findMatch(b4_fused, 'endsWith'));

    console.log('\n======================================================');
    console.log('RESULTS WITH MATCH MODE: exact (guava/src/... only, excluding android/guava)');
    console.log('======================================================');
    console.log('B1:', findMatch(b1_ranked, 'exact'));
    console.log('B2:', findMatch(b2_ranked, 'exact'));
    console.log('B3:', findMatch(b3_fused, 'exact'));
    console.log('B4:', findMatch(b4_fused, 'exact'));

    console.log('\nTop 10 candidates in B1:');
    b1_ranked.slice(0, 10).forEach((r, idx) => {
      console.log(`  #${idx+1} [${r.score.toFixed(4)}] ${r.symbol.filePath} :: ${r.symbol.name} (${r.symbol.range ? r.symbol.range.startLine : '?'})`);
    });

    console.log('\nTop 10 candidates in B3:');
    b3_fused.slice(0, 10).forEach((r, idx) => {
      console.log(`  #${idx+1} [${r.score.toFixed(4)}] (S=${r.structuralScore.toFixed(4)}, H=${r.historicalScore.toFixed(4)}) ${r.symbol.filePath} :: ${r.symbol.name}`);
    });

    console.log('\nTop 10 candidates in B4:');
    b4_fused.slice(0, 10).forEach((r, idx) => {
      console.log(`  #${idx+1} [${r.score.toFixed(6)}] ${r.symbol.filePath} :: ${r.symbol.name}`);
    });

  } finally {
    execSync(`git checkout ${origBranch === 'HEAD' ? 'master' : origBranch}`, { cwd: repoPath });
    console.log('\nRestored guava working tree to master.');
  }
}

runTrace().catch(err => {
  console.error('Fatal trace error:', err);
  process.exit(1);
});
