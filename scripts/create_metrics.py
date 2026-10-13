from pathlib import Path

content = '''"""
Unified Metrics Engine for Retrospect Historical Retrieval Pipeline.
Computes Lineage Metrics, NEW Detection Metrics, Calibration, and Bootstrap Confidence Intervals.
"""
import numpy as np
from typing import List, Dict, Any, Tuple, Optional

def compute_lineage_metrics(predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not predictions:
        return {}

    n = len(predictions)
    correct_top1 = 0
    correct_top5 = 0
    correct_top10 = 0
    rr_total = 0.0

    # Coverage: was ground truth in candidates when gt != NEW?
    gt_match_items = [p for p in predictions if p["ground_truth_id"] != "NEW"]
    covered_items = 0

    # For NEW classification
    tp_new = 0
    fp_new = 0
    fn_new = 0
    tn_new = 0

    # For MATCH classification
    tp_match = 0
    fp_match = 0
    fn_match = 0
    tn_match = 0

    confidences = []
    accuracies = []

    for item in predictions:
        gt = item["ground_truth_id"]
        pred = item["prediction"]
        scores = item.get("scores", {})
        conf = float(item.get("confidence", 0.0))

        is_correct = (pred == gt)
        if is_correct:
            correct_top1 += 1
        accuracies.append(1.0 if is_correct else 0.0)
        confidences.append(conf)

        # Ranked list of candidate IDs
        sorted_cands = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)

        if gt == "NEW":
            rr = 1.0 if pred == "NEW" else 0.0
            if pred == "NEW":
                correct_top5 += 1
                correct_top10 += 1
        else:
            if gt in sorted_cands:
                covered_items += 1
                rank = sorted_cands.index(gt) + 1
                rr = 1.0 / rank
                if rank <= 5:
                    correct_top5 += 1
                if rank <= 10:
                    correct_top10 += 1
            else:
                rr = 0.0
        rr_total += rr

        # NEW metrics
        if gt == "NEW":
            if pred == "NEW":
                tp_new += 1
            else:
                fn_new += 1
        else:
            if pred == "NEW":
                fp_new += 1
            else:
                tn_new += 1

        # MATCH metrics
        if gt != "NEW":
            if pred == gt:
                tp_match += 1
            else:
                fn_match += 1
        else:
            if pred != "NEW":
                fp_match += 1
            else:
                tn_match += 1

    top1_acc = correct_top1 / n
    top5_acc = correct_top5 / n
    top10_acc = correct_top10 / n
    mrr = rr_total / n

    coverage = (covered_items / len(gt_match_items)) if gt_match_items else 1.0

    # Precision, recall, F1 for NEW
    prec_new = tp_new / (tp_new + fp_new) if (tp_new + fp_new) > 0 else 0.0
    rec_new = tp_new / (tp_new + fn_new) if (tp_new + fn_new) > 0 else 0.0
    f1_new = 2 * prec_new * rec_new / (prec_new + rec_new) if (prec_new + rec_new) > 0 else 0.0
    fpr_new = fp_new / (fp_new + tn_new) if (fp_new + tn_new) > 0 else 0.0

    # Precision, recall, F1 for Match
    prec_match = tp_match / (tp_match + fp_match) if (tp_match + fp_match) > 0 else 0.0
    rec_match = tp_match / (tp_match + fn_match) if (tp_match + fn_match) > 0 else 0.0
    f1_match = 2 * prec_match * rec_match / (prec_match + rec_match) if (prec_match + rec_match) > 0 else 0.0

    # Macro F1
    macro_f1 = (f1_match + f1_new) / 2.0

    # Calibration: Brier Score and ECE
    brier_score = float(np.mean([(c - a) ** 2 for c, a in zip(confidences, accuracies)]))

    bins = np.linspace(0.0, 1.0, 11)
    ece = 0.0
    for b_idx in range(len(bins) - 1):
        low, high = bins[b_idx], bins[b_idx + 1]
        mask = [low <= c < high or (b_idx == len(bins) - 2 and low <= c <= high) for c in confidences]
        bin_count = sum(mask)
        if bin_count > 0:
            bin_acc = np.mean([accuracies[i] for i, m in enumerate(mask) if m])
            bin_conf = np.mean([confidences[i] for i, m in enumerate(mask) if m])
            ece += (bin_count / n) * abs(bin_acc - bin_conf)

    return {
        "count": n,
        "top1_accuracy": round(top1_acc, 4),
        "recall_at_1": round(top1_acc, 4),
        "recall_at_5": round(top5_acc, 4),
        "recall_at_10": round(top10_acc, 4),
        "mrr": round(mrr, 4),
        "candidate_coverage": round(coverage, 4),
        "macro_f1": round(macro_f1, 4),
        "match_precision": round(prec_match, 4),
        "match_recall": round(rec_match, 4),
        "match_f1": round(f1_match, 4),
        "new_precision": round(prec_new, 4),
        "new_recall": round(rec_new, 4),
        "new_f1": round(f1_new, 4),
        "new_fpr": round(fpr_new, 4),
        "brier_score": round(brier_score, 4),
        "ece": round(ece, 4),
        "confusion_matrix": {
            "tp_match": tp_match, "fp_match": fp_match, "fn_match": fn_match, "tn_match": tn_match,
            "tp_new": tp_new, "fp_new": fp_new, "fn_new": fn_new, "tn_new": tn_new
        }
    }

def slice_metrics(predictions: List[Dict[str, Any]], key: str) -> Dict[str, Dict[str, Any]]:
    groups = {}
    for p in predictions:
        val = str(p.get(key, "unknown"))
        groups.setdefault(val, []).append(p)

    results = {}
    for k, items in groups.items():
        results[k] = compute_lineage_metrics(items)
    return results

def bootstrap_relative_difference(
    preds_baseline: List[Dict[str, Any]],
    preds_target: List[Dict[str, Any]],
    num_bootstraps: int = 1000,
    alpha: float = 0.05,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Computes paired bootstrap confidence interval for difference in Top-1 Accuracy:
    Delta = target - baseline
    """
    assert len(preds_baseline) == len(preds_target), "Predictions list length mismatch"
    n = len(preds_baseline)
    rng = np.random.RandomState(seed)

    base_correct = np.array([1.0 if p["prediction"] == p["ground_truth_id"] else 0.0 for p in preds_baseline])
    target_correct = np.array([1.0 if p["prediction"] == p["ground_truth_id"] else 0.0 for p in preds_target])

    deltas = []
    for _ in range(num_bootstraps):
        indices = rng.choice(n, size=n, replace=True)
        delta = np.mean(target_correct[indices]) - np.mean(base_correct[indices])
        deltas.append(delta)

    deltas = np.sort(deltas)
    low_idx = int((alpha / 2.0) * num_bootstraps)
    high_idx = int((1.0 - alpha / 2.0) * num_bootstraps)

    observed_delta = float(np.mean(target_correct) - np.mean(base_correct))

    return {
        "observed_delta": round(observed_delta, 4),
        "ci_lower": round(float(deltas[low_idx]), 4),
        "ci_upper": round(float(deltas[high_idx]), 4),
        "p_value": round(float(np.mean(deltas <= 0.0 if observed_delta > 0 else deltas >= 0.0)), 4)
    }
'''

target_file = Path("d:/base papers considered/laya testing/src/evaluation/metrics/unified_metrics.py")
with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Created {target_file} successfully!")
