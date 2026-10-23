const fs = require('fs');
const res = JSON.parse(fs.readFileSync('D:/base papers considered/Test creation/experiments/final_multirepo_evaluation_merge_aware_2026-10-20/results.json', 'utf8'));

const byCohort = {};
for (const c of res.per_case_results) {
  if (!byCohort[c.cohort]) byCohort[c.cohort] = [];
  byCohort[c.cohort].push(c);
}

console.log('Cohort                          | N  | B1 S@10 (%) | B2 S@10 (%) | B3 S@10 (%) | B4 S@10 (%) | B1 MRR | B4 MRR');
console.log('--------------------------------+----+-------------+-------------+-------------+-------------+--------+-------');

for (const [coh, cases] of Object.entries(byCohort)) {
  const n = cases.length;
  const b1_s10 = cases.filter(c => c.b1_hit10).length;
  const b2_s10 = cases.filter(c => c.b2_hit10).length;
  const b3_s10 = cases.filter(c => c.b3_linear_hit10).length;
  const b4_s10 = cases.filter(c => c.b4_rrf_hit10).length;
  const b1_mrr = (cases.reduce((s, c) => s + c.b1_mrr, 0) / n).toFixed(4);
  const b4_mrr = (cases.reduce((s, c) => s + c.b4_rrf_mrr, 0) / n).toFixed(4);

  const b1Str = `${b1_s10}/${n} (${((b1_s10/n)*100).toFixed(1)}%)`.padEnd(11);
  const b2Str = `${b2_s10}/${n} (${((b2_s10/n)*100).toFixed(1)}%)`.padEnd(11);
  const b3Str = `${b3_s10}/${n} (${((b3_s10/n)*100).toFixed(1)}%)`.padEnd(11);
  const b4Str = `${b4_s10}/${n} (${((b4_s10/n)*100).toFixed(1)}%)`.padEnd(11);

  console.log(`${coh.padEnd(31)} | ${String(n).padStart(2)} | ${b1Str} | ${b2Str} | ${b3Str} | ${b4Str} | ${b1_mrr.padStart(6)} | ${b4_mrr.padStart(6)}`);
}
