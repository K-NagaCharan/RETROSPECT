from pathlib import Path

content = '''"""
Track Builders for Multi-Track Evaluation:
- Track 1: Standard Lineage Retrieval (Verified Reference + External Datasets)
- Track 2: Repository-Wide Retrieval Stress Test (Candidate Pools k in {4, 100, 1000, Full})
- Track 3: Difficult Evolution & Stress Subsets (Fine-grained category slicing)
"""
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict
import random

from src.evaluation.schema import LineageInstance, CandidateEntity
from src.evaluation.adapters.dataset_adapters import (
    ReferenceBenchmarkAdapter,
    RefactoringMinerJavaAdapter,
    ManySStuBs4JAdapter,
    BigCloneBenchStressAdapter,
    SWEBenchStressAdapter
)

# ==============================================================================
# TRACK 1 BUILDER: STANDARD LINEAGE RETRIEVAL
# ==============================================================================
class Track1LineageBuilder:
    def __init__(self):
        self.ref_adapter = ReferenceBenchmarkAdapter()
        self.rminer_adapter = RefactoringMinerJavaAdapter()
        self.sstubs_adapter = ManySStuBs4JAdapter()

    def build_dataset(self, split: str = "test", include_external: bool = True, seed: int = 42) -> List[LineageInstance]:
        dataset = []

        # 1. Mandatory reference benchmark
        ref_instances = self.ref_adapter.load(split_filter=split)
        dataset.extend(ref_instances)

        if include_external and split == "test":
            # 2. Add verified external instances from RefactoringMiner 2.0 (unseen Java repos)
            rm_instances = self.rminer_adapter.load(max_instances=40, seed=seed)
            dataset.extend(rm_instances)

            # 3. Add ManySStuBs4J bug-fixing lineage instances
            sstub_instances = self.sstubs_adapter.load(max_instances=25, seed=seed)
            dataset.extend(sstub_instances)

        print(f"[Track1LineageBuilder] Total Track 1 instances ({split}): {len(dataset)}")
        return dataset

# ==============================================================================
# TRACK 2 BUILDER: REPOSITORY-WIDE SCALING RETRIEVAL
# ==============================================================================
class Track2RepoWideBuilder:
    def __init__(self):
        self.stress_adapter = BigCloneBenchStressAdapter()

    def build_scaled_track(self, base_instances: List[LineageInstance], pool_size: int = 100, seed: int = 42) -> List[LineageInstance]:
        scaled_dataset = []
        for inst in base_instances:
            scaled_inst = self.stress_adapter.load_stress_pool(
                base_instance=inst,
                pool_size=pool_size,
                seed=seed
            )
            scaled_dataset.append(scaled_inst)
        print(f"[Track2RepoWideBuilder] Built Track 2 dataset for pool size k={pool_size} (N={len(scaled_dataset)})")
        return scaled_dataset

# ==============================================================================
# TRACK 3 BUILDER: DIFFICULT EVOLUTION & HARD-NEGATIVE SUBSETS
# ==============================================================================
class Track3StressSubsets:
    @staticmethod
    def partition_subsets(instances: List[LineageInstance]) -> Dict[str, List[LineageInstance]]:
        subsets = defaultdict(list)

        for inst in instances:
            evo = inst.evolution_type.lower()
            t_name = inst.target_function.name
            gt_cand = next((c for c in inst.candidates if c.is_ground_truth), None)

            # 1. Exact Source Matches
            if gt_cand and inst.target_function.source.strip() == gt_cand.source.strip():
                subsets["exact_source_matches"].append(inst)

            # 2. Same-Name with Modified Bodies
            if gt_cand and gt_cand.name == t_name and inst.target_function.source.strip() != gt_cand.source.strip():
                subsets["same_name_modified_body"].append(inst)

            # 3. Renamed Functions
            if "rename" in evo or (gt_cand and gt_cand.name != t_name):
                subsets["renamed_functions"].append(inst)

            # 4. Moved Functions
            if "move" in evo:
                subsets["moved_functions"].append(inst)

            # 5. Parameter & Signature Changes
            if "param" in evo or "signature" in evo:
                subsets["parameter_and_signature_changes"].append(inst)

            # 6. Newly Introduced Functions (NEW)
            if inst.ground_truth_id == "NEW":
                subsets["newly_introduced_functions"].append(inst)

            # 7. Unseen Repositories
            if inst.dataset != "Retrospect_Reference_Benchmark":
                subsets["unseen_repositories"].append(inst)

            # 8. Long Commit Gaps
            if inst.commit_distance is not None and inst.commit_distance > 5:
                subsets["long_commit_gaps"].append(inst)

        return dict(subsets)
'''

target_file = Path("d:/base papers considered/laya testing/src/evaluation/datasets/track_builder.py")
with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Created {target_file} successfully!")
