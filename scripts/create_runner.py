import os
import shutil

runner_content = '''"""
Benchmark Runner for Retrospect Deterministic Historical Retrieval Pipeline.
Evaluates Retrospect against the multi-language 168-instance held-out test split
and benchmarks it directly against all 9 existing baselines and Laya models.
"""
import os
import sys
import time
import json
import psutil
from pathlib import Path
import pandas as pd
import numpy as np

# Add repo root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.models.retrospect_pipeline import RetrospectPipeline
from src.metrics.evaluator import compute_metrics, slice_metrics

RESULTS_DIR = Path(__file__).resolve().parent / "results"
PRED_DIR = RESULTS_DIR / "predictions"
TABLES_DIR = RESULTS_DIR / "tables"
DATA_PATH = Path(__file__).resolve().parent / "data" / "benchmark.json"

def get_process_memory_mb() -> float:
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)

def run():
    print("=" * 70)
    print("EVALUATING RETROSPECT PIPELINE ON MULTI-LANGUAGE BENCHMARK ORACLE")
    print("=" * 70)

    # 1. Load benchmark dataset
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        benchmark = json.load(f)

    test_data = [item for item in benchmark if item.get("split") == "test"]
    print(f"Loaded held-out test split: {len(test_data)} instances across 4 languages\\n")

    # 2. Initialize Retrospect pipeline
    pipeline = RetrospectPipeline()

    mem_before = get_process_memory_mb()
    t0 = time.time()
    latencies = []
    preds_list = []

    for item in test_data:
        item_t0 = time.time()
        tf = item["target_function"]
        cands = item["candidates"]
        lang = item["language"]
        gt = item["ground_truth_id"]

        out = pipeline.predict(
            target_function=tf,
            candidates=cands,
            language=lang
        )

        item_lat_ms = (time.time() - item_t0) * 1000.0
        latencies.append(item_lat_ms)

        pred_choice = out.get("prediction", "NEW")
        conf = out.get("confidence", 0.0)
        scores = out.get("scores", {})

        pred_record = {
            "instance_id": item["instance_id"],
            "language": lang,
            "change_type": item["change_type"],
            "repository": item["repository"],
            "ground_truth_id": gt,
            "prediction": pred_choice,
            "is_correct": (pred_choice == gt),
            "confidence": conf,
            "scores": scores,
            "latency_ms": item_lat_ms
        }
        preds_list.append(pred_record)

    total_eval_time = time.time() - t0
    mem_after = get_process_memory_mb()
    peak_mem_mb = max(mem_before, mem_after)

    # 3. Compute Metrics
    model_name = "Retrospect_Deterministic_Pipeline"
    m = compute_metrics(preds_list)
    m["model"] = model_name

    eff = {
        "model": model_name,
        "total_time_sec": round(total_eval_time, 2),
        "throughput_items_per_sec": round(len(test_data) / max(0.001, total_eval_time), 2),
        "latency_mean_ms": round(float(np.mean(latencies)), 2),
        "latency_median_ms": round(float(np.median(latencies)), 2),
        "latency_p95_ms": round(float(np.percentile(latencies, 95)), 2),
        "memory_usage_mb": round(peak_mem_mb, 2)
    }

    # 4. Save Raw Predictions
    pred_file = PRED_DIR / f"{model_name}.jsonl"
    with open(pred_file, "w", encoding="utf-8") as f:
        for pr in preds_list:
            f.write(json.dumps(pr) + "\\n")
    print(f"Saved prediction records to: {pred_file}")

    # 5. Update Aggregate Metrics Table
    agg_file = TABLES_DIR / "aggregate_metrics.csv"
    if agg_file.exists():
        df_agg = pd.read_csv(agg_file)
        # Drop existing entry for this model if present
        df_agg = df_agg[df_agg["model"] != model_name]
        df_new_agg = pd.concat([df_agg, pd.DataFrame([m])], ignore_index=True)
        df_new_agg.to_csv(agg_file, index=False)
        with open(TABLES_DIR / "aggregate_metrics.json", "w", encoding="utf-8") as f:
            json.dump(df_new_agg.to_dict(orient="records"), f, indent=2)

    # 6. Update Efficiency Metrics Table
    eff_file = TABLES_DIR / "efficiency_metrics.csv"
    if eff_file.exists():
        df_eff = pd.read_csv(eff_file)
        df_eff = df_eff[df_eff["model"] != model_name]
        df_new_eff = pd.concat([df_eff, pd.DataFrame([eff])], ignore_index=True)
        df_new_eff.to_csv(eff_file, index=False)
        with open(TABLES_DIR / "efficiency_metrics.json", "w", encoding="utf-8") as f:
            json.dump(df_new_eff.to_dict(orient="records"), f, indent=2)

    # 7. Sliced Metrics by Language
    by_lang = slice_metrics(preds_list, "language")
    lang_file = TABLES_DIR / "per_language_metrics.csv"
    if lang_file.exists():
        df_lang = pd.read_csv(lang_file)
        df_lang = df_lang[df_lang["model"] != model_name]
        new_lang_rows = []
        for l, metrics in by_lang.items():
            new_lang_rows.append({"language": l, "model": model_name, **metrics})
        df_new_lang = pd.concat([df_lang, pd.DataFrame(new_lang_rows)], ignore_index=True)
        df_new_lang.to_csv(lang_file, index=False)

    # 8. Sliced Metrics by Change Type
    by_chg = slice_metrics(preds_list, "change_type")
    chg_file = TABLES_DIR / "per_change_type_metrics.csv"
    if chg_file.exists():
        df_chg = pd.read_csv(chg_file)
        df_chg = df_chg[df_chg["model"] != model_name]
        new_chg_rows = []
        for ct, metrics in by_chg.items():
            new_chg_rows.append({"change_type": ct, "model": model_name, **metrics})
        df_new_chg = pd.concat([df_chg, pd.DataFrame(new_chg_rows)], ignore_index=True)
        df_new_chg.to_csv(chg_file, index=False)

    # 9. Print Comprehensive Comparison
    print("\\n" + "=" * 105)
    print("                     OVERALL BENCHMARK COMPARISON TABLE (HELD-OUT TEST SET, N=168)                 ")
    print("=" * 105)
    cols_to_show = ["model", "top1_accuracy", "mrr", "macro_f1", "match_precision", "match_recall", "new_precision", "new_recall", "new_f1"]
    df_display = pd.read_csv(agg_file)[cols_to_show].copy()
    df_display["top1_accuracy"] = (df_display["top1_accuracy"] * 100).round(2).astype(str) + "%"
    print(df_display.to_string(index=False))

    print("\\n" + "=" * 90)
    print("                         EFFICIENCY & LATENCY COMPARISON TABLE                            ")
    print("=" * 90)
    df_eff_display = pd.read_csv(eff_file)
    print(df_eff_display.to_string(index=False))

    print("\\n--- Retrospect Performance by Language ---")
    df_l = pd.DataFrame([{"language": l, **metrics} for l, metrics in by_lang.items()])
    print(df_l[["language", "count", "top1_accuracy", "macro_f1", "match_f1", "new_f1"]].to_string(index=False))

    print("\\n--- Retrospect Performance by Change Type ---")
    df_c = pd.DataFrame([{"change_type": ct, **metrics} for ct, metrics in by_chg.items()])
    print(df_c[["change_type", "count", "top1_accuracy", "macro_f1", "match_f1", "new_f1"]].to_string(index=False))

    print("\\nEvaluation finished successfully.")

if __name__ == "__main__":
    run()
'''

target_runner = 'd:/base papers considered/laya testing/run_retrospect_evaluation.py'
with open(target_runner, 'w', encoding='utf-8') as f:
    f.write(runner_content)

print(f"Created {target_runner} successfully!")
