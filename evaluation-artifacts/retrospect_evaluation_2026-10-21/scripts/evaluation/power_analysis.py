"""Cluster-level power / minimum-detectable-effect analysis for the paired B4-vs-B1 MRR comparison.

Uses the only available estimate of between-cluster variability of the paired difference: the 13 cluster-mean
deltas of the pre-registered E3-Reach primary analysis (Java, H=400). This is an assumption: other languages and
query types may vary more or less. Normal approximation for a two-sided test at alpha (optionally Holm-adjusted).

Usage: python -I power_analysis.py [--clusters java=N python=N ...]
"""
import json
import math
import statistics
import sys
from statistics import NormalDist

E3 = 'D:/base papers considered/Retrospect/research_execution_2026-10-21/E3_reach_analysis/e3_reach_results.json'


def mde(sd, m, alpha=0.05, power=0.8):
    z = NormalDist().inv_cdf
    return (z(1 - alpha / 2) + z(power)) * sd / math.sqrt(m)


def clusters_needed(sd, effect, alpha=0.05, power=0.8):
    z = NormalDist().inv_cdf
    return math.ceil(((z(1 - alpha / 2) + z(power)) * sd / effect) ** 2)


def main():
    d = json.load(open(E3, encoding='utf-8'))['sets']['primary']['test_b4_minus_b1_mrr']
    deltas = d['cluster_deltas']
    sd = statistics.stdev(deltas)
    out = {'source': 'E3-Reach primary cluster deltas (13 clusters, Java, H=400)', 'sd_cluster_delta': round(sd, 4),
           'observed_effect': d['observed_mean_delta'],
           'mde_by_clusters_alpha05_power80': {m: round(mde(sd, m), 4) for m in (6, 10, 13, 20, 30, 40, 60, 80)},
           'mde_by_clusters_holm4_alpha0125_power80': {m: round(mde(sd, m, alpha=0.0125), 4) for m in (10, 20, 30, 40, 60, 80)},
           'clusters_needed_for_observed_effect': {'alpha_0.05': clusters_needed(sd, d['observed_mean_delta']),
                                                   'alpha_0.0125_holm4': clusters_needed(sd, d['observed_mean_delta'], alpha=0.0125)},
           'exact_sign_flip_min_attainable_p': {m: 2 / 2 ** m for m in (5, 6, 7, 8, 10)}}
    for a in sys.argv[1:]:
        if '=' in a:
            k, v = a.split('=')
            out.setdefault('actual', {})[k] = {'clusters': int(v), 'mde_alpha05': round(mde(sd, int(v)), 4),
                                               'mde_holm4': round(mde(sd, int(v), alpha=0.0125), 4)}
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
