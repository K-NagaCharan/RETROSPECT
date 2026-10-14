const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { defaultRegistry } = require('../src/languages/LanguageAdapterRegistry');

function runGit(repoPath, args) {
  return execFileSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    windowsHide: true
  });
}

function computeJaccard(tokensA, tokensB) {
  if (!tokensA || !tokensB || tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isTestFilePath(filePath) {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  return norm.startsWith('test/') || norm.startsWith('examples/') || norm.startsWith('benchmarks/');
}

async function runExpressDeepenedDiscovery() {
  console.log('========================================================================');
  console.log('Retrospect Phase C: Express Deepened Callable-Level AST Discovery');
  console.log('========================================================================\n');

  const repoPath = path.resolve(__dirname, '../data/external_repos/express');
  const headCommit = runGit(repoPath, ['rev-parse', 'HEAD']).trim();
  const totalCommitsReachable = parseInt(runGit(repoPath, ['rev-list', '--count', 'HEAD']).trim(), 10);
  
  // Inspect up to 500 first-parent commits from HEAD
  const commitWindowLimit = 500;
  const logOutput = runGit(repoPath, [
    'log',
    `-n`, `${commitWindowLimit}`,
    '--format=%H%x09%P%x09%ad%x09%s',
    '--date=short'
  ]).trim().split('\n').filter(Boolean);

  console.log(`Repository: express`);
  console.log(`Pinned HEAD: ${headCommit}`);
  console.log(`Total Reachable Commits: ${totalCommitsReachable}`);
  console.log(`Discovery Window Commits: ${logOutput.length}\n`);

  const stats = {
    repository: 'express',
    language: 'javascript',
    pinned_head_commit: headCommit,
    total_reachable_commits: totalCommitsReachable,
    scanned_commits: logOutput.length,
    date_range: {
      newest_date: logOutput[0]?.split('\t')[2],
      oldest_date: logOutput[logOutput.length - 1]?.split('\t')[2]
    },
    merge_commits_handled: 0,
    files_diffed: 0,
    files_parsed_successfully: 0,
    parser_syntax_errors: 0,
    unsupported_or_skipped_files: 0,
    raw_events_by_type: {
      callable_addition: 0,
      callable_deletion: 0,
      signature_change: 0,
      substantial_rewrite: 0,
      routine_modification: 0,
      candidate_rename_heuristic: 0,
      candidate_move_heuristic: 0
    },
    production_events_by_type: {
      callable_addition: 0,
      callable_deletion: 0,
      signature_change: 0,
      substantial_rewrite: 0,
      routine_modification: 0,
      candidate_rename_heuristic: 0,
      candidate_move_heuristic: 0
    },
    test_events_total: 0,
    lineage_clustering: {
      total_unique_production_symbols_mutated: 0,
      unique_production_commits_with_events: 0,
      multi_mutation_symbols_count: 0,
      single_mutation_symbols_count: 0
    },
    ambiguous_lineage_candidates: [],
    comparison_with_shallow_150_window: {
      shallow_commits_scanned: 150,
      shallow_production_events: 19,
      shallow_unique_symbols: 13,
      shallow_unique_commits: 17,
      deepened_commits_scanned: logOutput.length,
      deepened_production_events: 0,
      deepened_unique_symbols: 0,
      deepened_unique_commits: 0,
      events_growth_factor: 0,
      symbols_growth_factor: 0,
      commits_growth_factor: 0
    },
    feasibility_assessment: {}
  };

  const allEvents = [];
  const productionLineageClusters = new Map();
  const productionCommitsWithEvents = new Set();
  let eventCounter = 1;

  for (const logLine of logOutput) {
    const [sha, parentsStr, commitDate, subject] = logLine.split('\t');
    const parents = (parentsStr || '').split(' ').filter(Boolean);
    if (parents.length === 0) continue;

    const isMerge = parents.length > 1;
    if (isMerge) stats.merge_commits_handled++;

    const parentSha = parents[0];

    let nameStatusOutput;
    try {
      nameStatusOutput = runGit(repoPath, ['diff', '--name-status', '-M', parentSha, sha]).split('\n').filter(Boolean);
    } catch (err) {
      continue;
    }

    for (const ns of nameStatusOutput) {
      const parts = ns.split('\t');
      const statusCode = parts[0][0];
      const oldFile = parts[1];
      const newFile = parts[2] || parts[1];

      const exts = ['.js', '.mjs', '.cjs'];
      const relevantExt = exts.some(ext => newFile.endsWith(ext) || oldFile.endsWith(ext));
      if (!relevantExt) {
        stats.unsupported_or_skipped_files++;
        continue;
      }

      stats.files_diffed++;
      const isTest = isTestFilePath(newFile) || isTestFilePath(oldFile);

      let parentSource = null;
      let childSource = null;

      if (statusCode !== 'A') {
        try {
          parentSource = runGit(repoPath, ['show', `${parentSha}:${oldFile}`]);
        } catch (e) {
          parentSource = null;
        }
      }

      if (statusCode !== 'D') {
        try {
          childSource = runGit(repoPath, ['show', `${sha}:${newFile}`]);
        } catch (e) {
          childSource = null;
        }
      }

      let parentSymbols = [];
      if (parentSource !== null) {
        const adapter = defaultRegistry.getAdapterForFile(oldFile);
        if (adapter) {
          try {
            const tree = await adapter.parse(parentSource);
            if (tree.rootNode.hasError()) stats.parser_syntax_errors++;
            parentSymbols = adapter.extractSymbols(parentSource, tree, oldFile);
            stats.files_parsed_successfully++;
          } catch (err) {
            stats.parser_syntax_errors++;
          }
        }
      }

      let childSymbols = [];
      if (childSource !== null) {
        const adapter = defaultRegistry.getAdapterForFile(newFile);
        if (adapter) {
          try {
            const tree = await adapter.parse(childSource);
            if (tree.rootNode.hasError()) stats.parser_syntax_errors++;
            childSymbols = adapter.extractSymbols(childSource, tree, newFile);
            stats.files_parsed_successfully++;
          } catch (err) {
            stats.parser_syntax_errors++;
          }
        }
      }

      const parentByQName = new Map();
      for (const s of parentSymbols) parentByQName.set(s.qualifiedName, s);

      const childByQName = new Map();
      for (const s of childSymbols) childByQName.set(s.qualifiedName, s);

      const matchedQNames = new Set();
      const unmatchedParent = [];
      const unmatchedChild = [];

      for (const [qname, childSym] of childByQName.entries()) {
        if (parentByQName.has(qname)) {
          matchedQNames.add(qname);
          const parentSym = parentByQName.get(qname);

          if (parentSym.sourceHash === childSym.sourceHash) continue;

          const jaccard = computeJaccard(parentSym.normalizedTokens, childSym.normalizedTokens);
          const clusterKey = `express::${newFile}::${qname}`;
          const eventId = `evt_express_deep_${String(eventCounter++).padStart(5, '0')}`;

          let eventType = 'routine_modification';
          if (parentSym.normalizedSignature !== childSym.normalizedSignature) {
            eventType = 'signature_change';
          } else if (jaccard < 0.50) {
            eventType = 'substantial_rewrite';
          }

          const event = {
            event_id: eventId,
            repository: 'express',
            commit_sha: sha,
            parent_sha: parentSha,
            commit_date: commitDate,
            commit_subject: subject,
            event_type: eventType,
            is_verified_lineage: true,
            evidence_type: eventType === 'signature_change' ? 'stable_qualified_name_match' : 'stable_qualified_name_and_signature_match',
            is_test_file: isTest,
            file_path: newFile,
            parent_file_path: oldFile,
            symbol_name: childSym.name,
            qualified_name: qname,
            symbol_type: childSym.symbolType,
            parent_signature: parentSym.normalizedSignature,
            child_signature: childSym.normalizedSignature,
            parent_source_hash: parentSym.sourceHash,
            child_source_hash: childSym.sourceHash,
            body_jaccard_similarity: parseFloat(jaccard.toFixed(3)),
            lineage_cluster_key: clusterKey
          };

          allEvents.push(event);
          stats.raw_events_by_type[eventType]++;
          if (isTest) {
            stats.test_events_total++;
          } else {
            stats.production_events_by_type[eventType]++;
            productionCommitsWithEvents.add(sha);
            if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
            productionLineageClusters.get(clusterKey).push(eventId);
          }
        } else {
          unmatchedChild.push(childSym);
        }
      }

      for (const [qname, parentSym] of parentByQName.entries()) {
        if (!matchedQNames.has(qname)) unmatchedParent.push(parentSym);
      }

      // Candidate renames & moves
      const matchedHeuristicP = new Set();
      const matchedHeuristicC = new Set();

      for (const pSym of unmatchedParent) {
        for (const cSym of unmatchedChild) {
          if (matchedHeuristicC.has(cSym.qualifiedName)) continue;
          const jaccard = computeJaccard(pSym.normalizedTokens, cSym.normalizedTokens);
          const tokenLen = Math.min((pSym.normalizedTokens || []).length, (cSym.normalizedTokens || []).length);

          if (jaccard >= 0.70 && tokenLen >= 5) {
            matchedHeuristicP.add(pSym.qualifiedName);
            matchedHeuristicC.add(cSym.qualifiedName);

            const isMove = oldFile !== newFile;
            const eventType = isMove ? 'candidate_move_heuristic' : 'candidate_rename_heuristic';
            const clusterKey = `express::${newFile}::${cSym.qualifiedName}`;
            const eventId = `evt_express_deep_${String(eventCounter++).padStart(5, '0')}`;

            const event = {
              event_id: eventId,
              repository: 'express',
              commit_sha: sha,
              parent_sha: parentSha,
              commit_date: commitDate,
              commit_subject: subject,
              event_type: eventType,
              is_verified_lineage: false,
              confidence: 'screening_only_unverified',
              evidence_type: isMove ? 'heuristic_cross_file_body_similarity' : 'heuristic_body_token_similarity',
              is_test_file: isTest,
              file_path: newFile,
              parent_file_path: oldFile,
              symbol_name: cSym.name,
              parent_symbol_name: pSym.name,
              qualified_name: cSym.qualifiedName,
              parent_qualified_name: pSym.qualifiedName,
              symbol_type: cSym.symbolType,
              parent_signature: pSym.normalizedSignature,
              child_signature: cSym.normalizedSignature,
              parent_source_hash: pSym.sourceHash,
              child_source_hash: cSym.sourceHash,
              body_jaccard_similarity: parseFloat(jaccard.toFixed(3)),
              lineage_cluster_key: clusterKey
            };

            allEvents.push(event);
            stats.raw_events_by_type[eventType]++;
            if (isTest) {
              stats.test_events_total++;
            } else {
              stats.production_events_by_type[eventType]++;
              productionCommitsWithEvents.add(sha);
              if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
              productionLineageClusters.get(clusterKey).push(eventId);
              stats.ambiguous_lineage_candidates.push({
                commit: sha.slice(0, 8),
                parent_symbol: pSym.qualifiedName,
                child_symbol: cSym.qualifiedName,
                similarity: parseFloat(jaccard.toFixed(3)),
                type: eventType
              });
            }
            break;
          }
        }
      }

      // Additions
      for (const cSym of unmatchedChild) {
        if (!matchedHeuristicC.has(cSym.qualifiedName)) {
          const eventId = `evt_express_deep_${String(eventCounter++).padStart(5, '0')}`;
          const clusterKey = `express::${newFile}::${cSym.qualifiedName}`;
          const event = {
            event_id: eventId,
            repository: 'express',
            commit_sha: sha,
            parent_sha: parentSha,
            commit_date: commitDate,
            commit_subject: subject,
            event_type: 'callable_addition',
            is_verified_lineage: true,
            evidence_type: 'new_callable_declaration',
            is_test_file: isTest,
            file_path: newFile,
            parent_file_path: oldFile,
            symbol_name: cSym.name,
            qualified_name: cSym.qualifiedName,
            symbol_type: cSym.symbolType,
            parent_signature: null,
            child_signature: cSym.normalizedSignature,
            parent_source_hash: null,
            child_source_hash: cSym.sourceHash,
            body_jaccard_similarity: 0,
            lineage_cluster_key: clusterKey
          };
          allEvents.push(event);
          stats.raw_events_by_type.callable_addition++;
          if (isTest) {
            stats.test_events_total++;
          } else {
            stats.production_events_by_type.callable_addition++;
            productionCommitsWithEvents.add(sha);
            if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
            productionLineageClusters.get(clusterKey).push(eventId);
          }
        }
      }

      // Deletions
      for (const pSym of unmatchedParent) {
        if (!matchedHeuristicP.has(pSym.qualifiedName)) {
          const eventId = `evt_express_deep_${String(eventCounter++).padStart(5, '0')}`;
          const clusterKey = `express::${oldFile}::${pSym.qualifiedName}`;
          const event = {
            event_id: eventId,
            repository: 'express',
            commit_sha: sha,
            parent_sha: parentSha,
            commit_date: commitDate,
            commit_subject: subject,
            event_type: 'callable_deletion',
            is_verified_lineage: true,
            evidence_type: 'removed_callable_declaration',
            is_test_file: isTest,
            file_path: newFile,
            parent_file_path: oldFile,
            symbol_name: pSym.name,
            qualified_name: pSym.qualifiedName,
            symbol_type: pSym.symbolType,
            parent_signature: pSym.normalizedSignature,
            child_signature: null,
            parent_source_hash: pSym.sourceHash,
            child_source_hash: null,
            body_jaccard_similarity: 0,
            lineage_cluster_key: clusterKey
          };
          allEvents.push(event);
          stats.raw_events_by_type.callable_deletion++;
          if (isTest) {
            stats.test_events_total++;
          } else {
            stats.production_events_by_type.callable_deletion++;
            productionCommitsWithEvents.add(sha);
            if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
            productionLineageClusters.get(clusterKey).push(eventId);
          }
        }
      }
    }
  }

  // Clustering metrics
  stats.lineage_clustering.total_unique_production_symbols_mutated = productionLineageClusters.size;
  stats.lineage_clustering.unique_production_commits_with_events = productionCommitsWithEvents.size;
  let multiCount = 0;
  for (const [key, evts] of productionLineageClusters.entries()) {
    if (evts.length > 1) multiCount++;
  }
  stats.lineage_clustering.multi_mutation_symbols_count = multiCount;
  stats.lineage_clustering.single_mutation_symbols_count = productionLineageClusters.size - multiCount;

  const prodEventsTotal = Object.values(stats.production_events_by_type).reduce((a, b) => a + b, 0);

  // Growth comparison
  stats.comparison_with_shallow_150_window.deepened_production_events = prodEventsTotal;
  stats.comparison_with_shallow_150_window.deepened_unique_symbols = stats.lineage_clustering.total_unique_production_symbols_mutated;
  stats.comparison_with_shallow_150_window.deepened_unique_commits = stats.lineage_clustering.unique_production_commits_with_events;
  stats.comparison_with_shallow_150_window.events_growth_factor = parseFloat((prodEventsTotal / 19).toFixed(2));
  stats.comparison_with_shallow_150_window.symbols_growth_factor = parseFloat((stats.lineage_clustering.total_unique_production_symbols_mutated / 13).toFixed(2));
  stats.comparison_with_shallow_150_window.commits_growth_factor = parseFloat((stats.lineage_clustering.unique_production_commits_with_events / 17).toFixed(2));

  const targetQueries = 40;
  const isPlausible = stats.lineage_clustering.unique_production_commits_with_events >= 40 &&
                      stats.lineage_clustering.total_unique_production_symbols_mutated >= 40;

  stats.feasibility_assessment = {
    target_answerable_queries: targetQueries,
    total_production_events: prodEventsTotal,
    unique_production_symbols: stats.lineage_clustering.total_unique_production_symbols_mutated,
    unique_production_commits: stats.lineage_clustering.unique_production_commits_with_events,
    plausibly_supports_target_sample: isPlausible,
    assessment_notes: isPlausible
      ? `Deepening successful: Express history now contains ${stats.lineage_clustering.unique_production_commits_with_events} distinct production commits and ${stats.lineage_clustering.total_unique_production_symbols_mutated} unique mutated symbols across ${logOutput.length} commits (${stats.date_range.oldest_date} to ${stats.date_range.newest_date}). Plausibly supports a 40-query target under careful cluster partitioning.`
      : `Deepening assessment: Expanded from 17 to ${stats.lineage_clustering.unique_production_commits_with_events} production commits. Still requires review regarding split independence.`
  };

  console.log(`\n========================================================================`);
  console.log(`Express Deepened Discovery Complete:`);
  console.log(`  Window Commits Scanned: ${logOutput.length} (${stats.date_range.oldest_date} to ${stats.date_range.newest_date})`);
  console.log(`  Total Raw Events: ${allEvents.length} (Prod: ${prodEventsTotal}, Test: ${stats.test_events_total})`);
  console.log(`  Prod Events Breakdown:`);
  console.log(`    Additions: ${stats.production_events_by_type.callable_addition}`);
  console.log(`    Deletions: ${stats.production_events_by_type.callable_deletion}`);
  console.log(`    Signature Changes: ${stats.production_events_by_type.signature_change}`);
  console.log(`    Substantial Rewrites: ${stats.production_events_by_type.substantial_rewrite}`);
  console.log(`    Routine Modifications: ${stats.production_events_by_type.routine_modification}`);
  console.log(`    Candidate Renames (Heuristic): ${stats.production_events_by_type.candidate_rename_heuristic}`);
  console.log(`  Clustering & Independence:`);
  console.log(`    Unique Production Mutated Symbols: ${stats.lineage_clustering.total_unique_production_symbols_mutated} (vs 13 in shallow)`);
  console.log(`    Unique Production Commits with Events: ${stats.lineage_clustering.unique_production_commits_with_events} (vs 17 in shallow)`);
  console.log(`    Multi-Mutated Symbols: ${stats.lineage_clustering.multi_mutation_symbols_count}`);
  console.log(`  Growth Factors vs Shallow (150 commits):`);
  console.log(`    Events Growth: ${stats.comparison_with_shallow_150_window.events_growth_factor}x (${prodEventsTotal} vs 19)`);
  console.log(`    Symbols Growth: ${stats.comparison_with_shallow_150_window.symbols_growth_factor}x (${stats.lineage_clustering.total_unique_production_symbols_mutated} vs 13)`);
  console.log(`    Commits Growth: ${stats.comparison_with_shallow_150_window.commits_growth_factor}x (${stats.lineage_clustering.unique_production_commits_with_events} vs 17)`);
  console.log(`  Plausibility Verdict: ${isPlausible ? 'PLAUSIBLE' : 'DEFICIT'} (${stats.feasibility_assessment.assessment_notes})`);
  console.log(`========================================================================\n`);

  // Write new versioned output files (preserving previous files!)
  const jsonlOut = path.resolve(__dirname, '../data/phase_c/discovery/callable_event_candidates_express_deepened.jsonl');
  const summaryOut = path.resolve(__dirname, '../data/phase_c/discovery/callable_discovery_summary_express_deepened.json');

  const jsonlContent = allEvents.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(jsonlOut, jsonlContent + '\n', 'utf8');
  console.log(`Saved ${allEvents.length} Express deepened events to: ${jsonlOut}`);

  fs.writeFileSync(summaryOut, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`Saved Express deepened summary to: ${summaryOut}`);

  return stats;
}

runExpressDeepenedDiscovery().catch(err => {
  console.error(err);
  process.exit(1);
});
