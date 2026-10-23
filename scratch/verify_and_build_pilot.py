import os
import subprocess
import json

CLONES_DIR = r"D:\clones"

def resolve_repo_path(repo_slug):
    short_name = repo_slug.split("/")[-1]
    p1 = os.path.join(CLONES_DIR, short_name)
    if os.path.exists(p1): return p1
    p2 = os.path.join(CLONES_DIR, repo_slug.replace("/", "-"))
    if os.path.exists(p2): return p2
    return None

def verify_git_object(repo_path, obj_ref):
    try:
        subprocess.run(["git", "cat-file", "-e", obj_ref], cwd=repo_path, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError:
        return False

# Candidate pilot cases to check
candidate_pilots = [
    {
        "case_id": "RETRO-A-0001",
        "category": "function_rename",
        "language": "JavaScript",
        "repository": "ReactiveX/rxjs",
        "evaluation_commit": "a8e8b61c565888b577317730e7bd5d8869b35b62",
        "query": "Migrate custom let operator transformation to pipeable operator pipeline composition",
        "query_rationale": "Developer seeking successor function for deprecated let method used to chain observable operations.",
        "target_set": [
            {
                "file_path": "src/internal/Observable.ts",
                "symbol_name": "Observable.pipe",
                "line_span": [290, 315]
            }
        ],
        "historical_targets": [
            {
                "file_path": "src/internal/Observable.ts",
                "symbol_name": "Observable.let",
                "commit_sha": "6d4df9275cb115cf43c08fe717c372691fa6d0f6"
            }
        ],
        "transformation": {
            "type": "function_rename",
            "source_commit": "6d4df9275cb115cf43c08fe717c372691fa6d0f6",
            "description": "Observable let operator deprecated and replaced by pipe for tree-shakable composition",
            "lineage_cluster_id": "RXJS-PIPE-LET-01"
        },
        "history_distance_commits": 18,
        "distractor_symbols": [
            {
                "file_path": "src/internal/Observable.ts",
                "symbol_name": "Observable.lift",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Internal operator plumbing method on Observable class."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Clear pipe/let architectural migration in RxJS v6."
    },
    {
        "case_id": "RETRO-A-0002",
        "category": "function_rename",
        "language": "Python",
        "repository": "encode/httpx",
        "evaluation_commit": "26d48e0634e6ee9cdc0533996db289ce4b430177",
        "query": "Retrieve list of all values for a query parameter key using multidict accessor getlist",
        "query_rationale": "Developer porting legacy code using old getlist naming to modern get_list.",
        "target_set": [
            {
                "file_path": "httpx/_models.py",
                "symbol_name": "QueryParams.get_list",
                "line_span": [252, 272]
            }
        ],
        "historical_targets": [
            {
                "file_path": "httpx/_models.py",
                "symbol_name": "QueryParams.getlist",
                "commit_sha": "2ba9c1ed90960007056b80bd60f1e606b41ad124"
            }
        ],
        "transformation": {
            "type": "function_rename",
            "source_commit": "2ba9c1ed90960007056b80bd60f1e606b41ad124",
            "description": "Renamed getlist to get_list across multidict implementations for PEP8 style",
            "lineage_cluster_id": "HTTPX-GETLIST-RENAME-01"
        },
        "history_distance_commits": 14,
        "distractor_symbols": [
            {
                "file_path": "httpx/_models.py",
                "symbol_name": "QueryParams.get",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Single-item dictionary accessor returning first value only."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "High-confidence PEP8 rename across models."
    },
    {
        "case_id": "RETRO-A-0003",
        "category": "function_rename",
        "language": "Java",
        "repository": "checkstyle/checkstyle",
        "evaluation_commit": "89a51ba032ff4ff0434f3c31535038e864680f97",
        "query": "Process multiple files in checker audit run using processFiles",
        "query_rationale": "User searching for file processing loop in Checker class formerly named process.",
        "target_set": [
            {
                "file_path": "src/main/java/com/puppycrawl/tools/checkstyle/Checker.java",
                "symbol_name": "Checker.processFiles",
                "line_span": [250, 310]
            }
        ],
        "historical_targets": [
            {
                "file_path": "src/main/java/com/puppycrawl/tools/checkstyle/Checker.java",
                "symbol_name": "Checker.process",
                "commit_sha": "9472eec305ff4c3b6d05f0393bf7c32e882583da"
            }
        ],
        "transformation": {
            "type": "function_rename",
            "source_commit": "9472eec305ff4c3b6d05f0393bf7c32e882583da",
            "description": "Renamed process(List<File>) to processFiles to disambiguate single-file vs batch processing",
            "lineage_cluster_id": "CHECKSTYLE-PROCESS-FILES-01"
        },
        "history_distance_commits": 11,
        "distractor_symbols": [
            {
                "file_path": "src/main/java/com/puppycrawl/tools/checkstyle/Checker.java",
                "symbol_name": "Checker.process",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Single file processing method retained in Checker."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Verified Checkstyle batch processing rename."
    },
    {
        "case_id": "RETRO-B-0001",
        "category": "function_extraction",
        "language": "Python",
        "repository": "pytest-dev/pytest",
        "evaluation_commit": "161bc74e9b940e722a4fc0189b6574fbc0f4bf9a",
        "query": "Execute fixture function and handle generator teardown logic in FixtureDef",
        "query_rationale": "Developer debugging how fixture execution and teardown were modularized.",
        "target_set": [
            {
                "file_path": "src/_pytest/fixtures.py",
                "symbol_name": "FixtureDef.execute",
                "line_span": [920, 960]
            }
        ],
        "historical_targets": [
            {
                "file_path": "src/_pytest/fixtures.py",
                "symbol_name": "FixtureDef._teardown_yield_fixture",
                "commit_sha": "41d8fb09ca1d201ef126347c4bffe77f0e0245d2"
            }
        ],
        "transformation": {
            "type": "function_extraction",
            "source_commit": "41d8fb09ca1d201ef126347c4bffe77f0e0245d2",
            "description": "Extracted helper for fixture teardown from monolithic fixture execution loop",
            "lineage_cluster_id": "PYTEST-FIXTURE-EXEC-01"
        },
        "history_distance_commits": 10,
        "distractor_symbols": [
            {
                "file_path": "src/_pytest/fixtures.py",
                "symbol_name": "FixtureDef.cache_key",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Cache key generation method in same FixtureDef class."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Documented fixture execution helper extraction."
    },
    {
        "case_id": "RETRO-B-0002",
        "category": "function_extraction",
        "language": "Java",
        "repository": "graphhopper/graphhopper",
        "evaluation_commit": "c7497d1100a4f05ddf5cc630692cbe8046b98114",
        "query": "Remove zero degree disconnected nodes in subnetwork preparation",
        "query_rationale": "Developer looking for extracted subnetwork cleanup logic markNodesRemovedIfUnreachable.",
        "target_set": [
            {
                "file_path": "core/src/main/java/com/graphhopper/routing/util/PrepareRoutingSubnetworks.java",
                "symbol_name": "PrepareRoutingSubnetworks.markNodesRemovedIfUnreachable",
                "line_span": [270, 278]
            }
        ],
        "historical_targets": [
            {
                "file_path": "core/src/main/java/com/graphhopper/routing/util/PrepareRoutingSubnetworks.java",
                "symbol_name": "PrepareRoutingSubnetworks.removeZeroDegreeNodes",
                "commit_sha": "88806c24c77ce9dde2d99ad3ffd4f4e190f06252"
            }
        ],
        "transformation": {
            "type": "function_extraction",
            "source_commit": "88806c24c77ce9dde2d99ad3ffd4f4e190f06252",
            "description": "Refactored zero degree node removal into markNodesRemovedIfUnreachable",
            "lineage_cluster_id": "GRAPHHOPPER-SUBNET-01"
        },
        "history_distance_commits": 40,
        "distractor_symbols": [
            {
                "file_path": "core/src/main/java/com/graphhopper/routing/util/PrepareRoutingSubnetworks.java",
                "symbol_name": "PrepareRoutingSubnetworks.setMinNetworkSize",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Adjacent configuration setter on subnetwork preparation class."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Mined refactoring from Graphhopper subnetwork preparation."
    },
    {
        "case_id": "RETRO-C-0001",
        "category": "function_movement",
        "language": "Python",
        "repository": "psf/requests",
        "evaluation_commit": "9633e6f98f625f385c49033327cb70730d52ff27",
        "query": "Resolve redirect locations and update history chain for HTTP responses",
        "query_rationale": "Developer seeking redirect handling logic moved from Session into SessionRedirectMixin.",
        "target_set": [
            {
                "file_path": "requests/sessions.py",
                "symbol_name": "SessionRedirectMixin.resolve_redirects",
                "line_span": [95, 230]
            }
        ],
        "historical_targets": [
            {
                "file_path": "requests/sessions.py",
                "symbol_name": "Session.resolve_redirects",
                "commit_sha": "99651586fb0f5f9e2e50529d380e2f5bdfb04168"
            }
        ],
        "transformation": {
            "type": "function_movement",
            "source_commit": "99651586fb0f5f9e2e50529d380e2f5bdfb04168",
            "description": "Moved resolve_redirects out of Session class into SessionRedirectMixin",
            "lineage_cluster_id": "REQUESTS-REDIRECT-MIXIN-01"
        },
        "history_distance_commits": 12,
        "distractor_symbols": [
            {
                "file_path": "requests/sessions.py",
                "symbol_name": "Session.send",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Primary request dispatch method on Session."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Classic Requests modularization moving redirect handling to mixin."
    },
    {
        "case_id": "RETRO-D-0001",
        "category": "function_split_merge",
        "language": "JavaScript",
        "repository": "mochajs/mocha",
        "evaluation_commit": "82ea8dc84b068ad1ecf42581ad793575c3ca57e3",
        "query": "Run test suite and iterate through test execution queue in Mocha Runner",
        "query_rationale": "Developer investigating test loop splitting into runTests and runTest.",
        "target_set": [
            {
                "file_path": "lib/runner.js",
                "symbol_name": "Runner.prototype.runTests",
                "line_span": [320, 360]
            }
        ],
        "historical_targets": [
            {
                "file_path": "lib/runner.js",
                "symbol_name": "Runner.prototype.runTests",
                "commit_sha": "33fcbb556276ae68e8e7804481d683b5c6e8bbda"
            }
        ],
        "transformation": {
            "type": "function_split_merge",
            "source_commit": "33fcbb556276ae68e8e7804481d683b5c6e8bbda",
            "description": "Split monolithic test runner execution into asynchronous suite queue iterator",
            "lineage_cluster_id": "MOCHA-RUNNER-SPLIT-01"
        },
        "history_distance_commits": 15,
        "distractor_symbols": [
            {
                "file_path": "lib/runner.js",
                "symbol_name": "Runner.prototype.run",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Top level runner dispatch coordinator."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Verified Mocha runner execution decomposition."
    },
    {
        "case_id": "RETRO-E-0001",
        "category": "substantial_rewrite",
        "language": "JavaScript",
        "repository": "moment/moment",
        "evaluation_commit": "c52ae3c42807f15456455110d9fa30833a6b8c99",
        "query": "Compute floating point duration value for specified time unit using Duration as",
        "query_rationale": "Developer updating duration unit calculations following internal unit normalization overhaul.",
        "target_set": [
            {
                "file_path": "src/lib/duration/as.js",
                "symbol_name": "as",
                "line_span": [5, 45]
            }
        ],
        "historical_targets": [
            {
                "file_path": "src/lib/duration/as.js",
                "symbol_name": "as",
                "commit_sha": "0e67426b8e8d200a3ca7dab046040717110e87e6"
            }
        ],
        "transformation": {
            "type": "substantial_rewrite",
            "source_commit": "0e67426b8e8d200a3ca7dab046040717110e87e6",
            "description": "Completely rewritten duration conversion algorithm using bubble/daysToMonths tables",
            "lineage_cluster_id": "MOMENT-DURATION-AS-01"
        },
        "history_distance_commits": 22,
        "distractor_symbols": [
            {
                "file_path": "src/lib/duration/as.js",
                "symbol_name": "valueOf",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Milliseconds primitive value extractor for Duration."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Documented duration calculation algorithm rewrite."
    },
    {
        "case_id": "RETRO-F-0001",
        "category": "historical_terminology",
        "language": "TypeScript",
        "repository": "vuejs/core",
        "evaluation_commit": "761ca78bb4663efd13a07b71932eaef1de3beaa7",
        "query": "Create reactive reference value wrapper using state and observable value binding",
        "query_rationale": "Developer recalling Vue 2 observable/state terminology looking for ref in Vue 3.",
        "target_set": [
            {
                "file_path": "packages/reactivity/src/ref.ts",
                "symbol_name": "ref",
                "line_span": [40, 75]
            }
        ],
        "historical_targets": [
            {
                "file_path": "packages/reactivity/src/ref.ts",
                "symbol_name": "ref",
                "commit_sha": "c346af2b6aa1c2796818405b4a960fc5c571594e"
            }
        ],
        "transformation": {
            "type": "historical_terminology",
            "source_commit": "c346af2b6aa1c2796818405b4a960fc5c571594e",
            "description": "Composition API ref introduced replacing Vue.observable value wrappers",
            "lineage_cluster_id": "VUE-REACTIVITY-REF-01"
        },
        "history_distance_commits": 19,
        "distractor_symbols": [
            {
                "file_path": "packages/reactivity/src/ref.ts",
                "symbol_name": "shallowRef",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Non-deep reactive reference wrapper."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Cross-major architectural terminology shift in reactivity model."
    },
    {
        "case_id": "RETRO-G-0001",
        "category": "current_code_control",
        "language": "Python",
        "repository": "psf/requests",
        "evaluation_commit": "9633e6f98f625f385c49033327cb70730d52ff27",
        "query": "Send PreparedRequest and return Response with adapter dispatch",
        "query_rationale": "Standard developer query looking for main request dispatch method in current code.",
        "target_set": [
            {
                "file_path": "requests/sessions.py",
                "symbol_name": "Session.send",
                "line_span": [580, 680]
            }
        ],
        "historical_targets": [],
        "transformation": {
            "type": "current_code_control",
            "source_commit": None,
            "description": "Stable core method unchanged across evaluation window",
            "lineage_cluster_id": "CONTROL-REQUESTS-SEND"
        },
        "history_distance_commits": None,
        "distractor_symbols": [
            {
                "file_path": "requests/sessions.py",
                "symbol_name": "Session.request",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "High level convenience wrapper creating and sending requests."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Control case: contemporary API query targeting stable method."
    },
    {
        "case_id": "RETRO-G-0002",
        "category": "current_code_control",
        "language": "TypeScript",
        "repository": "colinhacks/zod",
        "evaluation_commit": "30fecfba3cf2a02476d08127395ef3afb547242e",
        "query": "Parse input data safely returning success boolean and result or error object",
        "query_rationale": "Standard developer lookup for safe parsing method on Zod schemas.",
        "target_set": [
            {
                "file_path": "src/types.ts",
                "symbol_name": "ZodType.safeParse",
                "line_span": [120, 160]
            }
        ],
        "historical_targets": [],
        "transformation": {
            "type": "current_code_control",
            "source_commit": None,
            "description": "Stable core method unchanged across evaluation window",
            "lineage_cluster_id": "CONTROL-ZOD-SAFEPARSE"
        },
        "history_distance_commits": None,
        "distractor_symbols": [
            {
                "file_path": "src/types.ts",
                "symbol_name": "ZodType.parse",
                "distractor_type": "same_file_adjacent",
                "distractor_rationale": "Throwing variant of safeParse in ZodType."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Control case: contemporary query targeting unchanged method."
    },
    {
        "case_id": "RETRO-H-0001",
        "category": "hard_negative",
        "language": "TypeScript",
        "repository": "colinhacks/zod",
        "evaluation_commit": "30fecfba3cf2a02476d08127395ef3afb547242e",
        "query": "Extract discriminator type string using obsolete ZodParsedType helper",
        "query_rationale": "Query targeting permanently removed legacy type discriminator to evaluate false positive resistance.",
        "target_set": [],
        "historical_targets": [
            {
                "file_path": "src/parser.ts",
                "symbol_name": "ZodParsedType",
                "commit_sha": "4c2b963bfbf5ee08bf19d3fbc912301888a7dd51"
            }
        ],
        "transformation": {
            "type": "hard_negative",
            "source_commit": "4c2b963bfbf5ee08bf19d3fbc912301888a7dd51",
            "description": "Permanently removed internal helper; must test that retrieval abstains or avoids false positive ranking",
            "lineage_cluster_id": "ZOD-PARSED-TYPE-NEG"
        },
        "history_distance_commits": 25,
        "distractor_symbols": [
            {
                "file_path": "src/types.ts",
                "symbol_name": "ZodType",
                "distractor_type": "structural_sibling",
                "distractor_rationale": "Active type hierarchy root sharing name prefix."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Unanswerable hard negative: removed symbol with no successor."
    },
    {
        "case_id": "RETRO-I-0001",
        "category": "history_depth",
        "language": "Java",
        "repository": "undertow-io/undertow",
        "evaluation_commit": "5d80425390623a9b1c03bf47ee41f7158fa9a3d4",
        "query": "Normalize URL path and remove relative dot segments in CanonicalPathUtils",
        "query_rationale": "Developer searching for path canonicalization utility refactored 26 commits back in Undertow history.",
        "target_set": [
            {
                "file_path": "core/src/main/java/io/undertow/util/CanonicalPathUtils.java",
                "symbol_name": "CanonicalPathUtils.canonicalize",
                "line_span": [35, 120]
            }
        ],
        "historical_targets": [
            {
                "file_path": "core/src/main/java/io/undertow/util/CanonicalPathUtils.java",
                "symbol_name": "CanonicalPathUtils.canonicalize",
                "commit_sha": "03a4b65675c2e2c84236b280387b3eeb0c1e847c"
            }
        ],
        "transformation": {
            "type": "history_depth",
            "source_commit": "03a4b65675c2e2c84236b280387b3eeb0c1e847c",
            "description": "Refactored path canonicalization logic with security fixes 26 commits prior to pin",
            "lineage_cluster_id": "UNDERTOW-CANONICAL-PATH-01"
        },
        "history_distance_commits": 26,
        "distractor_symbols": [
            {
                "file_path": "core/src/main/java/io/undertow/util/PathMatcher.java",
                "distractor_type": "structural_sibling",
                "distractor_rationale": "Path routing helper in same utility package."
            }
        ],
        "verification_status": "verified",
        "inclusion_rationale": "Benchmark case spanning mid-distance band (k=26) in Undertow DAG."
    }
]

print(f"Auditing {len(candidate_pilots)} candidate pilot cases against authentic Git clones...")
all_ok = True

for c in candidate_pilots:
    repo = c["repository"]
    repo_path = resolve_repo_path(repo)
    if not repo_path:
        print(f"[-] FAILED: Repo clone not found for {repo}")
        all_ok = False
        continue
    
    # Check evaluation_commit
    if not verify_git_object(repo_path, c["evaluation_commit"]):
        print(f"[-] FAILED: evaluation_commit {c['evaluation_commit']} missing in {repo}")
        all_ok = False
        continue
        
    # Check target files
    for t in c["target_set"]:
        if not verify_git_object(repo_path, f"{c['evaluation_commit']}:{t['file_path']}"):
            print(f"[-] FAILED: Target file {t['file_path']} missing at commit {c['evaluation_commit'][:10]} in {repo}")
            all_ok = False
            continue
            
    # Check source_commit if present
    src_sha = c["transformation"].get("source_commit")
    if src_sha and not verify_git_object(repo_path, src_sha):
        print(f"[-] FAILED: source_commit {src_sha} missing in {repo}")
        all_ok = False
        continue

    print(f"[+] PASS: {c['case_id']} ({c['category']}, {c['language']}, {c['repository']})")

if all_ok:
    print("\nALL 13 PILOT CANDIDATES VERIFIED AGAINST AUTHENTIC GIT OBJECTS!")
