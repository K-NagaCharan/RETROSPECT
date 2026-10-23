const fs = require('fs');
const path = require('path');
const RetrospectEvaluator = require('../src/evaluation/RetrospectEvaluator');

async function testSmoke() {
  console.log('Running Evaluator Smoke Test...');
  
  const testCases = [
    {
      case_id: 'SMOKE-CHECKSTYLE-01',
      repo: 'checkstyle/checkstyle',
      pin_sha: '10a3a0777ced10983ebe6266c998957c10dba8f0',
      query: 'Locate current implementation corresponding to historical method getMessages in AbstractCheck',
      target: {
        symbol_name: 'getViolations',
        file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/AbstractCheck.java',
        line_span: [113, 115]
      },
      decoys: [
        { symbol_name: 'getLines', file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/AbstractCheck.java' }
      ],
      language: 'Java',
      category: 'historical_evolution',
      origin_commit: '24ead56cf961060af6e08399e999440ef6945f84',
      commit_distance_origin_to_pin: 36,
      split: 'dev'
    },
    {
      case_id: 'SMOKE-UNDERTOW-01',
      repo: 'undertow-io/undertow',
      pin_sha: 'cf3abec9145bb4660659add41b97866ff6ef9c31',
      query: 'Locate current implementation corresponding to historical method send in WebSocket07FrameSinkChannel',
      target: {
        symbol_name: 'sendInternal',
        file_path: 'core/src/main/java/io/undertow/websockets/core/protocol/version07/WebSocket07FrameSinkChannel.java',
        line_span: [100, 120]
      },
      decoys: [
        { symbol_name: 'send', file_path: 'core/src/main/java/io/undertow/websockets/core/StreamSourceFrameChannel.java' }
      ],
      language: 'Java',
      category: 'historical_evolution',
      origin_commit: 'cea721e474e649b18b90f45ddf0bcea81b9256aa',
      commit_distance_origin_to_pin: 40,
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
  console.log('Smoke Test Completed.');
  console.log('Valid cases evaluated:', res.per_case_results.length);
  res.per_case_results.forEach(r => {
    console.log(`Case: ${r.case_id} (${r.repo})`);
    console.log(`  Stage A: ${r.stage_a_reachability.reachability_status} (dist=${r.stage_a_reachability.commit_distance})`);
    console.log(`  Stage B: ${r.stage_b_detection.match_type} (detected=${r.stage_b_detection.detected})`);
    console.log(`  B1 (Structural): Rank ${r.stage_c_ranking.b1_structural.rank} (Score: ${r.stage_c_ranking.b1_structural.score})`);
    console.log(`  B2 (Historical): Rank ${r.stage_c_ranking.b2_historical.rank} (Score: ${r.stage_c_ranking.b2_historical.score})`);
    console.log(`  B3 (Linear):     Rank ${r.stage_c_ranking.b3_linear.rank} (Score: ${r.stage_c_ranking.b3_linear.score})`);
    console.log(`  B4 (RRF):        Rank ${r.stage_c_ranking.b4_rrf.rank} (Score: ${r.stage_c_ranking.b4_rrf.score})`);
  });
}

testSmoke().catch(console.error);
