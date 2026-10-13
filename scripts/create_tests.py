from pathlib import Path

content = r'''"""
Comprehensive Automated Tests for Retrospect Expanded Evaluation Subsystem.
Tests schema validation, adapters, baselines, unified metrics, candidate pool scaling, and leakage prevention.
"""
import unittest
from pathlib import Path
import json

from src.evaluation.schema import LineageInstance, FunctionEntity, CandidateEntity
from src.evaluation.adapters.dataset_adapters import (
    ReferenceBenchmarkAdapter,
    RefactoringMinerJavaAdapter,
    BigCloneBenchStressAdapter
)
from src.evaluation.baselines.configurations import (
    ExactLexicalBaseline,
    StructuralBaseline,
    HistoricalBaseline,
    CombinedRetrievalBaseline
)
from src.evaluation.metrics.unified_metrics import (
    compute_lineage_metrics,
    bootstrap_relative_difference
)
from src.evaluation.datasets.track_builder import (
    Track1LineageBuilder,
    Track2RepoWideBuilder,
    Track3StressSubsets
)

class TestExpandedEvaluationSubsystem(unittest.TestCase):

    def test_unified_schema_validation(self):
        tf = FunctionEntity(name="compute", source="int compute() { return 1; }", file_path="A.java")
        cands = [
            CandidateEntity("cand_0", "compute", "int compute() { return 1; }", "A.java", is_ground_truth=True),
            CandidateEntity("cand_1", "calc", "int calc() { return 2; }", "A.java")
        ]
        inst = LineageInstance(
            instance_id="inst_1",
            dataset="test_ds",
            language="java",
            repository="test/repo",
            base_commit="c0",
            target_commit="c1",
            target_function=tf,
            candidates=cands,
            ground_truth_id="cand_0",
            evolution_type="unchanged",
            split="test"
        )
        inst.validate()
        d = inst.to_dict()
        self.assertEqual(d["instance_id"], "inst_1")
        self.assertEqual(d["ground_truth_id"], "cand_0")

        # Invalid ground_truth_id must raise ValueError
        inst.ground_truth_id = "non_existent_cand"
        with self.assertRaises(ValueError):
            inst.validate()

    def test_reference_benchmark_splits_and_leakage(self):
        adapter = ReferenceBenchmarkAdapter()
        val_items = adapter.load(split_filter="val")
        test_items = adapter.load(split_filter="test")

        self.assertEqual(len(val_items), 112)
        self.assertEqual(len(test_items), 168)
        self.assertEqual(len(val_items) + len(test_items), 280)

        # Zero ID overlap between validation and held-out test splits
        val_ids = {item.instance_id for item in val_items}
        test_ids = {item.instance_id for item in test_items}
        overlap = val_ids.intersection(test_ids)
        self.assertEqual(len(overlap), 0, f"Split leakage detected! Overlapping IDs: {overlap}")

    def test_lineage_and_new_metrics(self):
        toy_preds = [
            {"ground_truth_id": "cand_0", "prediction": "cand_0", "confidence": 0.95, "scores": {"cand_0": 0.95, "cand_1": 0.1}},
            {"ground_truth_id": "cand_1", "prediction": "cand_0", "confidence": 0.85, "scores": {"cand_0": 0.85, "cand_1": 0.7}},
            {"ground_truth_id": "NEW", "prediction": "NEW", "confidence": 0.90, "scores": {"cand_0": 0.2, "cand_1": 0.1}},
            {"ground_truth_id": "NEW", "prediction": "cand_1", "confidence": 0.60, "scores": {"cand_1": 0.60, "cand_0": 0.3}}
        ]

        metrics = compute_lineage_metrics(toy_preds)
        self.assertEqual(metrics["count"], 4)
        self.assertEqual(metrics["top1_accuracy"], 0.50) # 2 correct out of 4
        self.assertIn("mrr", metrics)
        self.assertIn("brier_score", metrics)
        self.assertIn("ece", metrics)
        self.assertEqual(metrics["new_precision"], 1.0) # 1 TP, 0 FP on NEW
        self.assertEqual(metrics["new_recall"], 0.5) # 1 TP, 1 FN on NEW

    def test_paired_bootstrap_confidence_interval(self):
        p_base = [
            {"ground_truth_id": "c0", "prediction": "c0"},
            {"ground_truth_id": "c0", "prediction": "c1"},
            {"ground_truth_id": "c0", "prediction": "c1"},
            {"ground_truth_id": "c0", "prediction": "c0"}
        ]
        p_target = [
            {"ground_truth_id": "c0", "prediction": "c0"},
            {"ground_truth_id": "c0", "prediction": "c0"},
            {"ground_truth_id": "c0", "prediction": "c0"},
            {"ground_truth_id": "c0", "prediction": "c0"}
        ]
        res = bootstrap_relative_difference(p_base, p_target, num_bootstraps=500)
        self.assertAlmostEqual(res["observed_delta"], 0.50, places=2)
        self.assertTrue(res["ci_lower"] >= 0.0)

    def test_four_retrieval_configurations(self):
        tf = {"name": "hello", "source": "def hello():\n    return 'world'", "file_path": "test.py"}
        cands = [
            {"candidate_id": "c0", "name": "hello", "source": "def hello():\n    return 'world'", "file_path": "test.py"},
            {"candidate_id": "c1", "name": "other", "source": "def other():\n    return 1", "file_path": "test.py"}
        ]

        configs = [
            ExactLexicalBaseline(),
            StructuralBaseline(),
            HistoricalBaseline(),
            CombinedRetrievalBaseline()
        ]

        for cfg in configs:
            out = cfg.predict(tf, cands, "python")
            self.assertIn("prediction", out)
            self.assertIn("confidence", out)
            self.assertIn("scores", out)
            self.assertEqual(out["prediction"], "c0")

    def test_track2_pool_scaling(self):
        adapter = ReferenceBenchmarkAdapter()
        test_items = adapter.load(split_filter="test")[:5]
        repo_builder = Track2RepoWideBuilder()

        scaled_100 = repo_builder.build_scaled_track(test_items, pool_size=100)
        self.assertEqual(len(scaled_100), 5)
        for item in scaled_100:
            self.assertEqual(len(item.candidates), 100)
            cand_ids = [c.candidate_id for c in item.candidates]
            self.assertEqual(len(set(cand_ids)), 100, "Candidate IDs must be strictly unique!")

if __name__ == "__main__":
    unittest.main()
'''

target_file = Path("d:/base papers considered/laya testing/tests/evaluation/test_expanded_evaluation.py")
with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Created {target_file} successfully!")
