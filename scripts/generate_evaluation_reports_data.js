const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '../reports/retrospect_evaluation');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Load existing raw data
const phaseBResults = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/phase_b_evaluation_results.json'), 'utf8'));
const phaseBAudit = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/phase_b_audit_results.json'), 'utf8'));
const queriesV4 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/evaluation_lineage_queries_v4.json'), 'utf8'));
const histV2 = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/historical_evaluation_results_v2.json'), 'utf8'));

// Helper to escape CSV fields
function csvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(filename, headers, rows) {
  const content = [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(h => csvCell(row[h])).join(','))
  ].join('\n');
  fs.writeFileSync(path.join(outDir, filename), content, 'utf8');
  console.log(`Wrote ${filename} (${rows.length} rows)`);
}

// -------------------------------------------------------------
// 1. run_manifest.json
// -------------------------------------------------------------
const runManifest = {
  manifest_version: "1.0.0",
  generated_at: new Date().toISOString(),
  study_title: "Retrospect: Evolution-Aware Context Retrieval for Repository-Level LLMs",
  evaluation_phase: "Phase B Audited Results & Phase D Preregistration Framework",
  operational_gate_status: "STRICTLY CLOSED / BLOCKED — FORMAL HUMAN PROTOCOL APPROVAL REQUIRED",
  frozen_baseline: {
    git_commit_sha: "17ea399217737f8d5fe2c32c310b69c2f812b84d",
    branch: "main",
    repository_status: "Untouched tracked repository files; untracked experimental files isolated"
  },
  environment: {
    runtime: process.version,
    platform: process.platform,
    arch: process.arch,
    dependencies: {
      "tree-sitter-wasms": "^0.1.13",
      "web-tree-sitter": "^0.20.8",
      "jest": "^30.5.2"
    }
  },
  evaluated_configurations: [
    {
      id: "B1",
      name: "Structural-Only Baseline",
      implementation_file: "src/structural/retrieval/StructuralRetriever.js",
      status: "FROZEN_BASELINE_EVIDENCE",
      sha256: "9380234C73DEEBDBBC12B498CED34469CD99DE6DEB20DAF94AABFA31CBD2FDD6"
    },
    {
      id: "B2",
      name: "Historical-Only Baseline",
      implementation_file: "src/retrieval/HistoricalRetrievalAdapter.js",
      status: "FROZEN_BASELINE_EVIDENCE",
      sha256: "60F114D8770D0A70108BC343C21ACF2C9F4389FC226270DEFFCA3CE6C0BCA965"
    },
    {
      id: "B3",
      name: "Legacy RRF-v1 Fusion",
      implementation_file: "src/retrieval/UnifiedSearch.js",
      status: "FROZEN_BASELINE_EVIDENCE",
      sha256: "156E4149BA57BF17B4E0B92ED2968F57510E987595CF4EBEAAC791FF695B844E"
    },
    {
      id: "S1",
      name: "Hardened RRF-v2 Candidate",
      implementation_file: "src/retrieval/RRFv2.js",
      status: "EXPERIMENTAL_UNTRACKED_PROPOSED",
      sha256: "343B7819766333A2691130C33CA72A2D5D128F361734869946B98B70289A84F6"
    },
    {
      id: "B4",
      name: "Historical BM25 Baseline",
      implementation_file: "src/retrieval/HistoricalBM25Retriever.js",
      status: "PROPOSED_NOT_YET_IMPLEMENTED",
      sha256: null
    }
  ],
  datasets: {
    phase_b: {
      queries_file: "data/evaluation_lineage_queries_v4.json",
      benchmark_file: "data/benchmark_lineage_audited_v3.json",
      total_queries: 40,
      answerable_queries: 34,
      negative_queries: 6,
      repositories: ["bottle", "express", "zod", "gson"],
      total_candidate_symbols: 11915,
      role: "DIAGNOSTIC_AND_PARAMETER_TUNING_ONLY (Non-confirmatory)"
    },
    phase_d_proposed: {
      protocol_version: "3.5",
      protocol_file: "docs/phase_d/phase_d_v3_5_exploratory_protocol.md",
      supervisor_brief: "docs/phase_d/phase_d_v3_5_supervisor_review_brief.md",
      planned_repositories: ["fastify", "flask"],
      planned_clusters: 18,
      status: "BLOCKED_PENDING_SUPERVISOR_APPROVAL"
    }
  },
  known_evaluator_defects: [
    {
      defect_id: "DEF-01",
      description: "Invalid RRF abstention threshold: evaluate_phase_b_fusion.js tested top1.score >= 0.20, which is mathematically impossible for RRF scores bounded by 2/61 ~ 0.0328. Produced artificial 0% false positive rate.",
      status: "INVALIDATED_HISTORICAL_METRIC",
      corrective_action: "Expose flaw explicitly; report calibrated dev thresholds and document extreme false rejection of answerables."
    },
    {
      defect_id: "DEF-02",
      description: "Extreme sample-size limitation in Phase B negative queries: Only 3 dev negatives and 3 test negatives existed. Each negative represented 33.3% of the distribution.",
      status: "SAMPLE_SIZE_LIMITATION",
      corrective_action: "Classify all Phase B abstention metrics as diagnostic-only; mandate minimum Category D sample in Phase D."
    }
  ]
};
fs.writeFileSync(path.join(outDir, 'run_manifest.json'), JSON.stringify(runManifest, null, 2), 'utf8');
console.log('Wrote run_manifest.json');

// -------------------------------------------------------------
// 2. metric_definitions.json
// -------------------------------------------------------------
const metricDefinitions = {
  metrics: [
    {
      name: "Recall@K",
      formula: "Count(rank(q) <= K for q in Q_ans) / |Q_ans|",
      cutoffs: [1, 5, 10, 20, 50, 100],
      denominator: "|Q_ans| (Total answerable queries with valid target)",
      valid_range: "[0.0, 1.0]",
      interpretation: "Fraction of answerable queries where the correct modern target symbol appears in the top-K returned ranking.",
      status: "MEASURED_DIAGNOSTIC"
    },
    {
      name: "Mean Reciprocal Rank (MRR@K)",
      formula: "(1 / |Q_ans|) * sum(1 / rank(q) for q in Q_ans where 1 <= rank(q) <= K, else 0)",
      cutoffs: [10, 100],
      denominator: "|Q_ans|",
      valid_range: "[0.0, 1.0]",
      interpretation: "Harmonic mean rank of the target symbol. Heavily rewards placing target at rank 1 (1.0), rank 2 (0.5), or rank 3 (0.33).",
      status: "MEASURED_DIAGNOSTIC"
    },
    {
      name: "Precision@5",
      formula: "Count(target in top 5) * 0.20 / |Q_ans|",
      cutoffs: [5],
      denominator: "|Q_ans|",
      valid_range: "[0.0, 0.20] for single-target queries",
      interpretation: "Precision under single-target assumption where retrieving 1 target in top-5 yields 0.20.",
      status: "MEASURED_DIAGNOSTIC"
    },
    {
      name: "False Positive Rate (FPR) / False Answer Rate on Category D",
      formula: "Count(top1.score >= tau for q in Q_neg) / |Q_neg|",
      cutoffs: [1],
      denominator: "|Q_neg| (Unanswerable queries targeting deleted symbols)",
      valid_range: "[0.0, 1.0]",
      interpretation: "Fraction of unanswerable queries incorrectly answered because top candidate score exceeded abstention threshold.",
      status: "MEASURED_WITH_FLAW_DISCLOSED (Historic 0.20 threshold invalidated; calibrated dev threshold reported)"
    },
    {
      name: "No-Result Accuracy",
      formula: "1.0 - FPR",
      cutoffs: [1],
      denominator: "|Q_neg|",
      valid_range: "[0.0, 1.0]",
      interpretation: "Fraction of unanswerable queries correctly rejected/abstained.",
      status: "MEASURED_WITH_FLAW_DISCLOSED"
    },
    {
      name: "Predecessor Identification Accuracy",
      formula: "Count(predecessor_name in top1.historyProfile.historicalNames) / |Q_pred|",
      cutoffs: [1],
      denominator: "|Q_pred| (Answerable queries with verified historical predecessor)",
      valid_range: "[0.0, 1.0]",
      interpretation: "Accuracy with which top-ranked symbol explicitly retains the correct predecessor identifier in its lineage profile.",
      status: "MEASURED_DIAGNOSTIC (Phase 2 V2: 7.4% accuracy)"
    },
    {
      name: "Average Retrieval Latency",
      formula: "(1 / |Q|) * sum(query_time_ms)",
      cutoffs: null,
      denominator: "|Q|",
      valid_range: "[0.0, inf) milliseconds",
      interpretation: "Mean end-to-end latency to process query and rank candidate pool.",
      status: "MEASURED_DIAGNOSTIC (26.75ms - 174.55ms across configurations)"
    },
    {
      name: "Downstream Context Utility (LLM Pass Rate)",
      formula: "Count(LLM answer correct given retrieved context) / |Q_downstream|",
      cutoffs: null,
      denominator: "|Q_downstream|",
      valid_range: "[0.0, 1.0]",
      interpretation: "Proportion of downstream coding tasks solved by an LLM when provided top-K retrieved symbols as context.",
      status: "NOT_YET_MEASURED (Protocol approval and downstream task execution required)"
    }
  ]
};
fs.writeFileSync(path.join(outDir, 'metric_definitions.json'), JSON.stringify(metricDefinitions, null, 2), 'utf8');
console.log('Wrote metric_definitions.json');

// -------------------------------------------------------------
// 3. query_level_results.csv
// -------------------------------------------------------------
const queryLevelHeaders = [
  'query_id', 'repository', 'language', 'evolution_type', 'has_answer',
  'target_symbol_name', 'target_file_path', 'target_role',
  'config_id', 'config_name', 'rank', 'score',
  'is_hit_r1', 'is_hit_r5', 'is_hit_r10', 'reciprocal_rank',
  'top_symbol', 'top_score', 'evaluation_status'
];

const queryLevelRows = [];
const configKeys = Object.keys(phaseBResults.full);

for (const cfgKey of configKeys) {
  const cfg = phaseBResults.full[cfgKey];
  for (const qRes of cfg.queryResults) {
    const qMeta = queriesV4.find(q => q.query_id === qRes.query_id) || {};
    const rank = qRes.rank || 0;
    const isHitR1 = rank === 1 ? 1 : 0;
    const isHitR5 = rank >= 1 && rank <= 5 ? 1 : 0;
    const isHitR10 = rank >= 1 && rank <= 10 ? 1 : 0;
    const rr = rank > 0 ? parseFloat((1.0 / rank).toFixed(4)) : 0.0;

    queryLevelRows.push({
      query_id: qRes.query_id,
      repository: qRes.repository,
      language: qMeta.language || '',
      evolution_type: qRes.evolution_type,
      has_answer: qRes.has_answer ? 'TRUE' : 'FALSE',
      target_symbol_name: qRes.target_symbol || '',
      target_file_path: qMeta.target_file_path || '',
      target_role: qRes.target_role || '',
      config_id: cfgKey,
      config_name: cfg.configName,
      rank: rank,
      score: qRes.score !== undefined ? qRes.score : 0,
      is_hit_r1: isHitR1,
      is_hit_r5: isHitR5,
      is_hit_r10: isHitR10,
      reciprocal_rank: rr,
      top_symbol: qRes.topSymbol || '',
      top_score: qRes.topScore !== undefined ? qRes.topScore : 0,
      evaluation_status: 'DIAGNOSTIC_ONLY'
    });
  }
}
writeCsv('query_level_results.csv', queryLevelHeaders, queryLevelRows);

// -------------------------------------------------------------
// 4. aggregate_results.csv
// -------------------------------------------------------------
const aggHeaders = [
  'partition', 'config_id', 'config_name',
  'total_queries', 'answerable_total', 'negative_total',
  'recall_1_pct', 'recall_5_pct', 'recall_10_pct', 'mrr',
  'fpr_flawed_evaluator_pct', 'fpr_calibrated_dev_pct',
  'no_result_accuracy_pct', 'result_classification'
];

const aggRows = [];
const partitions = ['dev', 'test', 'full'];

for (const p of partitions) {
  const pData = phaseBResults[p];
  for (const cfgKey of Object.keys(pData)) {
    const c = pData[cfgKey];
    const m = c.metrics;
    
    // Check calibrated FPR from audit results if available
    let calFprPct = 'N/A';
    if (phaseBAudit.threshold_audit && phaseBAudit.threshold_audit.calibrated_evaluation) {
      const cfgAudit = phaseBAudit.threshold_audit.calibrated_evaluation.configurations[cfgKey];
      if (cfgAudit) {
        if (p === 'dev') calFprPct = cfgAudit.dev_negatives.fp_rate;
        else if (p === 'test') calFprPct = cfgAudit.held_out_negatives.fp_rate;
      }
    }

    aggRows.push({
      partition: p.toUpperCase(),
      config_id: cfgKey,
      config_name: c.configName,
      total_queries: m.totalQueries,
      answerable_total: m.answerableTotal,
      negative_total: m.negativeTotal,
      recall_1_pct: m.recall1.pct,
      recall_5_pct: m.recall5.pct,
      recall_10_pct: m.recall10.pct,
      mrr: m.mrr,
      fpr_flawed_evaluator_pct: m.falsePositiveRate.pct,
      fpr_calibrated_dev_pct: calFprPct,
      no_result_accuracy_pct: m.noResultAccuracy.pct,
      result_classification: 'DIAGNOSTIC_ONLY (Non-confirmatory)'
    });
  }
}
writeCsv('aggregate_results.csv', aggHeaders, aggRows);

// -------------------------------------------------------------
// 5. repository_results.csv
// -------------------------------------------------------------
const repoHeaders = [
  'repository', 'language', 'candidate_pool_size',
  'config_id', 'config_name',
  'answerable_queries', 'negative_queries',
  'recall_1_pct', 'recall_5_pct', 'recall_10_pct', 'mrr', 'false_positives'
];

const repoRows = [];
const repoPools = phaseBResults.metadata.candidatePoolCounts;
const repos = ['bottle', 'express', 'zod', 'gson'];
const repoLangs = { bottle: 'python', express: 'javascript', zod: 'typescript', gson: 'java' };

for (const repo of repos) {
  for (const cfgKey of configKeys) {
    const cfg = phaseBResults.full[cfgKey];
    const rData = cfg.perRepository[repo];
    if (!rData) continue;
    const ans = rData.answerable;
    const r1Pct = ans > 0 ? parseFloat(((rData.r1 / ans) * 100).toFixed(1)) : 0;
    const r5Pct = ans > 0 ? parseFloat(((rData.r5 / ans) * 100).toFixed(1)) : 0;
    const r10Pct = ans > 0 ? parseFloat(((rData.r10 / ans) * 100).toFixed(1)) : 0;
    const mrr = ans > 0 ? parseFloat((rData.mrr / ans).toFixed(4)) : 0;

    repoRows.push({
      repository: repo,
      language: repoLangs[repo],
      candidate_pool_size: repoPools[repo],
      config_id: cfgKey,
      config_name: cfg.configName,
      answerable_queries: ans,
      negative_queries: rData.neg,
      recall_1_pct: r1Pct,
      recall_5_pct: r5Pct,
      recall_10_pct: r10Pct,
      mrr: mrr,
      false_positives: rData.fp
    });
  }
}
writeCsv('repository_results.csv', repoHeaders, repoRows);

// -------------------------------------------------------------
// 6. lineage_category_results.csv
// -------------------------------------------------------------
const lineageHeaders = [
  'evolution_type', 'config_id', 'config_name',
  'answerable_queries', 'recall_1_pct', 'recall_5_pct', 'recall_10_pct', 'mrr'
];

const lineageRows = [];
const evoTypes = ['rename', 'move', 'extraction', 'rewrite', 'routine_modification'];

for (const evo of evoTypes) {
  for (const cfgKey of configKeys) {
    const cfg = phaseBResults.full[cfgKey];
    const eData = cfg.perEvolutionType[evo];
    if (!eData) continue;
    const ans = eData.answerable;
    const r1Pct = ans > 0 ? parseFloat(((eData.r1 / ans) * 100).toFixed(1)) : 0;
    const r5Pct = ans > 0 ? parseFloat(((eData.r5 / ans) * 100).toFixed(1)) : 0;
    const r10Pct = ans > 0 ? parseFloat(((eData.r10 / ans) * 100).toFixed(1)) : 0;
    const mrr = ans > 0 ? parseFloat((eData.mrr / ans).toFixed(4)) : 0;

    lineageRows.push({
      evolution_type: evo,
      config_id: cfgKey,
      config_name: cfg.configName,
      answerable_queries: ans,
      recall_1_pct: r1Pct,
      recall_5_pct: r5Pct,
      recall_10_pct: r10Pct,
      mrr: mrr
    });
  }
}
writeCsv('lineage_category_results.csv', lineageHeaders, lineageRows);

// -------------------------------------------------------------
// 7. fusion_rescue_regression.csv
// -------------------------------------------------------------
const rescueHeaders = [
  'query_id', 'repository', 'evolution_type', 'target_symbol',
  'b1_structural_rank', 'b2_historical_rank', 'b3_rrf_rank',
  'b1_r10_hit', 'b2_r10_hit', 'b3_r10_hit',
  'interaction_category', 'interaction_detail'
];

const rescueRows = [];
const b1Results = phaseBResults.full.Config_1_Structural_Only.queryResults;
const b2Results = phaseBResults.full.Config_2_Historical_Only.queryResults;
const b3Results = phaseBResults.full.Config_6_Reciprocal_Rank_Fusion.queryResults;

for (let i = 0; i < b1Results.length; i++) {
  const q1 = b1Results[i], q2 = b2Results[i], q3 = b3Results[i];
  if (!q1.has_answer) continue;

  const h1 = q1.rank >= 1 && q1.rank <= 10;
  const h2 = q2.rank >= 1 && q2.rank <= 10;
  const h3 = q3.rank >= 1 && q3.rank <= 10;

  let cat = '';
  let detail = '';

  if (!h1 && !h2 && h3) {
    cat = 'SYNERGISTIC_RESCUE';
    detail = `Both baselines failed top-10 (B1=${q1.rank}, B2=${q2.rank}); RRF fusion placed target in top-10 (${q3.rank}).`;
  } else if (!h1 && h2 && h3) {
    cat = 'HISTORICAL_RESCUE';
    detail = `B1 failed top-10 (${q1.rank}); historical signal rescued target into top-10 (${q3.rank}).`;
  } else if (h1 && !h2 && h3) {
    cat = 'STRUCTURAL_SUCCESS_RETAINED';
    detail = `B1 succeeded (${q1.rank}) while B2 failed (${q2.rank}); RRF successfully retained target in top-10 (${q3.rank}).`;
  } else if (h1 && h2 && h3) {
    cat = 'MUTUAL_SUCCESS';
    detail = `All three systems placed target in top-10 (B1=${q1.rank}, B2=${q2.rank}, B3=${q3.rank}).`;
  } else if (h1 && !h3) {
    cat = 'STRUCTURAL_REGRESSION';
    detail = `B1 placed target in top-10 (${q1.rank}), but RRF degraded target out of top-10 (${q3.rank}).`;
  } else if (h2 && !h3) {
    cat = 'HISTORICAL_REGRESSION';
    detail = `B2 placed target in top-10 (${q2.rank}), but structural absence/noise degraded target out of top-10 (${q3.rank}).`;
  } else {
    cat = 'MUTUAL_FAILURE';
    detail = `Neither baseline nor fusion retrieved target in top-10 (B1=${q1.rank}, B2=${q2.rank}, B3=${q3.rank}).`;
  }

  rescueRows.push({
    query_id: q1.query_id,
    repository: q1.repository,
    evolution_type: q1.evolution_type,
    target_symbol: q1.target_symbol,
    b1_structural_rank: q1.rank,
    b2_historical_rank: q2.rank,
    b3_rrf_rank: q3.rank,
    b1_r10_hit: h1 ? 1 : 0,
    b2_r10_hit: h2 ? 1 : 0,
    b3_r10_hit: h3 ? 1 : 0,
    interaction_category: cat,
    interaction_detail: detail
  });
}
writeCsv('fusion_rescue_regression.csv', rescueHeaders, rescueRows);

// -------------------------------------------------------------
// 8. context_utility_results.csv
// -------------------------------------------------------------
const contextHeaders = [
  'condition_id', 'condition_name', 'retrieval_input',
  'prompt_budget_tokens', 'downstream_task', 'evaluator_type',
  'sample_size', 'task_success_rate_pct', 'code_pass_rate_pct',
  'hallucination_rate_pct', 'latency_ms', 'measurement_status', 'notes'
];

const contextRows = [
  {
    condition_id: 'Cond_A',
    condition_name: 'Zero-Context Baseline',
    retrieval_input: 'None (LLM parametric memory only)',
    prompt_budget_tokens: '0',
    downstream_task: 'Repository symbol identification & code update',
    evaluator_type: 'Unit test suite + rubric',
    sample_size: 0,
    task_success_rate_pct: 'N/A',
    code_pass_rate_pct: 'N/A',
    hallucination_rate_pct: 'N/A',
    latency_ms: 'N/A',
    measurement_status: 'NOT_YET_MEASURED',
    notes: 'Blocked pending protocol approval and human review sign-off.'
  },
  {
    condition_id: 'Cond_B',
    condition_name: 'Structural Context Only (B1)',
    retrieval_input: 'Top-5 symbols from StructuralRetriever',
    prompt_budget_tokens: '2000-4000',
    downstream_task: 'Repository symbol identification & code update',
    evaluator_type: 'Unit test suite + rubric',
    sample_size: 0,
    task_success_rate_pct: 'N/A',
    code_pass_rate_pct: 'N/A',
    hallucination_rate_pct: 'N/A',
    latency_ms: 'N/A',
    measurement_status: 'NOT_YET_MEASURED',
    notes: 'Blocked pending protocol approval.'
  },
  {
    condition_id: 'Cond_C',
    condition_name: 'Historical Context Only (B2)',
    retrieval_input: 'Top-5 symbols from HistoricalRetrievalAdapter',
    prompt_budget_tokens: '2000-4000',
    downstream_task: 'Repository symbol identification & code update',
    evaluator_type: 'Unit test suite + rubric',
    sample_size: 0,
    task_success_rate_pct: 'N/A',
    code_pass_rate_pct: 'N/A',
    hallucination_rate_pct: 'N/A',
    latency_ms: 'N/A',
    measurement_status: 'NOT_YET_MEASURED',
    notes: 'Blocked pending protocol approval.'
  },
  {
    condition_id: 'Cond_D',
    condition_name: 'Fused Context (S1 / B3)',
    retrieval_input: 'Top-5 symbols from RRF fusion',
    prompt_budget_tokens: '2000-4000',
    downstream_task: 'Repository symbol identification & code update',
    evaluator_type: 'Unit test suite + rubric',
    sample_size: 0,
    task_success_rate_pct: 'N/A',
    code_pass_rate_pct: 'N/A',
    hallucination_rate_pct: 'N/A',
    latency_ms: 'N/A',
    measurement_status: 'NOT_YET_MEASURED',
    notes: 'Blocked pending protocol approval.'
  },
  {
    condition_id: 'Cond_E',
    condition_name: 'Gold Context Upper Bound',
    retrieval_input: 'Ground-truth verified modern symbol and predecessor',
    prompt_budget_tokens: '2000-4000',
    downstream_task: 'Repository symbol identification & code update',
    evaluator_type: 'Unit test suite + rubric',
    sample_size: 0,
    task_success_rate_pct: 'N/A',
    code_pass_rate_pct: 'N/A',
    hallucination_rate_pct: 'N/A',
    latency_ms: 'N/A',
    measurement_status: 'NOT_YET_MEASURED',
    notes: 'Upper bound reference condition; blocked pending protocol approval.'
  }
];
writeCsv('context_utility_results.csv', contextHeaders, contextRows);

// -------------------------------------------------------------
// 9. latency_results.csv
// -------------------------------------------------------------
const latencyHeaders = [
  'measurement_phase', 'operation_type', 'target_entity',
  'candidate_count_or_depth', 'duration_ms', 'measurement_unit', 'notes'
];

const latencyRows = [
  {
    measurement_phase: 'Phase B Indexing',
    operation_type: 'Full Structural AST Indexing',
    target_entity: 'bottle (Python)',
    candidate_count_or_depth: '1044 symbols',
    duration_ms: '412',
    measurement_unit: 'total ms',
    notes: 'AST symbol extraction and topology building'
  },
  {
    measurement_phase: 'Phase B Indexing',
    operation_type: 'Full Structural AST Indexing',
    target_entity: 'express (JavaScript)',
    candidate_count_or_depth: '3101 symbols',
    duration_ms: '1285',
    measurement_unit: 'total ms',
    notes: 'AST symbol extraction'
  },
  {
    measurement_phase: 'Phase B Indexing',
    operation_type: 'Full Structural AST Indexing',
    target_entity: 'zod (TypeScript)',
    candidate_count_or_depth: '3531 symbols',
    duration_ms: '2410',
    measurement_unit: 'total ms',
    notes: 'AST symbol extraction'
  },
  {
    measurement_phase: 'Phase B Indexing',
    operation_type: 'Full Structural AST Indexing',
    target_entity: 'gson (Java)',
    candidate_count_or_depth: '4239 symbols',
    duration_ms: '3150',
    measurement_unit: 'total ms',
    notes: 'AST symbol extraction'
  },
  {
    measurement_phase: 'Phase 2 Retrieval',
    operation_type: 'Per-Query Retrieval',
    target_entity: 'Config A (Lexical-Only)',
    candidate_count_or_depth: '11915 pool',
    duration_ms: '26.75',
    measurement_unit: 'avg ms/query',
    notes: '40 queries evaluated (Sanitized V2)'
  },
  {
    measurement_phase: 'Phase 2 Retrieval',
    operation_type: 'Per-Query Retrieval',
    target_entity: 'Config B (Structural-Only B1)',
    candidate_count_or_depth: '11915 pool',
    duration_ms: '132.15',
    measurement_unit: 'avg ms/query',
    notes: '40 queries evaluated (Sanitized V2)'
  },
  {
    measurement_phase: 'Phase 2 Retrieval',
    operation_type: 'Per-Query Retrieval',
    target_entity: 'Config C (Historical-Only B2)',
    candidate_count_or_depth: '11915 pool',
    duration_ms: '27.95',
    measurement_unit: 'avg ms/query',
    notes: '40 queries evaluated (Sanitized V2)'
  },
  {
    measurement_phase: 'Phase 2 Retrieval',
    operation_type: 'Per-Query Retrieval',
    target_entity: 'Config D (Linear Fusion 0.6S/0.4H)',
    candidate_count_or_depth: '11915 pool',
    duration_ms: '139.47',
    measurement_unit: 'avg ms/query',
    notes: '40 queries evaluated (Sanitized V2)'
  },
  {
    measurement_phase: 'Phase 2 Retrieval',
    operation_type: 'Per-Query Retrieval',
    target_entity: 'Config E (Transitive Lineage Stitching)',
    candidate_count_or_depth: '11915 pool',
    duration_ms: '174.55',
    measurement_unit: 'avg ms/query',
    notes: 'Chains through multi-hop renames and moves'
  }
];
writeCsv('latency_results.csv', latencyHeaders, latencyRows);

// -------------------------------------------------------------
// 10. exclusions_and_failures.csv
// -------------------------------------------------------------
const exclHeaders = [
  'exclusion_id', 'affected_phase_or_repo', 'affected_entity',
  'reason_for_exclusion_or_failure', 'technical_defect_description',
  'remediation_or_quarantine_action'
];

const exclRows = [
  {
    exclusion_id: 'EXCL-01',
    affected_phase_or_repo: 'Phase B Evaluation',
    affected_entity: '6 Negative Queries (Category D)',
    reason_for_exclusion_or_failure: 'Evaluator threshold condition scale mismatch',
    technical_defect_description: 'Evaluator used top1.score >= 0.20, mathematically unreachable for RRF max 0.0328. Masked false positives as 0%.',
    remediation_or_quarantine_action: 'Invalidated metric; recomputed calibrated thresholds showing severe false rejections on held-out test set.'
  },
  {
    exclusion_id: 'EXCL-02',
    affected_phase_or_repo: 'Phase C / Phase D',
    affected_entity: 'Express Repository & 40 Queries',
    reason_for_exclusion_or_failure: 'Pre-study leakage & shared authoring contamination',
    technical_defect_description: 'Express queries and files were used in initial prototype tuning, creating severe benchmark leakage risks.',
    remediation_or_quarantine_action: 'Strictly blacklisted from Phase D benchmark under DEC-12.'
  },
  {
    exclusion_id: 'EXCL-03',
    affected_phase_or_repo: 'Phase B Evaluation',
    affected_entity: 'Query q_ts_zod_09 (creditCard vs iban)',
    reason_for_exclusion_or_failure: 'Sibling symbol target ambiguity in TypeScript AST',
    technical_defect_description: 'Initial benchmark evaluator checked symbol name without qualified scope; collided with sibling schema method.',
    remediation_or_quarantine_action: 'Remediated in audited benchmark v3 and regression-tested in evaluation_integrity.test.js.'
  },
  {
    exclusion_id: 'EXCL-04',
    affected_phase_or_repo: 'Phase D Benchmark',
    affected_entity: 'Java and Advanced TypeScript grammars',
    reason_for_exclusion_or_failure: 'Complex AST grammar ambiguities and unverified SymbolID round-trips',
    technical_defect_description: 'TypeScript union/conditional types and Java raw types/generics have not undergone full formal AST collision audits.',
    remediation_or_quarantine_action: 'Strictly blocked under DEC-19; Phase D scope narrowed strictly to JavaScript and Python.'
  },
  {
    exclusion_id: 'EXCL-05',
    affected_phase_or_repo: 'Phase D Benchmark',
    affected_entity: 'Entire Confirmatory Benchmark Execution',
    reason_for_exclusion_or_failure: 'Operational gate blocked pending formal supervisor sign-off',
    technical_defect_description: '12 material decisions in Decision Register (DEC-03 through DEC-22) remain PENDING APPROVAL.',
    remediation_or_quarantine_action: 'Confirmatory data collection, query authoring, and evaluation strictly halted until written supervisor approval.'
  }
];
writeCsv('exclusions_and_failures.csv', exclHeaders, exclRows);

console.log('Successfully generated all 10 machine-readable evaluation artifacts.');
