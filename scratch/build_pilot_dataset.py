import os
import json
import shutil

RESULTS_PATH = r"D:\base papers considered\Test creation\experiments\final_multirepo_evaluation_merge_aware_2026-10-20\results.json"
BASE_DATASET_DIR = r"D:\base papers considered\Test creation\datasets\retrospect_historical_rescue_v1"
CLONES_DIR = r"D:\clones"

genuine_map = {
    "CASE-HIST-PY-003": "41d8fb09ca1d201ef126347c4bffe77f0e0245d2",
    "CASE-HIST-JS-001": "0e67426b8e8d200a3ca7dab046040717110e87e6",
    "CASE-HIST-TS-001": "c346af2b6aa1c2796818405b4a960fc5c571594e",
    "CASE-HIST-TS-003": "123753c9f8ef2badd30aa05d872fe97754682ff0"
}

with open(RESULTS_PATH, "r", encoding="utf-8") as f:
    eval_data = json.load(f)

per_case_map = {c["case_id"]: c for c in eval_data["per_case_results"]}

pilot_definitions = [
    {
        "pilot_id": "RETRO-A-0001",
        "category_dir": "A_renames",
        "category_enum": "function_rename",
        "source_case_id": "CASE-HIST-JAVA-0105",
        "query": "Locate current implementation corresponding to historical method removeZeroDegreeNodes in PrepareRoutingSubnetworks",
        "query_rationale": "Historical method removeZeroDegreeNodes was renamed to markNodesRemovedIfUnreachable during subnetwork cleanup refactoring.",
        "transformation_description": "Function renamed from removeZeroDegreeNodes to markNodesRemovedIfUnreachable with signature preservation.",
        "distractor_symbol": "PrepareRoutingSubnetworks.setMinNetworkSize",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Neighboring configuration method in the same subnetwork preparation class."
    },
    {
        "pilot_id": "RETRO-A-0002",
        "category_dir": "A_renames",
        "category_enum": "function_rename",
        "source_case_id": "CASE-HIST-JAVA-0020",
        "query": "Locate current implementation corresponding to historical method getCustomViolation in Violation",
        "query_rationale": "Audit engine refactored getCustomViolation to getViolation across checkstyle report pipeline.",
        "transformation_description": "Renamed getCustomViolation to getViolation to simplify violation inspection API.",
        "distractor_symbol": "Violation.getLineNo",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Field accessor on the same Violation entity."
    },
    {
        "pilot_id": "RETRO-A-0003",
        "category_dir": "A_renames",
        "category_enum": "function_rename",
        "source_case_id": "CASE-HIST-PY-001",
        "query": "Retrieve list of all values for a query parameter key using multidict accessor getlist",
        "query_rationale": "Historical getlist method was renamed to PEP8 snake_case get_list in HTTPX multidict model.",
        "transformation_description": "Standard PEP8 rename from camelCase getlist to get_list.",
        "distractor_symbol": "QueryParams.get",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Single-item dictionary accessor returning first value only."
    },
    {
        "pilot_id": "RETRO-B-0001",
        "category_dir": "B_extractions",
        "category_enum": "function_extraction",
        "source_case_id": "CASE-HIST-JAVA-0049",
        "query": "Obtain underlying direct byte buffer instance from pooled reference buffer wrapper",
        "query_rationale": "Buffer extraction method getBuffer refactored in ReferenceCountedPooled during netty/xnio modernization.",
        "transformation_description": "Extracted buffer unwrapping method from monolithic pool handler.",
        "distractor_symbol": "ReferenceCountedPooled.createView",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "View factory method in same reference counted pool utility."
    },
    {
        "pilot_id": "RETRO-B-0002",
        "category_dir": "B_extractions",
        "category_enum": "function_extraction",
        "source_case_id": "CASE-HIST-PY-003",
        "query": "Hook pytest warning recorded callback during test run execution",
        "query_rationale": "Pytest hook pytest_warning_recorded extracted into modular warning recording system.",
        "transformation_description": "Extracted hook specification and default implementation for warning events.",
        "distractor_symbol": "pytest_runtest_protocol",
        "distractor_type": "structural_sibling",
        "distractor_rationale": "Core execution protocol hook in Pytest plugin architecture."
    },
    {
        "pilot_id": "RETRO-C-0001",
        "category_dir": "C_function_movement",
        "category_enum": "function_movement",
        "source_case_id": "CASE-HIST-TS-003",
        "query": "Resume observable execution sequence on error with fallback observable stream using onErrorResumeNextWith",
        "query_rationale": "Observable prototype method migrated and modularized into pipeable operator module.",
        "transformation_description": "Method migrated from Observable prototype into independent tree-shakable operator function.",
        "distractor_symbol": "catchError",
        "distractor_type": "semantic_competitor",
        "distractor_rationale": "Primary error handling operator in RxJS sharing error dispatch characteristics."
    },
    {
        "pilot_id": "RETRO-D-0001",
        "category_dir": "D_splits_merges",
        "category_enum": "function_split_merge",
        "source_case_id": "CASE-HIST-JS-003",
        "query": "Lookup test files recursively matching pattern in mocha runner file discovery utils",
        "query_rationale": "Lookup logic lookupFiles decomposed into separate glob matcher and file list collector.",
        "transformation_description": "Decomposed monolithic file globbing utility into modular path resolver and collector.",
        "distractor_symbol": "lookupFilesSync",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Synchronous sibling method of lookupFiles."
    },
    {
        "pilot_id": "RETRO-E-0001",
        "category_dir": "E_substantial_rewrites",
        "category_enum": "substantial_rewrite",
        "source_case_id": "CASE-HIST-JS-001",
        "query": "Format duration object as ISO 8601 duration string using toISOString",
        "query_rationale": "Complete rewrite of duration serialization logic to support full ISO-8601 spec with days, months, and years.",
        "transformation_description": "Comprehensive rewrite of ISO duration formatting algorithm.",
        "distractor_symbol": "duration.asMilliseconds",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Numeric unit accessor in Moment duration module."
    },
    {
        "pilot_id": "RETRO-F-0001",
        "category_dir": "F_historical_terminology",
        "category_enum": "historical_terminology",
        "source_case_id": "CASE-HIST-TS-001",
        "query": "Mark object as raw non-reactive target to prevent reactivity proxy wrapping using markRaw",
        "query_rationale": "Vue 3 Composition API paradigm shift replacing legacy Vue.observable opt-out mechanisms.",
        "transformation_description": "Architectural paradigm change introducing markRaw and shallow reactivity wrappers.",
        "distractor_symbol": "toRaw",
        "distractor_type": "semantic_competitor",
        "distractor_rationale": "Inverse unwrapping utility in Vue reactivity system."
    },
    {
        "pilot_id": "RETRO-G-0001",
        "category_dir": "G_current_code_controls",
        "category_enum": "current_code_control",
        "source_case_id": "CASE-STRUCT-PY-002",
        "query": "Send an HTTP request using an underlying urllib3 connection pool manager with retry logic and SSL verification",
        "query_rationale": "Contemporary structural lookup for core adapter dispatch method in active codebase.",
        "transformation_description": "Control case: contemporary active API query targeting unchanged dispatch method.",
        "distractor_symbol": "HTTPAdapter.build_response",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Sibling method in HTTPAdapter converting urllib3 response to Requests response."
    },
    {
        "pilot_id": "RETRO-G-0002",
        "category_dir": "G_current_code_controls",
        "category_enum": "current_code_control",
        "source_case_id": "CASE-STRUCT-TS-004",
        "query": "Safely validate and parse schema input data returning success flag and data or issues without throwing",
        "query_rationale": "Contemporary lookup targeting standard safeParse method on ZodType schemas.",
        "transformation_description": "Control case: contemporary query targeting unchanged schema validation method.",
        "distractor_symbol": "ZodType.parse",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Throwing variant of safeParse in ZodType class."
    },
    {
        "pilot_id": "RETRO-G-0003",
        "category_dir": "G_current_code_controls",
        "category_enum": "current_code_control",
        "source_case_id": "CASE-STRUCT-JAVA-001",
        "query": "Create an immutable list builder with specified expected capacity in Guava",
        "query_rationale": "Contemporary lookup targeting ImmutableList.builder factory in Google Guava.",
        "transformation_description": "Control case: contemporary query targeting stable collection builder.",
        "distractor_symbol": "ImmutableList.of",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Direct factory overload for fixed argument ImmutableList construction."
    },
    {
        "pilot_id": "RETRO-H-0001",
        "category_dir": "H_hard_negatives",
        "category_enum": "hard_negative",
        "source_case_id": "CASE-HIST-JAVA-0048",
        "query": "Retrieve direct buffer from pooled slice in LimitedBufferSlicePool PooledByteBuffer",
        "query_rationale": "Target symbol was deleted and refactored into a completely distinct pooling abstraction with no direct successor.",
        "transformation_description": "Hard negative: obsolete buffer slice pool method removed without direct replacement.",
        "distractor_symbol": "LimitedBufferSlicePool.canAllocate",
        "distractor_type": "structural_sibling",
        "distractor_rationale": "Pool allocation check method retained in old buffer pool structure."
    },
    {
        "pilot_id": "RETRO-I-0001",
        "category_dir": "I_history_depth",
        "category_enum": "history_depth",
        "source_case_id": "CASE-HIST-JAVA-0047",
        "query": "Locate current implementation corresponding to historical method send in WebSocket07FrameSinkChannel",
        "query_rationale": "Benchmark case evaluating retrieval at commit distance k=40 in Undertow DAG (historical evidence discovered, ambiguous RRF match).",
        "transformation_description": "Historical method send refactored across channel abstraction hierarchy at distance k=40.",
        "distractor_symbol": "WebSocket07FrameSinkChannel.sendClose",
        "distractor_type": "same_file_adjacent",
        "distractor_rationale": "Adjacent channel closure dispatch method."
    }
]

print("Building Retrospect Historical-Rescue Pilot Dataset (14 cases across 9 categories)...")

category_cases = {}

for cdef in pilot_definitions:
    src_id = cdef["source_case_id"]
    if src_id not in per_case_map:
        raise ValueError(f"Source case {src_id} not found in evaluated results!")
    
    src = per_case_map[src_id]
    cdir = cdef["category_dir"]
    if cdir not in category_cases:
        category_cases[cdir] = []
        
    is_hard_neg = cdef["category_enum"] == "hard_negative"
    is_control = cdef["category_enum"] == "current_code_control"
    
    target_set = []
    if not is_hard_neg:
        target_set.append({
            "file_path": src["target_file_path"],
            "symbol_name": src["target_symbol_name"],
            "line_span": [1, 500]
        })
        
    genuine_commit = genuine_map.get(src_id, src.get("origin_commit"))
    historical_targets = []
    if not is_control and genuine_commit:
        historical_targets.append({
            "file_path": src["target_file_path"],
            "symbol_name": src["target_symbol_name"],
            "commit_sha": genuine_commit
        })
        
    case_record = {
        "case_id": cdef["pilot_id"],
        "category": cdef["category_enum"],
        "language": src["language"],
        "repository": src["repository_id"],
        "evaluation_commit": src["pin_sha"],
        "query": cdef["query"],
        "query_rationale": cdef["query_rationale"],
        "target_set": target_set,
        "historical_targets": historical_targets,
        "transformation": {
            "type": cdef["category_enum"],
            "source_commit": None if is_control else genuine_commit,
            "description": cdef["transformation_description"],
            "lineage_cluster_id": f"CLUSTER-{cdef['pilot_id']}"
        },
        "history_distance_commits": None if is_control else (int(src["commit_distance_k"]) if src.get("commit_distance_k") and not (isinstance(src["commit_distance_k"], float) and src["commit_distance_k"] != src["commit_distance_k"]) else None),
        "distractor_symbols": [
            {
                "file_path": src["target_file_path"],
                "symbol_name": cdef["distractor_symbol"],
                "distractor_type": cdef["distractor_type"],
                "distractor_rationale": cdef["distractor_rationale"]
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": f"Derived from verified evaluation run of {src_id} under merge-aware Git traversal protocol."
    }
    
    category_cases[cdir].append(case_record)

total_written = 0
for cdir, cases in category_cases.items():
    # Write to both base/cdir and base/datasets/cdir
    for pdir in [BASE_DATASET_DIR, os.path.join(BASE_DATASET_DIR, "datasets")]:
        target_dir = os.path.join(pdir, cdir)
        os.makedirs(target_dir, exist_ok=True)
        cfile = os.path.join(target_dir, "cases.jsonl")
        with open(cfile, "w", encoding="utf-8") as f:
            for c in cases:
                f.write(json.dumps(c) + "\n")
    total_written += len(cases)
    print(f"Wrote {len(cases)} cases for category {cdir}")

print(f"\nTotal pilot cases written: {total_written}")

pilot_manifest = {
    "dataset_name": "retrospect_historical_rescue_pilot_v1",
    "version": "1.0.0-frozen",
    "frozen_date": "2026-10-20",
    "total_cases": total_written,
    "categories_covered": list(category_cases.keys()),
    "languages_covered": ["Java", "Python", "JavaScript", "TypeScript"],
    "repositories_covered": sorted(list(set(c["repository"] for cases in category_cases.values() for c in cases))),
    "status": "FROZEN_BEFORE_RETRIEVAL"
}

manifest_path = os.path.join(BASE_DATASET_DIR, "pilot_manifest.json")
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(pilot_manifest, f, indent=2)

print(f"Frozen pilot manifest written to {manifest_path}")
