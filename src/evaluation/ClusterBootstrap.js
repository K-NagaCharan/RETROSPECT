/**
 * ClusterBootstrap.js - Cluster bootstrap resampling for non-independent cases sharing origin commits.
 */

class ClusterBootstrap {
  /**
   * Identifies the statistical cluster identifier for a case.
   * Cases sharing an origin commit belong to the same refactoring cluster.
   * @param {object} c Case result object.
   * @returns {string} Cluster key.
   */
  static getClusterKey(c) {
    if (!c) return 'unknown';
    return c.origin_commit || c.origin_commit_cluster || c.origin_sha || c.case_id || 'unassigned';
  }

  /**
   * Groups cases into distinct origin-commit clusters.
   * @param {Array<object>} cases
   * @returns {Map<string, Array<object>>} Map of clusterKey -> cases array.
   */
  static buildClusters(cases) {
    const clusters = new Map();
    for (const c of cases) {
      const key = ClusterBootstrap.getClusterKey(c);
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key).push(c);
    }
    return clusters;
  }

  /**
   * Metric evaluation functions.
   */
  static METRICS = {
    'success@10': (cases) => {
      if (!cases.length) return 0;
      let hits = 0;
      for (const c of cases) {
        const r = c.target_rank != null ? Number(c.target_rank) : null;
        if (r != null && r >= 1 && r <= 10) hits++;
      }
      return hits / cases.length;
    },
    'recall@1': (cases) => {
      if (!cases.length) return 0;
      let hits = 0;
      for (const c of cases) {
        const r = c.target_rank != null ? Number(c.target_rank) : null;
        if (r === 1) hits++;
      }
      return hits / cases.length;
    },
    'recall@5': (cases) => {
      if (!cases.length) return 0;
      let hits = 0;
      for (const c of cases) {
        const r = c.target_rank != null ? Number(c.target_rank) : null;
        if (r != null && r >= 1 && r <= 5) hits++;
      }
      return hits / cases.length;
    },
    'mrr': (cases) => {
      if (!cases.length) return 0;
      let sumRR = 0;
      for (const c of cases) {
        const r = c.target_rank != null ? Number(c.target_rank) : null;
        if (r != null && r >= 1) {
          sumRR += (1.0 / r);
        }
      }
      return sumRR / cases.length;
    },
    'abstention_rate': (cases) => {
      if (!cases.length) return 0;
      let abstentions = 0;
      for (const c of cases) {
        if (c.abstained === true || c.target_score === 0.0 || c.target_rank == null) {
          abstentions++;
        }
      }
      return abstentions / cases.length;
    }
  };

  /**
   * Computes a cluster-bootstrap confidence interval for a single configuration.
   * @param {Array<object>} cases
   * @param {string} metricName Key from METRICS or custom function.
   * @param {object} options
   * @param {number} [options.replicates=1000] Number of bootstrap resamples (B).
   * @param {number} [options.confidence=0.95] Confidence level (e.g. 0.95).
   * @param {number} [options.seed] Optional pseudo-random seed.
   * @returns {object} Bootstrap statistics.
   */
  static bootstrap(cases, metricName, options = {}) {
    if (!Array.isArray(cases) || cases.length === 0) {
      throw new Error('Cases must be a non-empty array.');
    }

    const metricFn = typeof metricName === 'function' ? metricName : ClusterBootstrap.METRICS[metricName.toLowerCase()];
    if (!metricFn) {
      throw new Error(`Unsupported metric '${metricName}'. Supported: ${Object.keys(ClusterBootstrap.METRICS).join(', ')}`);
    }

    const B = options.replicates || 1000;
    const confidence = options.confidence || 0.95;
    const alpha = 1.0 - confidence;

    // Cluster identification
    const clusterMap = ClusterBootstrap.buildClusters(cases);
    const clusterKeys = Array.from(clusterMap.keys());
    const M = clusterKeys.length;

    // PRNG support
    let rand = Math.random;
    if (typeof options.seed === 'number') {
      let s = options.seed;
      rand = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    }

    // Point estimate on original dataset
    const pointEstimate = metricFn(cases);

    // Bootstrap resampling
    const bootValues = new Float64Array(B);

    for (let b = 0; b < B; b++) {
      const sampleCases = [];
      for (let m = 0; m < M; m++) {
        const randIdx = Math.floor(rand() * M);
        const selectedClusterCases = clusterMap.get(clusterKeys[randIdx]);
        for (let i = 0; i < selectedClusterCases.length; i++) {
          sampleCases.push(selectedClusterCases[i]);
        }
      }
      bootValues[b] = metricFn(sampleCases);
    }

    // Sort to determine percentile bounds
    bootValues.sort();
    const lowIdx = Math.max(0, Math.floor((alpha / 2.0) * B));
    const highIdx = Math.min(B - 1, Math.ceil((1.0 - alpha / 2.0) * B) - 1);
    const ciLower = bootValues[lowIdx];
    const ciUpper = bootValues[highIdx];

    // Standard error
    let sum = 0;
    for (let i = 0; i < B; i++) sum += bootValues[i];
    const mean = sum / B;
    let sumSq = 0;
    for (let i = 0; i < B; i++) sumSq += Math.pow(bootValues[i] - mean, 2);
    const se = Math.sqrt(sumSq / (B - 1));

    return {
      metric: typeof metricName === 'string' ? metricName : 'custom',
      point_estimate: pointEstimate,
      observed: pointEstimate,
      ci_lower: ciLower,
      ci_upper: ciUpper,
      standard_error: se,
      replicates: B,
      confidence_level: confidence,
      cases_count: cases.length,
      clusters_count: M,
      cluster_count: M,
      is_cluster_count_limited: M < 15,
      warning: M < 15 ? `Cluster count (${M}) is too small for asymptotic bootstrap coverage. Estimates should be treated as descriptive.` : null
    };
  }

  /**
   * Computes a paired cluster-bootstrap confidence interval for the difference between two configurations (A - B).
   * @param {Array<object>} casesA
   * @param {Array<object>} casesB
   * @param {string} metricName
   * @param {object} options
   * @returns {object} Paired difference bootstrap statistics.
   */
  static pairedBootstrap(casesA, casesB, metricName, options = {}) {
    if (casesA.length !== casesB.length) {
      throw new Error(`Paired bootstrap requires identical case counts (got ${casesA.length} vs ${casesB.length}).`);
    }

    const metricFn = typeof metricName === 'function' ? metricName : ClusterBootstrap.METRICS[metricName.toLowerCase()];
    if (!metricFn) {
      throw new Error(`Unsupported metric '${metricName}'.`);
    }

    // Match pairs by case_id
    const mapB = new Map();
    for (const cb of casesB) {
      mapB.set(cb.case_id, cb);
    }

    const pairs = [];
    for (const ca of casesA) {
      const cb = mapB.get(ca.case_id);
      if (!cb) {
        throw new Error(`Missing paired case for ID '${ca.case_id}'.`);
      }
      pairs.push({ a: ca, b: cb, clusterKey: ClusterBootstrap.getClusterKey(ca) });
    }

    // Cluster pairs
    const clusterMap = new Map();
    for (const p of pairs) {
      if (!clusterMap.has(p.clusterKey)) {
        clusterMap.set(p.clusterKey, []);
      }
      clusterMap.get(p.clusterKey).push(p);
    }

    const clusterKeys = Array.from(clusterMap.keys());
    const M = clusterKeys.length;
    const B = options.replicates || 1000;
    const confidence = options.confidence || 0.95;
    const alpha = 1.0 - confidence;

    // PRNG support
    let rand = Math.random;
    if (typeof options.seed === 'number') {
      let s = options.seed;
      rand = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    }

    const diffPointEstimate = metricFn(casesA) - metricFn(casesB);
    const bootDiffs = new Float64Array(B);

    for (let b = 0; b < B; b++) {
      const sampleA = [];
      const sampleB = [];

      for (let m = 0; m < M; m++) {
        const randIdx = Math.floor(rand() * M);
        const clusterPairs = clusterMap.get(clusterKeys[randIdx]);
        for (let i = 0; i < clusterPairs.length; i++) {
          sampleA.push(clusterPairs[i].a);
          sampleB.push(clusterPairs[i].b);
        }
      }

      bootDiffs[b] = metricFn(sampleA) - metricFn(sampleB);
    }

    bootDiffs.sort();
    const lowIdx = Math.max(0, Math.floor((alpha / 2.0) * B));
    const highIdx = Math.min(B - 1, Math.ceil((1.0 - alpha / 2.0) * B) - 1);

    return {
      metric: typeof metricName === 'string' ? metricName : 'custom',
      diff_point_estimate: diffPointEstimate,
      observed_delta: diffPointEstimate,
      ci_lower: bootDiffs[lowIdx],
      ci_upper: bootDiffs[highIdx],
      replicates: B,
      confidence_level: confidence,
      cases_count: pairs.length,
      clusters_count: M,
      cluster_count: M,
      is_cluster_count_limited: M < 15,
      warning: M < 15 ? `Cluster count (${M}) is too small for asymptotic coverage. Do not infer confirmatory superiority.` : null
    };
  }

  /**
   * Alias for pairedBootstrap.
   */
  static bootstrapPaired(casesA, casesB, metricName, options = {}) {
    return ClusterBootstrap.pairedBootstrap(casesA, casesB, metricName, options);
  }
}

module.exports = ClusterBootstrap;
