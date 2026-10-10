class SimilarityUtils {
  /**
   * Jaccard similarity between two token arrays
   * Range [0, 1]
   */
  static jaccard(setA, setB) {
    if (!setA || !setB) return 0;
    const a = new Set(setA);
    const b = new Set(setB);
    if (a.size === 0 && b.size === 0) return 1.0;
    if (a.size === 0 || b.size === 0) return 0.0;

    let intersectionCount = 0;
    for (const item of a) {
      if (b.has(item)) intersectionCount++;
    }

    const unionCount = a.size + b.size - intersectionCount;
    return unionCount === 0 ? 0 : intersectionCount / unionCount;
  }

  /**
   * Levenshtein string distance normalized to [0, 1] similarity
   */
  static stringSimilarity(s1, s2) {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;
    const str1 = String(s1);
    const str2 = String(s2);
    const l1 = str1.length;
    const l2 = str2.length;
    if (l1 === 0 && l2 === 0) return 1.0;
    if (l1 === 0 || l2 === 0) return 0.0;

    const dp = Array(l2 + 1).fill(0).map((_, i) => i);
    for (let i = 1; i <= l1; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= l2; j++) {
        const temp = dp[j];
        if (str1[i - 1] === str2[j - 1]) {
          dp[j] = prev;
        } else {
          dp[j] = Math.min(prev, dp[j], dp[j - 1]) + 1;
        }
        prev = temp;
      }
    }
    const dist = dp[l2];
    const maxLen = Math.max(l1, l2);
    return Math.max(0, 1 - dist / maxLen);
  }

  /**
   * Scope similarity based on exact match or common suffix/prefix
   */
  static scopeSimilarity(scopeA, scopeB) {
    const sA = Array.isArray(scopeA) ? scopeA : [];
    const sB = Array.isArray(scopeB) ? scopeB : [];
    if (sA.length === 0 && sB.length === 0) return 1.0;
    if (sA.length === 0 || sB.length === 0) return 0.2; // one is top-level, one is nested

    const strA = sA.join('.');
    const strB = sB.join('.');
    if (strA === strB) return 1.0;

    // Check shared prefix or suffix
    let matchingPrefixCount = 0;
    const minLen = Math.min(sA.length, sB.length);
    for (let i = 0; i < minLen; i++) {
      if (sA[i] === sB[i]) matchingPrefixCount++;
      else break;
    }
    return matchingPrefixCount / Math.max(sA.length, sB.length);
  }

  /**
   * Parameter similarity comparing count, names, and types
   */
  static parameterSimilarity(paramsA, paramsB) {
    const pA = Array.isArray(paramsA) ? paramsA : [];
    const pB = Array.isArray(paramsB) ? paramsB : [];
    if (pA.length === 0 && pB.length === 0) return 1.0;
    if (pA.length === 0 || pB.length === 0) return 0.1;

    // Compare counts
    const countDiff = Math.abs(pA.length - pB.length);
    const countScore = Math.max(0, 1 - countDiff / Math.max(pA.length, pB.length));

    // Compare names
    const namesA = pA.map(p => (typeof p === 'string' ? p : p.name || '')).filter(Boolean);
    const namesB = pB.map(p => (typeof p === 'string' ? p : p.name || '')).filter(Boolean);
    const nameJaccard = this.jaccard(namesA, namesB);

    // Compare types where available
    const typesA = pA.map(p => p.type).filter(Boolean);
    const typesB = pB.map(p => p.type).filter(Boolean);
    let typeScore = 1.0;
    if (typesA.length > 0 && typesB.length > 0) {
      typeScore = this.jaccard(typesA, typesB);
    }

    return 0.4 * countScore + 0.4 * nameJaccard + 0.2 * typeScore;
  }
}

module.exports = SimilarityUtils;
