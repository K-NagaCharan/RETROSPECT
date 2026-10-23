const fs = require('fs');
const path = require('path');

const perCasePath = 'D:/base papers considered/Test creation/experiments/final_multirepo_evaluation_audit_2026-10-20/corrected_per_case_results.csv';
const lines = fs.readFileSync(perCasePath, 'utf8').trim().split('\n');
const header = lines[0].split(',');

// Parse CSV rows handling quotes
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

const cases = [];
for (let i = 1; i < lines.length; i++) {
  const vals = parseCSVRow(lines[i]);
  const obj = {};
  header.forEach((h, idx) => {
    obj[h.trim()] = vals[idx] ? vals[idx].trim().replace(/^"|"$/g, '') : null;
  });
  cases.push(obj);
}

console.log(`Parsed ${cases.length} cases.`);

// Classify outcome categories A, B, C, D at K=10
for (const c of cases) {
  const b1_rank = c.b1_rank && c.b1_rank !== 'null' ? parseInt(c.b1_rank, 10) : null;
  const b2_rank = c.b2_rank && c.b2_rank !== 'null' ? parseInt(c.b2_rank, 10) : null;
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

  c.b1_rank_num = b1_rank;
  c.b2_rank_num = b2_rank;
  c.b4_rank_num = b4_rank;
  c.b1_hit10 = b1_hit10;
  c.b2_hit10 = b2_hit10;
  c.b4_hit10 = b4_hit10;
  c.four_category_outcome = outcome;
  c.fusion_impact = fusion_impact;
}

// Function to compute summary metrics for a case subset
function summarizeCohort(subset, name) {
  const N = subset.length;
  if (N === 0) return;
  const histAdv = subset.filter(c => c.four_category_outcome === 'A_HISTORICAL_ADVANTAGE').length;
  const shared = subset.filter(c => c.four_category_outcome === 'B_SHARED_SUCCESS').length;
  const structOnly = subset.filter(c => c.four_category_outcome === 'C_STRUCTURAL_ONLY').length;
  const neither = subset.filter(c => c.four_category_outcome === 'D_NEITHER').length;

  const b1_s10 = subset.filter(c => c.b1_hit10).length;
  const b2_s10 = subset.filter(c => c.b2_hit10).length;
  const b4_s10 = subset.filter(c => c.b4_hit10).length;

  const b1_s1 = subset.filter(c => c.b1_rank_num === 1).length;
  const b2_s1 = subset.filter(c => c.b2_rank_num === 1).length;
  const b4_s1 = subset.filter(c => c.b4_rank_num === 1).length;

  const b1_s5 = subset.filter(c => c.b1_rank_num && c.b1_rank_num <= 5).length;
  const b2_s5 = subset.filter(c => c.b2_rank_num && c.b2_rank_num <= 5).length;
  const b4_s5 = subset.filter(c => c.b4_rank_num && c.b4_rank_num <= 5).length;

  const b1_mrr = subset.reduce((acc, c) => acc + (c.b1_rank_num ? 1 / c.b1_rank_num : 0), 0) / N;
  const b2_mrr = subset.reduce((acc, c) => acc + (c.b2_rank_num ? 1 / c.b2_rank_num : 0), 0) / N;
  const b4_mrr = subset.reduce((acc, c) => acc + (c.b4_rank_num ? 1 / c.b4_rank_num : 0), 0) / N;

  const rescues = subset.filter(c => c.fusion_impact === 'FUSION_RESCUE').length;
  const harms = subset.filter(c => c.fusion_impact === 'FUSION_HARM').length;

  console.log(`\n======================================================`);
  console.log(`COHORT: ${name} (N = ${N})`);
  console.log(`======================================================`);
  console.log(`Four-Category Outcomes (at K=10):`);
  console.log(`  A. Historical Advantage: ${histAdv} (${((histAdv/N)*100).toFixed(1)}%)`);
  console.log(`  B. Shared Success:       ${shared} (${((shared/N)*100).toFixed(1)}%)`);
  console.log(`  C. Structural-Only:      ${structOnly} (${((structOnly/N)*100).toFixed(1)}%)`);
  console.log(`  D. Neither Succeeds:     ${neither} (${((neither/N)*100).toFixed(1)}%)`);
  console.log(`Historical Incremental Recovery: ${histAdv} / ${N} (${((histAdv/N)*100).toFixed(1)}%)`);
  console.log(`Fusion Impact (B4 vs B1):`);
  console.log(`  Rescues (B4 helps):      ${rescues} (${((rescues/N)*100).toFixed(1)}%)`);
  console.log(`  Harms (B4 dilutes):      ${harms} (${((harms/N)*100).toFixed(1)}%)`);
  console.log(`Ranking Metrics:`);
  console.log(`  Success@1:  B1: ${(b1_s1/N*100).toFixed(1)}% | B2: ${(b2_s1/N*100).toFixed(1)}% | B4: ${(b4_s1/N*100).toFixed(1)}%`);
  console.log(`  Success@5:  B1: ${(b1_s5/N*100).toFixed(1)}% | B2: ${(b2_s5/N*100).toFixed(1)}% | B4: ${(b4_s5/N*100).toFixed(1)}%`);
  console.log(`  Success@10: B1: ${(b1_s10/N*100).toFixed(1)}% | B2: ${(b2_s10/N*100).toFixed(1)}% | B4: ${(b4_s10/N*100).toFixed(1)}%`);
  console.log(`  Mean MRR:   B1: ${b1_mrr.toFixed(4)} | B2: ${b2_mrr.toFixed(4)} | B4: ${b4_mrr.toFixed(4)} (Delta MRR: ${(b4_mrr - b1_mrr).toFixed(4)})`);
}

// 1. Primary In-Policy
summarizeCohort(cases.filter(c => c.cohort === 'in_policy_primary'), 'Primary In-Policy Refactorings');

// 2. Category C Controls
summarizeCohort(cases.filter(c => c.cohort === 'verified_structural_pilot'), 'Category C: Current-Code Controls');

// 3. Category D Negatives
summarizeCohort(cases.filter(c => c.cohort === 'quarantined_negative'), 'Category D: Quarantined Negatives');

// 4. Distance Stratified Diagnostic
summarizeCohort(cases.filter(c => c.cohort === 'distance_stratified_diagnostic'), 'Distance-Stratified Diagnostic');

// 5. Cross-Language Pilots
summarizeCohort(cases.filter(c => c.cohort === 'cross_language_exploratory'), 'Cross-Language Exploratory Pilots');

// 6. Detailed inspection of Primary In-Policy cases
console.log(`\n======================================================`);
console.log(`PRIMARY IN-POLICY CASES DETAIL`);
console.log(`======================================================`);
for (const c of cases.filter(c => c.cohort === 'in_policy_primary')) {
  console.log(`${c.case_id} (${c.repository_id}):`);
  console.log(`  Target: ${c.target_symbol_name} (${c.target_file_path})`);
  console.log(`  Query:  "${c.query_text}"`);
  console.log(`  Ranks:  B1=${c.b1_rank} | B2=${c.b2_rank} | B4=${c.b4_rank}`);
  console.log(`  Scores: B1=${c.b1_score} | B2=${c.b2_score} | B4=${c.b4_score}`);
  console.log(`  Status: Outcome=${c.four_category_outcome} | Fusion=${c.fusion_impact} | StageB=${c.stage_b_match_type}`);
}
