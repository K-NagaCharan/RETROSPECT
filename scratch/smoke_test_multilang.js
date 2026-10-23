const fs = require('fs');
const path = require('path');
const RetrospectEvaluator = require('../src/evaluation/RetrospectEvaluator');

async function testMultilangSmoke() {
  console.log('Running Multi-Language Evaluator Smoke Test...');
  
  const testCases = [
    {
      case_id: 'SMOKE-PY-01',
      repo: 'psf/requests',
      pin_sha: '147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4',
      query: 'Send an HTTP request using an underlying urllib3 connection pool manager with retry logic and SSL verification',
      target: {
        symbol_name: 'HTTPAdapter.send',
        file_path: 'requests/adapters.py',
        line_span: [434, 538]
      },
      decoys: [
        { symbol_name: 'build_response', file_path: 'requests/adapters.py' }
      ],
      language: 'Python',
      category: 'structural_pilot',
      origin_commit: null,
      commit_distance_origin_to_pin: null,
      split: 'dev'
    },
    {
      case_id: 'SMOKE-TS-01',
      repo: 'colinhacks/zod',
      pin_sha: 'e7a9b9b3033991be6b4225f1be21da39c250bbb0',
      query: 'Parse an unknown input against a schema and return a discriminated result object with success boolean without throwing exceptions',
      target: {
        symbol_name: 'ZodType.safeParse',
        file_path: 'src/types.ts',
        line_span: [225, 233]
      },
      decoys: [
        { symbol_name: 'parse', file_path: 'src/types.ts' }
      ],
      language: 'TypeScript',
      category: 'structural_pilot',
      origin_commit: null,
      commit_distance_origin_to_pin: null,
      split: 'dev'
    },
    {
      case_id: 'SMOKE-JS-01',
      repo: 'mochajs/mocha',
      pin_sha: 'd5766c887e72b1bb55d5efeac33b1cadd0544b84',
      query: 'Locate and collect test files across directories matching pattern specifications and file extensions',
      target: {
        symbol_name: 'lookupFiles',
        file_path: 'lib/utils.js',
        line_span: [450, 520]
      },
      decoys: [
        { symbol_name: 'files', file_path: 'lib/utils.js' }
      ],
      language: 'JavaScript',
      category: 'historical_pilot',
      origin_commit: '1b5cbf13e61a682ff977cbcf8b1bd0350dc1e29e',
      commit_distance_origin_to_pin: 201,
      split: 'dev'
    }
  ];

  const evaluator = new RetrospectEvaluator({
    clonesDir: 'D:/clones',
    searchHorizon: 50,
    verifyGitTree: true,
    bootstrapReplicates: 50
  });

  const res = await evaluator.evaluate(testCases);
  console.log('Multi-Language Smoke Test Completed.');
  console.log('Valid cases evaluated:', res.per_case_results.length);
  res.per_case_results.forEach(r => {
    console.log(`Case: ${r.case_id} (${r.language} | ${r.repo})`);
    console.log(`  B1 (Structural): Rank ${r.stage_c_ranking.b1_structural.rank} (Score: ${r.stage_c_ranking.b1_structural.score})`);
    console.log(`  B2 (Historical): Rank ${r.stage_c_ranking.b2_historical.rank} (Score: ${r.stage_c_ranking.b2_historical.score})`);
    console.log(`  B4 (RRF):        Rank ${r.stage_c_ranking.b4_rrf.rank} (Score: ${r.stage_c_ranking.b4_rrf.score})`);
  });
}

testMultilangSmoke().catch(console.error);
