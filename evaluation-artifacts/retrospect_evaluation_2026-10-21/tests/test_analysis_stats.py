"""Unit tests for the pre-registered statistics. Run: python -I tests/test_analysis_stats.py"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts', 'evaluation'))
import analyze_benchmark as A

assert A.sign_flip([0.1] * 5)['p'] == 2 / 32
assert A.sign_flip([0.1, -0.1])['p'] == 1.0
assert A.holm({'a': 0.01, 'b': 0.04, 'c': 0.03, 'd': 0.5}) == {'a': 0.04, 'c': 0.09, 'b': 0.09, 'd': 0.5}
m = A.metrics([1, 3, None, 12])
assert m['R@1'] == 0.25 and m['R@10'] == 0.5 and m['MRR'] == round((1 + 1/3 + 1/12) / 4, 4) and m['median_rank'] == 7.5
t = A.transitions([None, 3, 5, 20, 2], [4, None, 2, 30, 2])
assert t == {'rescue@10': 1, 'harm@10': 1, 'improved': 1, 'regressed': 1, 'unchanged': 1}, t
rows = [{'cluster_id': 'x', 'b1': 1, 'b4': None}, {'cluster_id': 'x', 'b1': None, 'b4': 1}, {'cluster_id': 'y', 'b1': None, 'b4': 2}]
assert sorted(A.cluster_deltas(rows, 'b4')) == [0.0, 0.5]
assert A.sign_flip([0.01 * i for i in range(1, 25)])['method'] == 'monte_carlo_100000'
print('analysis stats tests: OK')
