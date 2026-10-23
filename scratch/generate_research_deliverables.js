const fs = require('fs');
const path = require('path');

const perCaseAuditPath = 'D:/base papers considered/Test creation/experiments/final_multirepo_evaluation_audit_2026-10-20/corrected_per_case_results.csv';
const lines = fs.readFileSync(perCaseAuditPath, 'utf8').trim().split('\n');

function parseCSVRow(row) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' && (i === 0 || row[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

const header = parseCSVRow(lines[0]);
const rawCases = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVRow(lines[i]);
  const obj = {};
  header.forEach((h, idx) => {
    obj[h.trim()] = vals[idx] ? vals[idx].trim().replace(/^"|"$/g, '') : null;
  });
  rawCases.push(obj);
}

// Enhance cases with exact four-category outcome, fusion impact, and granular failure modes
for (const c of rawCases) {
  const b1_rank = c.b1_rank && c.b1_rank !== 'null' ? parseInt(c.b1_rank, 10) : null;
  const b2_rank = c.b2_rank && c.b2_rank !== 'null' ? parseInt(c.b2_rank, 10) : null;
  const b3_rank = c.b3_rank && c.b3_rank !== 'null' ? parseInt(c.b3_rank, 10) : null;
  const b4_rank = c.b4_rank && c.b4_rank !== 'null' ? parseInt(c.b4_rank, 10) : null;

  const b1_hit10 = b1_rank !== null && b1_rank <= 10;
  const b2_hit10 = b2_rank !== null && b2_rank <= 10;
  const b4_hit10 = b4_rank !== null && b4_rank <= 10;

  let outcome = 'D_NEITHER';
  if (b2_hit10 && !b1_hit10) {
    outcome = 'A_HISTORICAL_ADVANTAGE';
  } else if (b1_hit10 && b2_hit10) {
    outcome = 'B_SHARED_SUCCESS';
  } else if (b1_hit10 && !b2_hit10) {
    outcome = 'C_STRUCTURAL_ONLY';
  } else {
    outcome = 'D_NEITHER';
  }

  let fusion_impact = 'NEUTRAL';
  if (b4_hit10 && !b1_hit10) {
    fusion_impact = 'FUSION_RESCUE';
  } else if (b1_hit10 && !b4_hit10) {
    fusion_impact = 'FUSION_HARM';
  }

  // Granular failure classification
  let failure_mode = 'NONE_SUCCESS';
  if (!b2_hit10) {
    if (c.cohort === 'quarantined_negative') {
      failure_mode = 'INTENDED_ABSTENTION_NEGATIVE';
    } else if (c.stage_a_reachability === 'OUTSIDE_SEARCH_HORIZON' || (c.commit_distance && parseInt(c.commit_distance, 10) > 50 && b2_rank === null)) {
      failure_mode = 'LOOKBACK_HORIZON_EXCEEDED';
    } else if (c.stage_b_match_type === 'AMBIGUOUS') {
      failure_mode = 'AMBIGUITY_GUARD_SUPPRESSION';
    } else if (c.stage_b_match_type === 'UNMATCHED') {
      failure_mode = 'VOCABULARY_OR_DIFF_MISMATCH';
    } else if (b2_rank !== null && b2_rank > 10) {
      failure_mode = 'RANKED_BELOW_CUTOFF';
    } else {
      failure_mode = 'NO_HISTORICAL_EVIDENCE';
    }
  }

  c.b1_rank_num = b1_rank;
  c.b2_rank_num = b2_rank;
  c.b3_rank_num = b3_rank;
  c.b4_rank_num = b4_rank;
  c.b1_hit10 = b1_hit10;
  c.b2_hit10 = b2_hit10;
  c.b4_hit10 = b4_hit10;
  c.four_category_outcome = outcome;
  c.fusion_impact = fusion_impact;
  c.failure_mode = failure_mode;
}

const outDir = 'D:/base papers considered/Retrospect/research';

// 1. Write research/per_case_empirical_results.csv
const perCaseCols = [
  'case_id', 'repository_id', 'language', 'cohort', 'commit_distance',
  'query_text', 'target_symbol_name', 'target_file_path', 'contains_historical_identifier',
  'b1_score', 'b1_rank', 'b2_score', 'b2_rank', 'b3_score', 'b3_rank', 'b4_score', 'b4_rank',
  'four_category_outcome', 'fusion_impact', 'stage_a_reachability', 'stage_b_match_type', 'failure_mode'
];

const perCaseCsvRows = [perCaseCols.join(',')];
for (const c of rawCases) {
  const rowVals = perCaseCols.map(col => {
    let val = c[col] !== undefined && c[col] !== null ? String(c[col]) : '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      val = `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  });
  perCaseCsvRows.push(rowVals.join(','));
}
fs.writeFileSync(path.join(outDir, 'per_case_empirical_results.csv'), perCaseCsvRows.join('\n'));
console.log('Saved per_case_empirical_results.csv');

// 2. Aggregate Metrics
function calcMetrics(subset) {
  const N = subset.length;
  if (N === 0) return null;
  const histAdv = subset.filter(c => c.four_category_outcome === 'A_HISTORICAL_ADVANTAGE').length;
  const shared = subset.filter(c => c.four_category_outcome === 'B_SHARED_SUCCESS').length;
  const structOnly = subset.filter(c => c.four_category_outcome === 'C_STRUCTURAL_ONLY').length;
  const neither = subset.filter(c => c.four_category_outcome === 'D_NEITHER').length;

  const b1_s1 = subset.filter(c => c.b1_rank_num === 1).length;
  const b2_s1 = subset.filter(c => c.b2_rank_num === 1).length;
  const b3_s1 = subset.filter(c => c.b3_rank_num === 1).length;
  const b4_s1 = subset.filter(c => c.b4_rank_num === 1).length;

  const b1_s5 = subset.filter(c => c.b1_rank_num && c.b1_rank_num <= 5).length;
  const b2_s5 = subset.filter(c => c.b2_rank_num && c.b2_rank_num <= 5).length;
  const b3_s5 = subset.filter(c => c.b3_rank_num && c.b3_rank_num <= 5).length;
  const b4_s5 = subset.filter(c => c.b4_rank_num && c.b4_rank_num <= 5).length;

  const b1_s10 = subset.filter(c => c.b1_hit10).length;
  const b2_s10 = subset.filter(c => c.b2_hit10).length;
  const b3_s10 = subset.filter(c => c.b3_rank_num && c.b3_rank_num <= 10).length;
  const b4_s10 = subset.filter(c => c.b4_hit10).length;

  const b1_mrr = subset.reduce((acc, c) => acc + (c.b1_rank_num ? 1 / c.b1_rank_num : 0), 0) / N;
  const b2_mrr = subset.reduce((acc, c) => acc + (c.b2_rank_num ? 1 / c.b2_rank_num : 0), 0) / N;
  const b3_mrr = subset.reduce((acc, c) => acc + (c.b3_rank_num ? 1 / c.b3_rank_num : 0), 0) / N;
  const b4_mrr = subset.reduce((acc, c) => acc + (c.b4_rank_num ? 1 / c.b4_rank_num : 0), 0) / N;

  const rescues = subset.filter(c => c.fusion_impact === 'FUSION_RESCUE').length;
  const harms = subset.filter(c => c.fusion_impact === 'FUSION_HARM').length;

  return {
    N,
    histAdv_count: histAdv,
    histAdv_rate: +(histAdv / N).toFixed(4),
    shared_count: shared,
    shared_rate: +(shared / N).toFixed(4),
    structOnly_count: structOnly,
    structOnly_rate: +(structOnly / N).toFixed(4),
    neither_count: neither,
    neither_rate: +(neither / N).toFixed(4),
    b1_success1: +(b1_s1 / N).toFixed(4),
    b1_success5: +(b1_s5 / N).toFixed(4),
    b1_success10: +(b1_s10 / N).toFixed(4),
    b1_mrr: +b1_mrr.toFixed(4),
    b2_success1: +(b2_s1 / N).toFixed(4),
    b2_success5: +(b2_s5 / N).toFixed(4),
    b2_success10: +(b2_s10 / N).toFixed(4),
    b2_mrr: +b2_mrr.toFixed(4),
    b3_success1: +(b3_s1 / N).toFixed(4),
    b3_success5: +(b3_s5 / N).toFixed(4),
    b3_success10: +(b3_s10 / N).toFixed(4),
    b3_mrr: +b3_mrr.toFixed(4),
    b4_success1: +(b4_s1 / N).toFixed(4),
    b4_success5: +(b4_s5 / N).toFixed(4),
    b4_success10: +(b4_s10 / N).toFixed(4),
    b4_mrr: +b4_mrr.toFixed(4),
    delta_s10: +((b4_s10 - b1_s10) / N).toFixed(4),
    delta_mrr: +(b4_mrr - b1_mrr).toFixed(4),
    rescues_count: rescues,
    harms_count: harms
  };
}

const cohorts = [
  { id: 'in_policy_primary', name: 'Primary In-Policy Refactorings' },
  { id: 'verified_structural_pilot', name: 'Category C: Current-Code Controls' },
  { id: 'quarantined_negative', name: 'Category D: Quarantined Negatives' },
  { id: 'distance_stratified_diagnostic', name: 'Distance-Stratified Diagnostic' },
  { id: 'cross_language_exploratory', name: 'Cross-Language Exploratory Pilots' },
  { id: 'verified_historical_pilot', name: 'Historical Pilot Anchors' }
];

const aggregateSummary = {};
const aggCsvRows = [
  'cohort_id,cohort_name,N,hist_advantage_pct,shared_success_pct,struct_only_pct,neither_pct,b1_s10_pct,b2_s10_pct,b3_s10_pct,b4_s10_pct,b1_mrr,b2_mrr,b3_mrr,b4_mrr,delta_s10_pct,delta_mrr,rescues,harms'
];

for (const ch of cohorts) {
  const sub = rawCases.filter(c => c.cohort === ch.id);
  const met = calcMetrics(sub);
  if (met) {
    aggregateSummary[ch.id] = { name: ch.name, ...met };
    aggCsvRows.push([
      ch.id,
      `"${ch.name}"`,
      met.N,
      (met.histAdv_rate * 100).toFixed(1),
      (met.shared_rate * 100).toFixed(1),
      (met.structOnly_rate * 100).toFixed(1),
      (met.neither_rate * 100).toFixed(1),
      (met.b1_success10 * 100).toFixed(1),
      (met.b2_success10 * 100).toFixed(1),
      (met.b3_success10 * 100).toFixed(1),
      (met.b4_success10 * 100).toFixed(1),
      met.b1_mrr.toFixed(4),
      met.b2_mrr.toFixed(4),
      met.b3_mrr.toFixed(4),
      met.b4_mrr.toFixed(4),
      (met.delta_s10 * 100).toFixed(1),
      met.delta_mrr.toFixed(4),
      met.rescues_count,
      met.harms_count
    ].join(','));
  }
}

fs.writeFileSync(path.join(outDir, 'aggregate_empirical_metrics.json'), JSON.stringify(aggregateSummary, null, 2));
fs.writeFileSync(path.join(outDir, 'aggregate_empirical_metrics.csv'), aggCsvRows.join('\n'));
console.log('Saved aggregate_empirical_metrics.json and .csv');

// 3. Category Breakdown CSV
const breakdownRows = [
  'breakdown_dimension,stratum,N,b1_s10_pct,b2_s10_pct,b4_s10_pct,b1_mrr,b2_mrr,b4_mrr,hist_adv_count,shared_count,struct_only_count,neither_count'
];

function addBreakdown(dim, groupKeyFn) {
  const groups = {};
  for (const c of rawCases) {
    const key = groupKeyFn(c);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  for (const [key, sub] of Object.entries(groups)) {
    const met = calcMetrics(sub);
    breakdownRows.push([
      dim,
      `"${key}"`,
      met.N,
      (met.b1_success10 * 100).toFixed(1),
      (met.b2_success10 * 100).toFixed(1),
      (met.b4_success10 * 100).toFixed(1),
      met.b1_mrr.toFixed(4),
      met.b2_mrr.toFixed(4),
      met.b4_mrr.toFixed(4),
      met.histAdv_count,
      met.shared_count,
      met.structOnly_count,
      met.neither_count
    ].join(','));
  }
}

// By Language
addBreakdown('Language', c => c.language || 'Java');

// By Distance Band
addBreakdown('Commit Distance Band', c => {
  const d = c.commit_distance && c.commit_distance !== 'null' ? parseInt(c.commit_distance, 10) : null;
  if (d === null) return 'No Distance (Control/Pilot)';
  if (d === 0) return '0 commits (Current/Anchor)';
  if (d <= 10) return '1-10 commits';
  if (d <= 50) return '11-50 commits (In-Policy)';
  if (d <= 100) return '51-100 commits (Near Horizon)';
  return '>100 commits (Deep History)';
});

// By Query Type
addBreakdown('Query Identifier Content', c => {
  return c.contains_historical_identifier === 'true' || c.contains_historical_identifier === true
    ? 'Identifier-Assisted'
    : 'Behavioral-Only';
});

fs.writeFileSync(path.join(outDir, 'category_breakdown.csv'), breakdownRows.join('\n'));
console.log('Saved category_breakdown.csv');
