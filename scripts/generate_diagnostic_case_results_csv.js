const fs = require('fs');
const path = require('path');

const traceData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../reports/evaluator_preparation_2026-10-19/engineering_diagnostic_trace.json'), 'utf8')
);

const headers = [
  'case_id',
  'case_name',
  'repository',
  'distance',
  'configuration',
  'target_symbol',
  'target_indexed',
  'history_reachable',
  'lineage_detected',
  'target_in_candidates',
  'score',
  'rank',
  'success_at_1',
  'success_at_5',
  'success_at_10',
  'recall_at_1',
  'recall_at_5',
  'recall_at_10',
  'abstained',
  'latency_ms',
  'primary_failure_category'
];

const rows = [headers.join(',')];

for (const c of traceData) {
  const e2e = c.latencies.end_to_end || c.latencies;
  const configs = [
    { id: 'B1', score: c.b1_score, rank: c.b1_rank, lat: e2e.b1 },
    { id: 'B2', score: c.b2_score, rank: c.b2_rank, lat: e2e.b2 },
    { id: 'B3_Baseline', score: c.b3_score, rank: c.b3_rank, lat: e2e.b3 },
    { id: 'B3_Normalized', score: c.b3_norm_score !== undefined ? c.b3_norm_score : c.b3_score, rank: c.b3_norm_rank !== undefined ? c.b3_norm_rank : c.b3_rank, lat: e2e.b3 },
    { id: 'B4_Baseline', score: c.b4_legacy_score, rank: c.b4_legacy_rank, lat: e2e.b4 },
    { id: 'B4_Modified', score: c.b4_improved_score, rank: c.b4_improved_rank, lat: e2e.b4 }
  ];

  const targetIndexed = true;
  const historyReachable = c.distance <= 50;
  const lineageDetected = c.b2_rank !== null && c.b2_rank <= 10;

  for (const cfg of configs) {
    const r = cfg.rank;
    const hasRank = r !== null && r !== undefined && r > 0;
    const s1 = hasRank && r <= 1 ? 1 : 0;
    const s5 = hasRank && r <= 5 ? 1 : 0;
    const s10 = hasRank && r <= 10 ? 1 : 0;
    const abstained = hasRank ? 0 : 1;

    rows.push([
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.repo,
      c.distance,
      cfg.id,
      `"${c.name.split(' ')[1] || c.id}"`,
      targetIndexed ? 1 : 0,
      historyReachable ? 1 : 0,
      lineageDetected ? 1 : 0,
      hasRank ? 1 : 0,
      cfg.score.toFixed(4),
      hasRank ? r : 'null',
      s1,
      s5,
      s10,
      s1,
      s5,
      s10,
      abstained,
      cfg.lat,
      c.failure_category
    ].join(','));
  }
}

const outPath = path.join(__dirname, '../reports/evaluator_preparation_2026-10-19/engineering_diagnostic_case_results.csv');
fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
console.log(`Generated CSV: ${outPath} (${rows.length - 1} rows)`);
