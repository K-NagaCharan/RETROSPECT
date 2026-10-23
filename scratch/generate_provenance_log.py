import json
import os

PROVENANCE_PATH = r"D:\base papers considered\Test creation\datasets\retrospect_historical_rescue_v1\provenance\pilot_provenance_log.jsonl"
os.makedirs(os.path.dirname(PROVENANCE_PATH), exist_ok=True)

RESULTS_PATH = r"D:\base papers considered\Test creation\experiments\final_multirepo_evaluation_merge_aware_2026-10-20\results.json"
with open(RESULTS_PATH, "r", encoding="utf-8") as f:
    eval_data = json.load(f)

per_case_map = {c["case_id"]: c for c in eval_data["per_case_results"]}

pilot_sources = [
    ("RETRO-A-0001", "CASE-HIST-JAVA-0105", "function_rename"),
    ("RETRO-A-0002", "CASE-HIST-JAVA-0020", "function_rename"),
    ("RETRO-A-0003", "CASE-HIST-PY-001", "function_rename"),
    ("RETRO-B-0001", "CASE-HIST-JAVA-0049", "function_extraction"),
    ("RETRO-B-0002", "CASE-HIST-PY-003", "function_extraction"),
    ("RETRO-C-0001", "CASE-HIST-TS-003", "function_movement"),
    ("RETRO-D-0001", "CASE-HIST-JS-003", "function_split_merge"),
    ("RETRO-E-0001", "CASE-HIST-JS-001", "substantial_rewrite"),
    ("RETRO-F-0001", "CASE-HIST-TS-001", "historical_terminology"),
    ("RETRO-G-0001", "CASE-STRUCT-PY-002", "current_code_control"),
    ("RETRO-G-0002", "CASE-STRUCT-TS-004", "current_code_control"),
    ("RETRO-G-0003", "CASE-STRUCT-JAVA-001", "current_code_control"),
    ("RETRO-H-0001", "CASE-HIST-JAVA-0048", "hard_negative"),
    ("RETRO-I-0001", "CASE-HIST-JAVA-0047", "history_depth")
]

with open(PROVENANCE_PATH, "w", encoding="utf-8") as f:
    for pid, sid, cat in pilot_sources:
        src = per_case_map[sid]
        entry = {
            "pilot_id": pid,
            "source_case_id": sid,
            "category": cat,
            "repository": src["repository_id"],
            "language": src["language"],
            "evaluation_commit": src["pin_sha"],
            "origin_commit": src.get("origin_commit"),
            "commit_distance_k": src.get("commit_distance_k"),
            "baseline_ranks": {
                "B1_lexical": src.get("baseline1_bm25_lexical_rank"),
                "B2_vector": src.get("baseline2_semantic_vector_rank"),
                "B3_structural": src.get("baseline3_structural_dep_rank"),
                "B4_retrospect": src.get("baseline4_retrospect_fused_rank")
            },
            "historical_stage_a": src.get("stage_a_historical_reachability"),
            "historical_stage_b": src.get("stage_b_function_matcher_status"),
            "creation_date": "2026-10-20",
            "curator": "Antigravity Research Pipeline",
            "blinding_protocol": "Queries authored and frozen prior to running Retrospect rescue validation"
        }
        f.write(json.dumps(entry) + "\n")

print(f"Provenance log written to {PROVENANCE_PATH}")
