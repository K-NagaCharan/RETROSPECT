const path = require('path');
const fs = require('fs');
const { indexRepository, searchCurrentCode } = require('../src/structural');

async function runAudit() {
  const datasetPath = path.resolve(__dirname, '../data/structural_eval_benchmark.json');
  const fixturesDir = path.resolve(__dirname, '../data/fixtures/eval_repos');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const testQueries = dataset.filter(d => d.split === 'test');

  console.log(`Auditing ${testQueries.length} Held-Out Test Queries:\n`);

  for (let i = 0; i < testQueries.length; i++) {
    const item = testQueries[i];
    const repoPath = path.join(fixturesDir, item.repository_fixture);
    
    // Ensure indexed
    await indexRepository(repoPath);
    
    const searchRes = await searchCurrentCode(repoPath, item.query, { maxResults: 5 });
    
    const expected = item.expected_symbols;
    const isNoResult = item.is_no_result;
    
    console.log(`========================================================================`);
    console.log(`[Query #${i + 1}] ID: ${item.query_id} | Lang: ${item.language} | Cat: ${item.category}`);
    console.log(`Query: "${item.query}"`);
    console.log(`Expected: ${JSON.stringify(expected)} (is_no_result: ${isNoResult})`);
    console.log(`Rationale: ${item.rationale}`);
    console.log(`Top Retrieved Symbols:`);
    
    if (searchRes.results.length === 0) {
      console.log(`  (None returned)`);
    } else {
      searchRes.results.forEach((r, idx) => {
        const isMatch = expected.includes(r.name);
        console.log(`  Rank ${idx + 1}: ${r.name} (${r.kind}) in ${r.filePath}:${r.startLine} | Score: ${r.score.toFixed(4)} | Match: ${isMatch ? 'YES' : 'NO'}`);
        console.log(`     Reasons: ${r.matchReasons.join('; ')}`);
        console.log(`     Breakdown: ${JSON.stringify(r.scoreBreakdown)}`);
      });
    }

    let isCorrect = false;
    let rankOfMatch = -1;
    if (isNoResult) {
      isCorrect = searchRes.results.length === 0;
    } else {
      const matchIdx = searchRes.results.findIndex(r => expected.includes(r.name));
      if (matchIdx !== -1) {
        rankOfMatch = matchIdx + 1;
        isCorrect = (rankOfMatch === 1);
      }
    }
    
    console.log(`Verdict: ${isCorrect ? 'CORRECT (Rank 1 / Empty)' : (rankOfMatch > 0 ? `FOUND AT RANK ${rankOfMatch}` : 'FAILED (Not in Top 5)')}`);
    console.log(`========================================================================\n`);
  }
}

runAudit().catch(console.error);
