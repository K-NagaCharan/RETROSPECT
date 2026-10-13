from pathlib import Path

content = '''"""
Unified Evaluation Schema for Retrospect Historical Retrieval.
Defines normalized data models and validation utilities across all benchmark datasets.
"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Set
import re

EVOLUTION_TYPES: Set[str] = {
    "unchanged",
    "body_modification",
    "rename",
    "move",
    "rename_and_move",
    "parameter_change",
    "new",
    "substantial_rewrite",
    "split",
    "merge",
    "bug_fix",
    "clone_pair",
    "issue_patch"
}

VALID_LANGUAGES: Set[str] = {"java", "python", "javascript", "typescript"}

@dataclass
class FunctionEntity:
    name: str
    source: str
    file_path: str
    signature: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class CandidateEntity:
    candidate_id: str
    name: str
    source: str
    file_path: str
    signature: Optional[str] = None
    is_ground_truth: bool = False
    negative_type: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class LineageInstance:
    instance_id: str
    dataset: str
    language: str
    repository: str
    base_commit: str
    target_commit: str
    target_function: FunctionEntity
    candidates: List[CandidateEntity]
    ground_truth_id: str  # candidate_id or 'NEW'
    evolution_type: str
    commit_distance: Optional[int] = None
    candidate_pool_type: str = "local"  # 'local', 'repository_wide_100', 'repository_wide_1000', 'full_repo'
    label_provenance: str = "oracle"
    split: str = "test"  # 'train', 'val', 'test'
    metadata: Dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        if not self.instance_id:
            raise ValueError("LineageInstance: instance_id is required")
        if self.language.lower() not in VALID_LANGUAGES:
            raise ValueError(f"LineageInstance: Unsupported language '{self.language}'")
        if not self.target_function or not self.target_function.name:
            raise ValueError("LineageInstance: target_function with name is required")
        if not isinstance(self.candidates, list):
            raise ValueError("LineageInstance: candidates must be a list")
        if self.ground_truth_id != "NEW":
            cand_ids = {c.candidate_id for c in self.candidates}
            if self.ground_truth_id not in cand_ids:
                raise ValueError(
                    f"LineageInstance {self.instance_id}: ground_truth_id '{self.ground_truth_id}' "
                    f"not in candidate IDs {cand_ids}"
                )
        if self.split not in {"train", "val", "test"}:
            raise ValueError(f"LineageInstance: invalid split '{self.split}'")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "instance_id": self.instance_id,
            "dataset": self.dataset,
            "language": self.language.lower(),
            "repository": self.repository,
            "base_commit": self.base_commit,
            "target_commit": self.target_commit,
            "target_function": self.target_function.to_dict(),
            "candidates": [c.to_dict() for c in self.candidates],
            "ground_truth_id": self.ground_truth_id,
            "evolution_type": self.evolution_type,
            "commit_distance": self.commit_distance,
            "candidate_pool_type": self.candidate_pool_type,
            "label_provenance": self.label_provenance,
            "split": self.split,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LineageInstance":
        tf_data = data["target_function"]
        tf = FunctionEntity(
            name=tf_data.get("name", ""),
            source=tf_data.get("source", ""),
            file_path=tf_data.get("file_path", ""),
            signature=tf_data.get("signature"),
            start_line=tf_data.get("start_line"),
            end_line=tf_data.get("end_line"),
            metadata=tf_data.get("metadata", {})
        )

        candidates = []
        for c in data.get("candidates", []):
            candidates.append(CandidateEntity(
                candidate_id=c.get("candidate_id", ""),
                name=c.get("name", ""),
                source=c.get("source", ""),
                file_path=c.get("file_path", ""),
                signature=c.get("signature"),
                is_ground_truth=c.get("is_ground_truth", False),
                negative_type=c.get("negative_type"),
                start_line=c.get("start_line"),
                end_line=c.get("end_line"),
                metadata=c.get("metadata", {})
            ))

        return cls(
            instance_id=data["instance_id"],
            dataset=data.get("dataset", "unknown"),
            language=data.get("language", "unknown").lower(),
            repository=data.get("repository", "unknown"),
            base_commit=data.get("base_commit", "unavailable"),
            target_commit=data.get("target_commit", "unavailable"),
            target_function=tf,
            candidates=candidates,
            ground_truth_id=data.get("ground_truth_id", "NEW"),
            evolution_type=data.get("evolution_type", data.get("change_type", "unknown")),
            commit_distance=data.get("commit_distance"),
            candidate_pool_type=data.get("candidate_pool_type", "local"),
            label_provenance=data.get("label_provenance", "oracle"),
            split=data.get("split", "test"),
            metadata=data.get("metadata", {})
        )
'''

target_file = Path("d:/base papers considered/laya testing/src/evaluation/schema.py")
with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Created {target_file} successfully!")
