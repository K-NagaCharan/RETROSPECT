const d = require('../data/detailed_diagnostics.json');

console.log('ID | Repo | Cat | Expected | CandRecall | Rank | FailCat | Top 1');
console.log('---|---|---|---|---|---|---|---');

d.forEach(q => {
  const top1 = q.top10.length > 0 ? `${q.top10[0].name} (${q.top10[0].score.toFixed(3)})` : 'none';
  console.log(`${q.queryId} | ${q.repo} | ${q.category} | ${JSON.stringify(q.expectedSymbols)} | ${q.candidateRecall} | ${q.rankOfFirstMatch} | ${q.failureCategory} | ${top1}`);
});
