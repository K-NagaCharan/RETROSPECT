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

function isTestFilePath(repoName, filePath) {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  if (repoName === 'bottle') {
    return norm.startsWith('test') || norm.includes('/test_') || norm.includes('test/');
  }
  if (repoName === 'express') {
    return norm.startsWith('test/') || norm.startsWith('examples/') || norm.startsWith('benchmarks/');
  }
  if (repoName === 'zod') {
    return norm.includes('/tests/') || norm.includes('/test/') || norm.includes('.test.') || norm.includes('.spec.');
  }
  if (repoName === 'gson') {
    return norm.includes('/src/test/') || norm.endsWith('test.java');
  }
  return false;
}

async function runCallableDiscovery() {
  console.log('========================================================================');
  console.log('Retrospect Phase C: Callable-Level Historical AST Discovery');
  console.log('========================================================================\n');

  const repos = [
    { name: 'bottle', lang: 'python', ext: ['.py'] },
    { name: 'express', lang: 'javascript', ext: ['.js', '.mjs', '.cjs'] },
    { name: 'zod', lang: 'typescript', ext: ['.ts', '.tsx'] },
    { name: 'gson', lang: 'java', ext: ['.java'] }
  ];

  const allEvents = [];
  const summary = {
    scan_timestamp: new Date().toISOString(),
    discovery_window_spec: 'Up to 150 most recent commits from pinned HEAD',
    repositories: {}
  };

  let eventCounter = 1;

  for (const r of repos) {
    const repoPath = path.resolve(__dirname, '../data/external_repos', r.name);
    console.log(`Processing repository: ${r.name}...`);

    const headCommit = runGit(repoPath, ['rev-parse', 'HEAD']).trim();
    const logOutput = runGit(repoPath, ['log', '-n', '150', '--format=%H%x09%P%x09%ad%x09%s', '--date=short']).trim().split('\n').filter(Boolean);

    const repoStats = {
      language: r.lang,
      pinned_head_commit: headCommit,
      scanned_commits: logOutput.length,
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
        multi_mutation_symbols_count: 0
      },
      ambiguous_lineage_candidates: [],
      feasibility_assessment: {}
    };

    const productionLineageClusters = new Map(); // clusterKey -> list of event_ids
    const productionCommitsWithEvents = new Set();

    for (const logLine of logOutput) {
      const [sha, parentsStr, commitDate, subject] = logLine.split('\t');
      const parents = (parentsStr || '').split(' ').filter(Boolean);
      if (parents.length === 0) continue; // root commit in shallow checkout

      const isMerge = parents.length > 1;
      if (isMerge) repoStats.merge_commits_handled++;

      const parentSha = parents[0]; // primary parent

      // Get diff name-status with rename detection
      let nameStatusOutput;
      try {
        nameStatusOutput = runGit(repoPath, ['diff', '--name-status', '-M', parentSha, sha]).split('\n').filter(Boolean);
      } catch (err) {
        continue;
      }

      for (const ns of nameStatusOutput) {
        const parts = ns.split('\t');
        const statusCode = parts[0][0]; // A, D, M, R
        const oldFile = parts[1];
        const newFile = parts[2] || parts[1];

        const relevantExt = r.ext.some(ext => newFile.endsWith(ext) || oldFile.endsWith(ext));
        if (!relevantExt) {
          repoStats.unsupported_or_skipped_files++;
          continue;
        }

        repoStats.files_diffed++;

        const isTest = isTestFilePath(r.name, newFile) || isTestFilePath(r.name, oldFile);

        // Fetch parent and child file contents
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

        // Parse parent symbols
        let parentSymbols = [];
        if (parentSource !== null) {
          const adapter = defaultRegistry.getAdapterForFile(oldFile);
          if (adapter) {
            try {
              const tree = await adapter.parse(parentSource);
              if (tree.rootNode.hasError()) repoStats.parser_syntax_errors++;
              parentSymbols = adapter.extractSymbols(parentSource, tree, oldFile);
              repoStats.files_parsed_successfully++;
            } catch (err) {
              repoStats.parser_syntax_errors++;
            }
          }
        }

        // Parse child symbols
        let childSymbols = [];
        if (childSource !== null) {
          const adapter = defaultRegistry.getAdapterForFile(newFile);
          if (adapter) {
            try {
              const tree = await adapter.parse(childSource);
              if (tree.rootNode.hasError()) repoStats.parser_syntax_errors++;
              childSymbols = adapter.extractSymbols(childSource, tree, newFile);
              repoStats.files_parsed_successfully++;
            } catch (err) {
              repoStats.parser_syntax_errors++;
            }
          }
        }

        // Compare parentSymbols and childSymbols
        const parentByQName = new Map();
        for (const s of parentSymbols) {
          parentByQName.set(s.qualifiedName, s);
        }

        const childByQName = new Map();
        for (const s of childSymbols) {
          childByQName.set(s.qualifiedName, s);
        }

        const matchedQNames = new Set();
        const unmatchedParent = [];
        const unmatchedChild = [];

        // Step 1: Match by qualifiedName
        for (const [qname, childSym] of childByQName.entries()) {
          if (parentByQName.has(qname)) {
            matchedQNames.add(qname);
            const parentSym = parentByQName.get(qname);

            if (parentSym.sourceHash === childSym.sourceHash) {
              // Unchanged callable
              continue;
            }

            const jaccard = computeJaccard(parentSym.normalizedTokens, childSym.normalizedTokens);
            const clusterKey = `${r.name}::${newFile}::${qname}`;

            if (parentSym.normalizedSignature !== childSym.normalizedSignature) {
              // Signature change
              const eventId = `evt_${r.name}_${String(eventCounter++).padStart(5, '0')}`;
              const event = {
                event_id: eventId,
                repository: r.name,
                commit_sha: sha,
                parent_sha: parentSha,
                commit_date: commitDate,
                commit_subject: subject,
                event_type: 'signature_change',
                is_verified_lineage: true,
                evidence_type: 'stable_qualified_name_match',
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
              repoStats.raw_events_by_type.signature_change++;
              if (isTest) {
                repoStats.test_events_total++;
              } else {
                repoStats.production_events_by_type.signature_change++;
                productionCommitsWithEvents.add(sha);
                if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
                productionLineageClusters.get(clusterKey).push(eventId);
              }
            } else if (jaccard < 0.50) {
              // Substantial rewrite
              const eventId = `evt_${r.name}_${String(eventCounter++).padStart(5, '0')}`;
              const event = {
                event_id: eventId,
                repository: r.name,
                commit_sha: sha,
                parent_sha: parentSha,
                commit_date: commitDate,
                commit_subject: subject,
                event_type: 'substantial_rewrite',
                is_verified_lineage: true,
                evidence_type: 'stable_qualified_name_and_signature_match',
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
              repoStats.raw_events_by_type.substantial_rewrite++;
              if (isTest) {
                repoStats.test_events_total++;
              } else {
                repoStats.production_events_by_type.substantial_rewrite++;
                productionCommitsWithEvents.add(sha);
                if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
                productionLineageClusters.get(clusterKey).push(eventId);
              }
            } else {
              // Routine modification
              const eventId = `evt_${r.name}_${String(eventCounter++).padStart(5, '0')}`;
              const event = {
                event_id: eventId,
                repository: r.name,
                commit_sha: sha,
                parent_sha: parentSha,
                commit_date: commitDate,
                commit_subject: subject,
                event_type: 'routine_modification',
                is_verified_lineage: true,
                evidence_type: 'stable_qualified_name_and_signature_match',
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
              repoStats.raw_events_by_type.routine_modification++;
              if (isTest) {
                repoStats.test_events_total++;
              } else {
                repoStats.production_events_by_type.routine_modification++;
                productionCommitsWithEvents.add(sha);
                if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
                productionLineageClusters.get(clusterKey).push(eventId);
              }
            }
          } else {
            unmatchedChild.push(childSym);
          }
        }

        for (const [qname, parentSym] of parentByQName.entries()) {
          if (!matchedQNames.has(qname)) {
            unmatchedParent.push(parentSym);
          }
        }

        // Step 2: Cross-match unmatched symbols for candidate renames and moves
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
              const clusterKey = `${r.name}::${newFile}::${cSym.qualifiedName}`;
              const eventId = `evt_${r.name}_${String(eventCounter++).padStart(5, '0')}`;

              const event = {
                event_id: eventId,
                repository: r.name,
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
              repoStats.raw_events_by_type[eventType]++;
              if (isTest) {
                repoStats.test_events_total++;
              } else {
                repoStats.production_events_by_type[eventType]++;
                productionCommitsWithEvents.add(sha);
                if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
                productionLineageClusters.get(clusterKey).push(eventId);
                if (repoStats.ambiguous_lineage_candidates.length < 5) {
                  repoStats.ambiguous_lineage_candidates.push({
                    commit: sha.slice(0, 8),
                    parent_symbol: pSym.qualifiedName,
                    child_symbol: cSym.qualifiedName,
                    similarity: parseFloat(jaccard.toFixed(3)),
                    type: eventType
                  });
                }
              }
              break;
            }
          }
        }

        // Step 3: Remaining additions and deletions
        for (const cSym of unmatchedChild) {
          if (!matchedHeuristicC.has(cSym.qualifiedName)) {
            const eventId = `evt_${r.name}_${String(eventCounter++).padStart(5, '0')}`;
            const clusterKey = `${r.name}::${newFile}::${cSym.qualifiedName}`;
            const event = {
              event_id: eventId,
              repository: r.name,
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
            repoStats.raw_events_by_type.callable_addition++;
            if (isTest) {
              repoStats.test_events_total++;
            } else {
              repoStats.production_events_by_type.callable_addition++;
              productionCommitsWithEvents.add(sha);
              if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
              productionLineageClusters.get(clusterKey).push(eventId);
            }
          }
        }

        for (const pSym of unmatchedParent) {
          if (!matchedHeuristicP.has(pSym.qualifiedName)) {
            const eventId = `evt_${r.name}_${String(eventCounter++).padStart(5, '0')}`;
            const clusterKey = `${r.name}::${oldFile}::${pSym.qualifiedName}`;
            const event = {
              event_id: eventId,
              repository: r.name,
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
            repoStats.raw_events_by_type.callable_deletion++;
            if (isTest) {
              repoStats.test_events_total++;
            } else {
              repoStats.production_events_by_type.callable_deletion++;
              productionCommitsWithEvents.add(sha);
              if (!productionLineageClusters.has(clusterKey)) productionLineageClusters.set(clusterKey, []);
              productionLineageClusters.get(clusterKey).push(eventId);
            }
          }
        }
      }
    }

    // Lineage clustering statistics
    repoStats.lineage_clustering.total_unique_production_symbols_mutated = productionLineageClusters.size;
    repoStats.lineage_clustering.unique_production_commits_with_events = productionCommitsWithEvents.size;
    let multiMutationCount = 0;
    for (const [key, evts] of productionLineageClusters.entries()) {
      if (evts.length > 1) multiMutationCount++;
    }
    repoStats.lineage_clustering.multi_mutation_symbols_count = multiMutationCount;

    // Plausibility Assessment
    const prodEventsTotal = Object.values(repoStats.production_events_by_type).reduce((a, b) => a + b, 0);
    const targetQueries = 40;
    const isPlausible = repoStats.lineage_clustering.unique_production_commits_with_events >= 40 &&
                        repoStats.lineage_clustering.total_unique_production_symbols_mutated >= 40;

    repoStats.feasibility_assessment = {
      target_answerable_queries: targetQueries,
      total_production_events: prodEventsTotal,
      unique_production_symbols: repoStats.lineage_clustering.total_unique_production_symbols_mutated,
      unique_production_commits: repoStats.lineage_clustering.unique_production_commits_with_events,
      plausibly_supports_target_sample: isPlausible,
      assessment_notes: isPlausible
        ? `Sufficient production event base (${repoStats.lineage_clustering.unique_production_commits_with_events} commits, ${repoStats.lineage_clustering.total_unique_production_symbols_mutated} unique symbols) to curate ${targetQueries} answerable queries.`
        : `Deficit warning: Only ${repoStats.lineage_clustering.unique_production_commits_with_events} commits and ${repoStats.lineage_clustering.total_unique_production_symbols_mutated} unique symbols available. Cannot support ${targetQueries} independent queries under strict partition isolation.`
    };

    summary.repositories[r.name] = repoStats;

    console.log(`  Done: ${r.name}`);
    console.log(`    Total Raw Events: ${Object.values(repoStats.raw_events_by_type).reduce((a, b) => a + b, 0)} (Prod: ${prodEventsTotal}, Test: ${repoStats.test_events_total})`);
    console.log(`    Prod Events by Type: Add=${repoStats.production_events_by_type.callable_addition}, Del=${repoStats.production_events_by_type.callable_deletion}, SigChange=${repoStats.production_events_by_type.signature_change}, Rewrite=${repoStats.production_events_by_type.substantial_rewrite}, Routine=${repoStats.production_events_by_type.routine_modification}, RenHeur=${repoStats.production_events_by_type.candidate_rename_heuristic}, MovHeur=${repoStats.production_events_by_type.candidate_move_heuristic}`);
    console.log(`    Clustering: Unique Prod Symbols=${repoStats.lineage_clustering.total_unique_production_symbols_mutated}, Unique Commits=${repoStats.lineage_clustering.unique_production_commits_with_events}, Multi-Mutated=${multiMutationCount}`);
    console.log(`    Plausibility: ${isPlausible ? 'PLAUSIBLE' : 'DEFICIT'} (${repoStats.feasibility_assessment.assessment_notes})\n`);
  }

  // Write outputs
  const jsonlPath = path.resolve(__dirname, '../data/phase_c/discovery/callable_event_candidates.jsonl');
  const summaryPath = path.resolve(__dirname, '../data/phase_c/discovery/callable_discovery_summary.json');

  const jsonlLines = allEvents.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(jsonlPath, jsonlLines + '\n', 'utf8');
  console.log(`Saved ${allEvents.length} callable events to: ${jsonlPath}`);

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Saved discovery summary to: ${summaryPath}`);

  return summary;
}

runCallableDiscovery().catch(err => {
  console.error(err);
  process.exit(1);
});
