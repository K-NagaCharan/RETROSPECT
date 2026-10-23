const fs = require('fs');
const path = require('path');

const beforeData = JSON.parse(
  fs.readFileSync('reports/evaluator_preparation_2026-10-19/engineering_diagnostic_trace_before.json', 'utf8')
);
const afterData = JSON.parse(
  fs.readFileSync('reports/evaluator_preparation_2026-10-19/engineering_diagnostic_trace.json', 'utf8')
);

function computeMetrics(data, configKey) {
  let s1 = 0, s5 = 0, s10 = 0, mrrSum = 0, abstained = 0;
  const n = data.length;

  for (const c of data) {
    let rank = null;
    if (configKey === 'b1') rank = c.b1_rank;
    else if (configKey === 'b2') rank = c.b2_rank;
    else if (configKey === 'b3_base') rank = c.b3_rank;
    else if (configKey === 'b3_norm') rank = c.b3_norm_rank !== undefined ? c.b3_norm_rank : c.b3_rank;
    else if (configKey === 'b4_legacy') rank = c.b4_legacy_rank;
    else if (configKey === 'b4_improved') rank = c.b4_improved_rank;

    if (rank !== null && rank > 0) {
      if (rank <= 1) s1++;
      if (rank <= 5) s5++;
      if (rank <= 10) s10++;
      mrrSum += 1.0 / rank;
    } else {
      abstained++;
    }
  }

  return {
    success1: (s1 / n),
    success5: (s5 / n),
    success10: (s10 / n),
    mrr: (mrrSum / n),
    abstained,
    count: n
  };
}

console.log('=== BEFORE (BASELINE) METRICS ===');
for (const cfg of ['b1', 'b2', 'b3_base', 'b3_norm', 'b4_legacy', 'b4_improved']) {
  console.log(cfg, computeMetrics(beforeData, cfg));
}

console.log('\n=== AFTER (WITH COMPOUND QUERY PROCESSING) METRICS ===');
for (const cfg of ['b1', 'b2', 'b3_base', 'b3_norm', 'b4_legacy', 'b4_improved']) {
  console.log(cfg, computeMetrics(afterData, cfg));
}

console.log('\n=== CASE-BY-CASE COMPARISON (B1: Structural) ===');
console.log('| Case | Before B1 Rank (Score) | After B1 Rank (Score) |');
for (let i = 0; i < 8; i++) {
  const b = beforeData[i];
  const a = afterData[i];
  console.log(`| ${a.id} | ${b.b1_rank ?? 'null'} (${b.b1_score.toFixed(4)}) | ${a.b1_rank ?? 'null'} (${a.b1_score.toFixed(4)}) |`);
}

console.log('\n=== CASE-BY-CASE COMPARISON (B4_Improved: Balanced Cormack RRF) ===');
console.log('| Case | Before B4 Rank (Score) | After B4 Rank (Score) |');
for (let i = 0; i < 8; i++) {
  const b = beforeData[i];
  const a = afterData[i];
  console.log(`| ${a.id} | ${b.b4_improved_rank ?? 'null'} (${b.b4_improved_score.toFixed(4)}) | ${a.b4_improved_rank ?? 'null'} (${a.b4_improved_score.toFixed(4)}) |`);
}
