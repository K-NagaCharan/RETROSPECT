const SimilarityUtils = require('./SimilarityUtils');

class FunctionMatcher {
  constructor(config = {}) {
    // Configurable, documented weights
    this.weights = {
      tokens: config.weightTokens ?? 0.35,
      name: config.weightName ?? 0.25,
      signature: config.weightSignature ?? 0.15,
      scope: config.weightScope ?? 0.15,
      params: config.weightParams ?? 0.10
    };

    // Configurable thresholds
    this.thresholds = {
      exact: config.thresholdExact ?? 0.95,
      highConfidence: config.thresholdHigh ?? 0.70,
      moderateConfidence: config.thresholdModerate ?? 0.50,
      ambiguityDelta: config.thresholdAmbiguityDelta ?? 0.08
    };
  }

  /**
   * Match a target symbol against candidate symbols in the previous snapshot
   * @param {SymbolRecord} target 
   * @param {Array<SymbolRecord>} candidates 
   * @param {object} context { isNewFile, filePath, parentFilePath }
   */
  match(target, candidates = [], context = {}) {
    if (!target) {
      throw new Error('FunctionMatcher: target symbol is required');
    }

    if (!candidates || candidates.length === 0) {
      // If no candidates exist in the parent snapshot
      const classification = context.isNewFile ? 'new' : 'uncertain';
      return {
        selected: null,
        rankedAlternatives: [],
        score: 0,
        evidence: {
          reason: context.isNewFile
            ? 'Containing file was newly introduced in this commit'
            : 'No symbol candidates found in parent file snapshot'
        },
        matchingMethod: 'none',
        decisionStatus: context.isNewFile ? 'no_match' : 'uncertain',
        changeClassification: classification
      };
    }

    // --- Tier 1: Strong Identity Signals ---
    for (const candidate of candidates) {
      // Check 1: Identical source hash (completely unchanged)
      if (candidate.sourceHash === target.sourceHash && candidate.name === target.name) {
        const isMoved = candidate.filePath !== target.filePath;
        const classification = isMoved ? 'moved' : 'unchanged';
        return {
          selected: candidate,
          rankedAlternatives: [],
          score: 1.0,
          evidence: {
            reason: 'Identical source hash and name match',
            exactHash: true,
            isMoved
          },
          matchingMethod: 'tier1_exact_hash',
          decisionStatus: 'exact_match',
          changeClassification: classification
        };
      }

      // Check 2: Exact qualified name + exact signature
      const exactNameMatch = candidate.name === target.name;
      const exactScopeMatch = SimilarityUtils.scopeSimilarity(target.enclosingScope, candidate.enclosingScope) === 1.0;
      const exactSigMatch = candidate.normalizedSignature === target.normalizedSignature;

      if (exactNameMatch && exactScopeMatch && exactSigMatch) {
        const isMoved = candidate.filePath !== target.filePath;
        return {
          selected: candidate,
          rankedAlternatives: [],
          score: 0.98,
          evidence: {
            reason: 'Exact qualified name and signature match',
            exactName: true,
            exactSignature: true,
            isMoved
          },
          matchingMethod: 'tier1_exact_signature',
          decisionStatus: 'high_confidence',
          changeClassification: isMoved ? 'moved' : 'modified'
        };
      }

      // Check 3: Exact name + exact scope (standard modification)
      if (exactNameMatch && exactScopeMatch) {
        const tokenSim = SimilarityUtils.jaccard(target.normalizedTokens, candidate.normalizedTokens);
        // If token similarity is healthy (>= 0.25), this is cleanly the modified version of the same function
        if (tokenSim >= 0.25) {
          const isMoved = candidate.filePath !== target.filePath;
          return {
            selected: candidate,
            rankedAlternatives: [],
            score: 0.90 + 0.08 * tokenSim,
            evidence: {
              reason: 'Exact name and enclosing scope match with modified body',
              tokenSimilarity: tokenSim,
              isMoved
            },
            matchingMethod: 'tier1_name_and_scope',
            decisionStatus: 'high_confidence',
            changeClassification: isMoved ? 'moved' : 'modified'
          };
        }
      }
    }

    // --- Tier 2: Similarity-Based Matching ---
    const scoredCandidates = candidates.map(candidate => {
      const nameSim = SimilarityUtils.stringSimilarity(target.name, candidate.name);
      const sigSim = SimilarityUtils.stringSimilarity(target.normalizedSignature, candidate.normalizedSignature);
      const paramSim = SimilarityUtils.parameterSimilarity(target.parameters, candidate.parameters);
      const scopeSim = SimilarityUtils.scopeSimilarity(target.enclosingScope, candidate.enclosingScope);
      const tokenSim = SimilarityUtils.jaccard(target.normalizedTokens, candidate.normalizedTokens);

      const totalScore =
        this.weights.tokens * tokenSim +
        this.weights.name * nameSim +
        this.weights.signature * sigSim +
        this.weights.scope * scopeSim +
        this.weights.params * paramSim;

      return {
        candidate,
        scores: {
          total: totalScore,
          token: tokenSim,
          name: nameSim,
          signature: sigSim,
          scope: scopeSim,
          params: paramSim
        }
      };
    });

    // Rank candidates by total score descending
    scoredCandidates.sort((a, b) => b.scores.total - a.scores.total);

    const top1 = scoredCandidates[0];
    const top2 = scoredCandidates[1];

    // Ambiguity check: if top2 is very close to top1 and both have viable scores
    if (top2 && (top1.scores.total - top2.scores.total < this.thresholds.ambiguityDelta) && top1.scores.total >= this.thresholds.moderateConfidence) {
      return {
        selected: null,
        rankedAlternatives: scoredCandidates.slice(0, 3).map(s => ({
          id: s.candidate.id,
          name: s.candidate.name,
          score: s.scores.total,
          scores: s.scores
        })),
        score: top1.scores.total,
        evidence: {
          reason: `Ambiguous candidates: top score (${top1.scores.total.toFixed(2)}) is within ${this.thresholds.ambiguityDelta} of second score (${top2.scores.total.toFixed(2)})`,
          top1: top1.candidate.name,
          top2: top2.candidate.name
        },
        matchingMethod: 'tier2_similarity_ambiguous',
        decisionStatus: 'uncertain',
        changeClassification: 'uncertain'
      };
    }

    // High confidence match
    if (top1.scores.total >= this.thresholds.highConfidence) {
      const isRenamed = top1.candidate.name !== target.name;
      const isMoved = top1.candidate.filePath !== target.filePath;
      let classification = 'modified';
      if (isRenamed && isMoved) classification = 'renamed_and_moved';
      else if (isRenamed) classification = 'renamed';
      else if (isMoved) classification = 'moved';

      return {
        selected: top1.candidate,
        rankedAlternatives: scoredCandidates.slice(1, 3).map(s => ({
          id: s.candidate.id,
          name: s.candidate.name,
          score: s.scores.total
        })),
        score: top1.scores.total,
        evidence: {
          reason: 'High confidence similarity match',
          scores: top1.scores,
          isRenamed,
          isMoved
        },
        matchingMethod: 'tier2_similarity',
        decisionStatus: 'high_confidence',
        changeClassification: classification
      };
    }

    // Moderate confidence match
    if (top1.scores.total >= this.thresholds.moderateConfidence) {
      const isRenamed = top1.candidate.name !== target.name;
      const isMoved = top1.candidate.filePath !== target.filePath;
      let classification = 'modified';
      if (isRenamed && isMoved) classification = 'renamed_and_moved';
      else if (isRenamed) classification = 'renamed';
      else if (isMoved) classification = 'moved';

      return {
        selected: top1.candidate,
        rankedAlternatives: scoredCandidates.slice(1, 3).map(s => ({
          id: s.candidate.id,
          name: s.candidate.name,
          score: s.scores.total
        })),
        score: top1.scores.total,
        evidence: {
          reason: 'Moderate confidence similarity match',
          scores: top1.scores,
          isRenamed,
          isMoved
        },
        matchingMethod: 'tier2_similarity_moderate',
        decisionStatus: 'moderate_confidence',
        changeClassification: classification
      };
    }

    // Below threshold: evaluate whether genuinely new or unresolved
    const classification = context.isNewFile ? 'new' : 'uncertain';
    return {
      selected: null,
      rankedAlternatives: scoredCandidates.slice(0, 3).map(s => ({
        id: s.candidate.id,
        name: s.candidate.name,
        score: s.scores.total
      })),
      score: top1.scores.total,
      evidence: {
        reason: `Highest candidate score (${top1.scores.total.toFixed(2)}) below threshold (${this.thresholds.moderateConfidence})`,
        bestCandidate: top1.candidate.name
      },
      matchingMethod: 'tier2_similarity_fallback',
      decisionStatus: context.isNewFile ? 'no_match' : 'uncertain',
      changeClassification: classification
    };
  }
}

module.exports = FunctionMatcher;
