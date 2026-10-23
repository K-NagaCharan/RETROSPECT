const fs = require('fs');
const { execFileSync } = require('child_process');

const baselineQPSource = execFileSync('git', ['show', 'HEAD:src/structural/query/QueryProcessor.js']).toString('utf8');
const baselineModule = { exports: {} };
const baselineFn = new Function('module', 'exports', baselineQPSource);
baselineFn(baselineModule, baselineModule.exports);
const qpBase = baselineModule.exports;

const qpMod = require('../src/structural/query/QueryProcessor');
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');

const diagnosticCases = [
  { id: 'DIAG-01', folder: 'checkstyle', pin: '10a3a0777ced10983ebe6266c998957c10dba8f0', query: 'Retrieve the collection of logged style violations and inspection messages' },
  { id: 'DIAG-02', folder: 'graphhopper', pin: 'c7497d1100a4f05ddf5cc630692cbe8046b98114', query: 'Mark disconnected network vertices as removed during road network subnetwork preparation' },
  { id: 'DIAG-03', folder: 'checkstyle', pin: '10a3a0777ced10983ebe6266c998957c10dba8f0', query: 'Construct AST block comment node structure from string content or token' },
  { id: 'DIAG-04', folder: 'guava', pin: 'db74bd2fdac443223d45e6fc5c66548542be1081', query: 'Check that integer index is non-negative and throw appropriate exception' },
  { id: 'DIAG-05', folder: 'guava', pin: 'db74bd2fdac443223d45e6fc5c66548542be1081', query: 'Construct an immutable list builder with preallocated capacity' },
  { id: 'DIAG-06', folder: 'requests', pin: '147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4', query: 'Send an HTTP request using an underlying urllib3 connection pool manager with retry logic and SSL verification' },
  { id: 'DIAG-07', folder: 'undertow', pin: 'cf3abec9145bb4660659add41b97866ff6ef9c31', query: 'Process and dispatch websocket binary and text frames internally across stream sink channel' },
  { id: 'DIAG-08', folder: 'checkstyle', pin: '10a3a0777ced10983ebe6266c998957c10dba8f0', query: 'Get the line coordinate number for logged violation warning' }
];

async function measure() {
  const origModSplit = qpMod.splitIdentifiers;
  const origModProcess = qpMod.process;

  console.log('| Case ID | Repository | Baseline Scored Candidates (score >= 0.08) | Modified Scored Candidates (score >= 0.08) | Candidate Difference |');
  console.log('|---|---|---|---|---|');

  for (const c of diagnosticCases) {
    const repoPath = 'D:/clones/' + c.folder;
    execFileSync('git', ['checkout', '--detach', c.pin], { cwd: repoPath, stdio: 'pipe' });
    const idx = await indexRepository(repoPath, { forceRebuild: false });
    const syms = Array.from(idx.symbols.values());
    const ret = new StructuralRetriever(idx);

    // Baseline run
    qpMod.splitIdentifiers = qpBase.splitIdentifiers;
    qpMod.process = qpBase.process;
    const bQ = qpBase.process(c.query);
    const bCands = ret.rankCandidates(bQ, syms);

    // Modified run
    qpMod.splitIdentifiers = origModSplit;
    qpMod.process = origModProcess;
    const mQ = qpMod.process(c.query);
    const mCands = ret.rankCandidates(mQ, syms);

    const diff = mCands.length - bCands.length;
    console.log(`| ${c.id} | ${c.folder} | ${bCands.length} | ${mCands.length} | ${diff >= 0 ? '+' : ''}${diff} |`);
  }
}

measure().catch(console.error);
