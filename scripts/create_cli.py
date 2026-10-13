from pathlib import Path

content = '''"""
Unified Evaluation CLI and Master Runner for Retrospect Historical Retrieval.
Supports Track 1 (Lineage), Track 2 (Repository-Wide Scaling), and Track 3 (Difficult Evolution).
Evaluates Config A (Lexical), Config B (Structural), Config C (Historical), and Config D (Combined).
"""
import os
import sys
import time
import json
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

# Ensure root is in path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from src.evaluation.schema import LineageInstance
from src.evaluation.adapters.dataset_adapters import (
    ReferenceBenchmarkAdapter,
    RefactoringMinerJavaAdapter,
    ManySStuBs4JAdapter,
    BigCloneBenchStressAdapter,
    SWEBenchStressAdapter
)
from src.evaluation.datasets.track_builder import (
    Track1LineageBuilder,
    Track2RepoWideBuilder,
    Track3StressSubsets
)
from src.evaluation.baselines.configurations import (
    ExactLexicalBaseline,
    StructuralBaseline,
    HistoricalBaseline,
    CombinedRetrievalBaseline
)
from src.models.retrospect_pipeline import RetrospectPipeline
from src.evaluation.metrics.unified_metrics import (
    compute_lineage_metrics,
    slice_metrics,
    bootstrap_relative_difference
)

RESULTS_DIR = ROOT_DIR / "results"
EXP_PRED_DIR = RESULTS_DIR / "expanded_predictions"
EXP_TABLES_DIR = RESULTS_DIR / "expanded_tables"
EXP_PRED_DIR.mkdir(parents=True, exist_ok=True)
EXP_TABLES_DIR.mkdir(parents=True, exist_ok=True)

def evaluate_model_on_dataset(model_name: str, model_obj: Any, dataset: List[LineageInstance]) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any]]:
    latencies = []
    preds = []
    t0 = time.time()

    for item in dataset:
        item_t0 = time.time()
        tf = item.target_function.to_dict()
        cands = [c.to_dict() for c in item.candidates]
        lang = item.language
        gt = item.ground_truth_id

        # Context for historical models
        ctx = {
            "commit_distance": item.commit_distance,
            "evolution_type": item.evolution_type
        }

        if hasattr(model_obj, "predict"):
            # Check parameter signatures
            try:
                out = model_obj.predict(target_function=tf, candidates=cands, language=lang, context=ctx)
            except TypeError:
                try:
                    out = model_obj.predict(target_function=tf, candidates=cands, language=lang)
                except TypeError:
                    out = model_obj.predict(tf, cands)
        else:
            raise ValueError(f"Unknown model object {model_name}")

        lat_ms = (time.time() - item_t0) * 1000.0
        latencies.append(lat_ms)

        pred_choice = out.get("prediction", "NEW")
        conf = float(out.get("confidence", 0.0))
        scores = out.get("scores", {})

        preds.append({
            "instance_id": item.instance_id,
            "dataset": item.dataset,
            "language": item.language,
            "evolution_type": item.evolution_type,
            "repository": item.repository,
            "ground_truth_id": gt,
            "prediction": pred_choice,
            "is_correct": (pred_choice == gt),
            "confidence": conf,
            "scores": scores,
            "candidate_pool_size": len(cands),
            "latency_ms": lat_ms
        })

    total_time = time.time() - t0
    metrics = compute_lineage_metrics(preds)
    metrics["model"] = model_name

    efficiency = {
        "model": model_name,
        "instance_count": len(dataset),
        "total_time_sec": round(total_time, 3),
        "throughput_items_per_sec": round(len(dataset) / max(0.0001, total_time), 2),
        "latency_mean_ms": round(float(np.mean(latencies)), 3),
        "latency_median_ms": round(float(np.median(latencies)), 3),
        "latency_p95_ms": round(float(np.percentile(latencies, 95)), 3)
    }

    return preds, metrics, efficiency

def run_track1_evaluation():
    print("\\n" + "=" * 80)
    print("                     TRACK 1: STANDARD LINEAGE RETRIEVAL                   ")
    print("=" * 80)

    builder = Track1LineageBuilder()
    test_dataset = builder.build_dataset(split="test", include_external=True)

    models = {
        "Config_A_Lexical": ExactLexicalBaseline(),
        "Config_B_Structural": StructuralBaseline(),
        "Config_C_Historical": HistoricalBaseline(),
        "Config_D_Combined": CombinedRetrievalBaseline(),
        "Retrospect_Deterministic": RetrospectPipeline()
    }

    track1_results = []
    track1_eff = []

    for name, model in models.items():
        print(f"Running Track 1 on {name} (N={len(test_dataset)})...")
        preds, m, eff = evaluate_model_on_dataset(name, model, test_dataset)
        track1_results.append(m)
        track1_eff.append(eff)

        # Save predictions
        pred_path = EXP_PRED_DIR / f"Track1_{name}.jsonl"
        with open(pred_path, "w", encoding="utf-8") as f:
            for p in preds:
                f.write(json.dumps(p) + "\\n")

    df_t1 = pd.DataFrame(track1_results)
    df_t1.to_csv(EXP_TABLES_DIR / "track1_lineage_metrics.csv", index=False)
    with open(EXP_TABLES_DIR / "track1_lineage_metrics.json", "w", encoding="utf-8") as f:
        json.dump(track1_results, f, indent=2)

    df_eff1 = pd.DataFrame(track1_eff)
    df_eff1.to_csv(EXP_TABLES_DIR / "track1_efficiency_metrics.csv", index=False)

    print("\\n--- Track 1 Summary Results Table ---")
    cols = ["model", "count", "top1_accuracy", "mrr", "macro_f1", "match_precision", "match_recall", "new_precision", "new_recall"]
    print(df_t1[cols].to_string(index=False))

    return test_dataset, track1_results

def run_track2_evaluation(base_dataset: List[LineageInstance]):
    print("\\n" + "=" * 80)
    print("              TRACK 2: REPOSITORY-WIDE CANDIDATE POOL SCALING             ")
    print("=" * 80)

    repo_builder = Track2RepoWideBuilder()
    models = {
        "Config_A_Lexical": ExactLexicalBaseline(),
        "Config_B_Structural": StructuralBaseline(),
        "Config_C_Historical": HistoricalBaseline(),
        "Config_D_Combined": CombinedRetrievalBaseline()
    }

    pool_sizes = [4, 100, 1000]
    scaling_results = []

    for k in pool_sizes:
        print(f"\\n--- Evaluating Candidate Pool Scaling k={k} ---")
        scaled_ds = repo_builder.build_scaled_track(base_dataset, pool_size=k)

        for name, model in models.items():
            print(f"  Evaluating {name} with k={k} candidates...")
            preds, m, eff = evaluate_model_on_dataset(name, model, scaled_ds)
            scaling_results.append({
                "pool_size": k,
                **m,
                "latency_mean_ms": eff["latency_mean_ms"]
            })

    df_t2 = pd.DataFrame(scaling_results)
    df_t2.to_csv(EXP_TABLES_DIR / "track2_scaling_metrics.csv", index=False)
    with open(EXP_TABLES_DIR / "track2_scaling_metrics.json", "w", encoding="utf-8") as f:
        json.dump(scaling_results, f, indent=2)

    print("\\n--- Track 2 Scaling Summary Table ---")
    cols = ["pool_size", "model", "top1_accuracy", "mrr", "recall_at_5", "candidate_coverage", "latency_mean_ms"]
    print(df_t2[cols].to_string(index=False))

    return scaling_results

def run_track3_evaluation(dataset: List[LineageInstance]):
    print("\\n" + "=" * 80)
    print("           TRACK 3: DIFFICULT EVOLUTION & STRESS TEST SUBSETS              ")
    print("=" * 80)

    subsets = Track3StressSubsets.partition_subsets(dataset)
    models = {
        "Config_A_Lexical": ExactLexicalBaseline(),
        "Config_B_Structural": StructuralBaseline(),
        "Config_C_Historical": HistoricalBaseline(),
        "Config_D_Combined": CombinedRetrievalBaseline()
    }

    subset_results = []
    print(f"Partitioned into {len(subsets)} stress subsets:")
    for sname, sitems in subsets.items():
        print(f"  - {sname}: {len(sitems)} instances")

    for sname, sitems in subsets.items():
        if not sitems:
            continue
        for mname, model in models.items():
            preds, m, eff = evaluate_model_on_dataset(mname, model, sitems)
            subset_results.append({
                "subset": sname,
                "subset_count": len(sitems),
                **m
            })

    df_t3 = pd.DataFrame(subset_results)
    df_t3.to_csv(EXP_TABLES_DIR / "track3_difficult_evolution_metrics.csv", index=False)
    with open(EXP_TABLES_DIR / "track3_difficult_evolution_metrics.json", "w", encoding="utf-8") as f:
        json.dump(subset_results, f, indent=2)

    print("\\n--- Track 3 Difficult Evolution Summary Table ---")
    cols = ["subset", "subset_count", "model", "top1_accuracy", "mrr", "macro_f1"]
    print(df_t3[cols].to_string(index=False))

    return subset_results

def run_all_tracks():
    start_time = time.time()
    t1_dataset, t1_results = run_track1_evaluation()
    t2_results = run_track2_evaluation(t1_dataset[:50]) # Evaluate scaling on representative sample
    t3_results = run_track3_evaluation(t1_dataset)

    # Statistical significance: Config D vs Config A & Config B
    print("\\n" + "=" * 80)
    print("             STATISTICAL SIGNIFICANCE (PAIRED BOOTSTRAP CI, N=1000)        ")
    print("=" * 80)

    with open(EXP_PRED_DIR / "Track1_Config_A_Lexical.jsonl", "r", encoding="utf-8") as f:
        preds_a = [json.loads(line) for line in f]
    with open(EXP_PRED_DIR / "Track1_Config_B_Structural.jsonl", "r", encoding="utf-8") as f:
        preds_b = [json.loads(line) for line in f]
    with open(EXP_PRED_DIR / "Track1_Config_D_Combined.jsonl", "r", encoding="utf-8") as f:
        preds_d = [json.loads(line) for line in f]

    diff_d_vs_a = bootstrap_relative_difference(preds_a, preds_d)
    diff_d_vs_b = bootstrap_relative_difference(preds_b, preds_d)

    print(f"Config D (Combined) vs Config A (Lexical):")
    print(f"  Observed Delta Top-1: {diff_d_vs_a['observed_delta']:+.4f} (95% CI: [{diff_d_vs_a['ci_lower']:+.4f}, {diff_d_vs_a['ci_upper']:+.4f}], p={diff_d_vs_a['p_value']})")
    print(f"Config D (Combined) vs Config B (Structural):")
    print(f"  Observed Delta Top-1: {diff_d_vs_b['observed_delta']:+.4f} (95% CI: [{diff_d_vs_b['ci_lower']:+.4f}, {diff_d_vs_b['ci_upper']:+.4f}], p={diff_d_vs_b['p_value']})")

    total_elapsed = time.time() - start_time
    print(f"\\nAll evaluation tracks completed in {total_elapsed:.2f} seconds.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Retrospect Expanded Evaluation Suite CLI")
    parser.add_argument("--track", choices=["track1", "track2", "track3", "all"], default="all")
    args = parser.parse_args()

    if args.track == "all":
        run_all_tracks()
    elif args.track == "track1":
        run_track1_evaluation()
    elif args.track == "track2":
        ref = ReferenceBenchmarkAdapter().load(split_filter="test")
        run_track2_evaluation(ref[:50])
    elif args.track == "track3":
        ref = ReferenceBenchmarkAdapter().load(split_filter="test")
        run_track3_evaluation(ref)
'''

target_file = Path("d:/base papers considered/laya testing/src/evaluation/runner/evaluation_cli.py")
with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Created {target_file} successfully!")
