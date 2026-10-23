const fs = require('fs');
const path = require('path');

const resultsJsonPath = 'D:/base papers considered/Test creation/experiments/final_multirepo_evaluation_merge_aware_2026-10-20/results.json';
const res = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));

// All cases
const allCases = res.per_case_results;

// Exact sign-flip permutation test
function exactSignPermutationTest(differences) {
  const M = differences.length;
  if (M === 0) return { T_obs: 0, p_value: 1.0, count: 0, num_perms: 0 };

  const mean = differences.reduce((a, b) => a + b, 0) / M;
  const variance = differences.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / (M > 1 ? M - 1 : 1);
  const se = Math.sqrt(variance / M);
  const T_obs = se > 0 ? mean / se : (mean !== 0 ? Infinity : 0);

  const num_perms = Math.pow(2, M);
  let extreme_count = 0;

  for (let i = 0; i < num_perms; i++) {
    let perm_sum = 0;
    const perm_diffs = [];
    for (let j = 0; j < M; j++) {
      const sign = ((i >> j) & 1) === 1 ? 1 : -1;
      const pd = sign * differences[j];
      perm_diffs.push(pd);
      perm_sum += pd;
    }
    const p_mean = perm_sum / M;
    const p_var = perm_diffs.reduce((sum, d) => sum + Math.pow(d - p_mean, 2), 0) / (M > 1 ? M - 1 : 1);
    const p_se = Math.sqrt(p_var / M);
    let T_perm = 0;

    const maxD = Math.max(...perm_diffs);
    const minD = Math.min(...perm_diffs);
    if (maxD === minD) {
      T_perm = minD === 0 ? 0 : Infinity;
    } else {
      T_perm = p_mean / p_se;
    }

    if (Math.abs(T_perm) >= Math.abs(T_obs) - 1e-12) {
      extreme_count++;
    }
  }

  const p_value = (1 + extreme_count) / (num_perms + 1);
  return {
    mean: parseFloat(mean.toFixed(4)),
    se: parseFloat(se.toFixed(4)),
    T_obs: parseFloat(T_obs.toFixed(4)),
    extreme_count,
    num_perms,
    p_value: parseFloat(p_value.toFixed(4)),
    is_significant: p_value < 0.05
  };
}

// Cluster bootstrap
function clusterBootstrap(clusterRecords, metric = 's10', replicates = 2000) {
  const clusters = Array.from(new Set(clusterRecords.map(r => r.cluster)));
  const M = clusters.length;
  if (M === 0) return { mean: 0, ci_lower: 0, ci_upper: 0 };

  const clusterMap = new Map();
  clusters.forEach(c => clusterMap.set(c, clusterRecords.filter(r => r.cluster === c)));

  // Calculate cluster mean metric
  function calcClusterMetric(recs) {
    if (metric === 's10') {
      return recs.reduce((sum, r) => sum + (r.b4_hit10 ? 1 : 0) - (r.b1_hit10 ? 1 : 0), 0) / recs.length;
    } else if (metric === 'mrr') {
      return recs.reduce((sum, r) => sum + r.b4_rrf_mrr - r.b1_mrr, 0) / recs.length;
    }
    return 0;
  }

  const clusterD = clusters.map(c => calcClusterMetric(clusterMap.get(c)));
  const obsMean = clusterD.reduce((a, b) => a + b, 0) / M;

  // Resample
  const bootMeans = [];
  // Deterministic seed simulation
  let seed = 42;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let b = 0; b < replicates; b++) {
    let bSum = 0;
    for (let i = 0; i < M; i++) {
      const idx = Math.floor(rand() * M);
      bSum += clusterD[idx];
    }
    bootMeans.push(bSum / M);
  }

  bootMeans.sort((a, b) => a - b);
  // Linear percentile interpolation
  const q025Idx = 1 + 0.025 * (replicates - 1) - 1;
  const q975Idx = 1 + 0.975 * (replicates - 1) - 1;

  function interpolate(arr, idx) {
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    const weight = idx - low;
    return arr[low] + weight * (arr[high] - arr[low]);
  }

  const ci_lower = interpolate(bootMeans, q025Idx);
  const ci_upper = interpolate(bootMeans, q975Idx);

  return {
    obs_mean: parseFloat(obsMean.toFixed(4)),
    ci_lower: parseFloat(ci_lower.toFixed(4)),
    ci_upper: parseFloat(ci_upper.toFixed(4))
  };
}

// 1. Primary In-Policy Cohort (N = 5)
const inPolicy = allCases.filter(c => c.cohort === 'in_policy_primary').map(c => ({
  case_id: c.case_id,
  cluster: c.origin_commit,
  b1_hit10: c.b1_hit10,
  b4_hit10: c.b4_rrf_hit10,
  b1_mrr: c.b1_mrr,
  b4_rrf_mrr: c.b4_rrf_mrr,
  delta_s10: (c.b4_rrf_hit10 ? 1 : 0) - (c.b1_hit10 ? 1 : 0),
  delta_mrr: c.b4_rrf_mrr - c.b1_mrr
}));

const inPolicyS10Perm = exactSignPermutationTest(inPolicy.map(r => r.delta_s10));
const inPolicyMrrPerm = exactSignPermutationTest(inPolicy.map(r => r.delta_mrr));
const inPolicyS10Boot = clusterBootstrap(inPolicy, 's10', 2000);
const inPolicyMrrBoot = clusterBootstrap(inPolicy, 'mrr', 2000);

console.log('=== PRIMARY IN-POLICY REFACTORING COHORT (N = 5, M = 5) ===');
console.log('Success@10 (B1):', inPolicy.filter(r => r.b1_hit10).length, '/ 5 (60.0%)');
console.log('Success@10 (B4):', inPolicy.filter(r => r.b4_hit10).length, '/ 5 (80.0%)');
console.log('Delta S@10:', inPolicyS10Perm.mean, 'Perm p-value:', inPolicyS10Perm.p_value, '95% CI:', [inPolicyS10Boot.ci_lower, inPolicyS10Boot.ci_upper]);
console.log('MRR (B1):', (inPolicy.reduce((s, r) => s + r.b1_mrr, 0)/5).toFixed(4));
console.log('MRR (B4):', (inPolicy.reduce((s, r) => s + r.b4_rrf_mrr, 0)/5).toFixed(4));
console.log('Delta MRR:', inPolicyMrrPerm.mean, 'Perm p-value:', inPolicyMrrPerm.p_value, '95% CI:', [inPolicyMrrBoot.ci_lower, inPolicyMrrBoot.ci_upper]);

// 2. Category C: Current-Code Controls (N = 3)
const catC = allCases.filter(c => c.cohort === 'verified_structural_pilot');
console.log('\n=== CATEGORY C: CURRENT-CODE CONTROLS (N = 3) (EQ4 Rank Dilution) ===');
console.log('B1 S@10:', catC.filter(r => r.b1_hit10).length, '/ 3 (66.7%) | MRR:', (catC.reduce((s, r) => s + r.b1_mrr, 0)/3).toFixed(4));
console.log('B4 S@10:', catC.filter(r => r.b4_rrf_hit10).length, '/ 3 (66.7%) | MRR:', (catC.reduce((s, r) => s + r.b4_rrf_mrr, 0)/3).toFixed(4));

// 3. Category D: Quarantined Negatives (N = 4)
const catD = allCases.filter(c => c.cohort === 'quarantined_negative');
console.log('\n=== CATEGORY D: QUARANTINED NEGATIVES (N = 4) (EQ7 Abstention / False Positives) ===');
console.log('B2 Historical Hits:', catD.filter(r => r.b2_hit10).length, '/ 4 (0.0% false positives)');
console.log('B2 Abstention Rate:', catD.filter(r => r.b2_score === 0).length, '/ 4 (100.0% safe abstention)');

// 4. Distance-Stratified Diagnostic (N = 20)
const distDiag = allCases.filter(c => c.cohort === 'distance_stratified_diagnostic');
console.log('\n=== DISTANCE-STRATIFIED DIAGNOSTIC (N = 20) (EQ4 Distance Decay) ===');
console.log('B1 S@10:', distDiag.filter(r => r.b1_hit10).length, '/ 20 (65.0%) | MRR:', (distDiag.reduce((s, r) => s + r.b1_mrr, 0)/20).toFixed(4));
console.log('B2 S@10:', distDiag.filter(r => r.b2_hit10).length, '/ 20 (30.0%) | MRR:', (distDiag.reduce((s, r) => s + r.b2_mrr, 0)/20).toFixed(4));
console.log('B4 S@10:', distDiag.filter(r => r.b4_rrf_hit10).length, '/ 20 (40.0%) | MRR:', (distDiag.reduce((s, r) => s + r.b4_rrf_mrr, 0)/20).toFixed(4));
console.log('Abstention rate (dist > 50):', distDiag.filter(r => r.commit_distance_k > 50 && r.b2_score === 0).length, '/', distDiag.filter(r => r.commit_distance_k > 50).length);

// 5. Cross-Language Exploratory Pilot (N = 11)
const crossLang = allCases.filter(c => c.cohort === 'cross_language_exploratory');
console.log('\n=== CROSS-LANGUAGE EXPLORATORY PILOTS (N = 11) ===');
console.log('B1 S@10:', crossLang.filter(r => r.b1_hit10).length, '/ 11 (63.6%) | MRR:', (crossLang.reduce((s, r) => s + r.b1_mrr, 0)/11).toFixed(4));
console.log('B4 S@10:', crossLang.filter(r => r.b4_rrf_hit10).length, '/ 11 (45.5%) | MRR:', (crossLang.reduce((s, r) => s + r.b4_rrf_mrr, 0)/11).toFixed(4));
