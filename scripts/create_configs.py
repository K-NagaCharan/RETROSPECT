from pathlib import Path

content = '''"""
Retrieval Configurations for Historical Function Matching:
- Config A: Exact and Lexical Baseline (Hash, Tokens, Levenshtein)
- Config B: Structural Baseline (AST Sequence, Code Shape, Parameters)
- Config C: Historical Baseline (Commit Distance, Rename Tracing, Prior Version Graph)
- Config D: Combined Baseline (Principled Fusion of Lexical, Structural & Historical Signals)
"""
import re
import hashlib
from typing import Dict, Any, List, Optional, Tuple

from src.models.baselines import normalize_code, tokenize_code, jaccard_similarity, levenshtein_similarity
from src.extractors.ast_extractors import extract_features, ASTFeatures

def compute_source_hash(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()

# ==============================================================================
# CONFIG A: EXACT AND LEXICAL BASELINE
# ==============================================================================
class ExactLexicalBaseline:
    def __init__(self, new_threshold: float = 0.35, weight_name: float = 0.40, weight_tokens: float = 0.60):
        self.new_threshold = new_threshold
        self.weight_name = weight_name
        self.weight_tokens = weight_tokens

    def score_candidate(self, target_src: str, target_name: str, cand_src: str, cand_name: str) -> float:
        # Tier 1: exact byte or normalized match
        if compute_source_hash(target_src) == compute_source_hash(cand_src) and target_name == cand_name:
            return 1.0

        norm_t = normalize_code(target_src)
        norm_c = normalize_code(cand_src)
        if norm_t == norm_c and norm_t != "" and target_name == cand_name:
            return 1.0

        # Tier 2: name + token overlap
        name_sim = levenshtein_similarity(target_name, cand_name)
        tokens_t = set(tokenize_code(target_src))
        tokens_c = set(tokenize_code(cand_src))
        token_sim = jaccard_similarity(tokens_t, tokens_c)

        return self.weight_name * name_sim + self.weight_tokens * token_sim

    def predict(self, target_function: Dict[str, Any], candidates: List[Dict[str, Any]], language: str = "unknown") -> Dict[str, Any]:
        t_src = target_function.get("source", "")
        t_name = target_function.get("name", "")

        scores = {}
        for c in candidates:
            cid = c.get("candidate_id", "")
            scores[cid] = self.score_candidate(t_src, t_name, c.get("source", ""), c.get("name", ""))

        if not scores:
            return {"prediction": "NEW", "confidence": 1.0, "scores": {}}

        sorted_cands = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
        top1_id = sorted_cands[0]
        top1_score = scores[top1_id]

        if top1_score >= self.new_threshold:
            return {"prediction": top1_id, "confidence": top1_score, "scores": scores, "method": "lexical"}
        else:
            return {"prediction": "NEW", "confidence": max(0.1, 1.0 - top1_score), "scores": scores, "method": "lexical_new"}

# ==============================================================================
# CONFIG B: STRUCTURAL BASELINE
# ==============================================================================
class StructuralBaseline:
    def __init__(self, new_threshold: float = 0.30):
        self.new_threshold = new_threshold

    def score_candidate(self, t_feats: ASTFeatures, c_feats: ASTFeatures) -> float:
        # AST node sequence jaccard
        seq_sim = jaccard_similarity(set(t_feats.node_types_sequence), set(c_feats.node_types_sequence))

        # Statement count ratio
        max_stmts = max(t_feats.statement_count, c_feats.statement_count, 1)
        diff_stmts = abs(t_feats.statement_count - c_feats.statement_count)
        stmt_sim = max(0.0, 1.0 - (diff_stmts / max_stmts))

        # Parameter overlap
        params_t = set(t_feats.parameter_names)
        params_c = set(c_feats.parameter_names)
        param_sim = jaccard_similarity(params_t, params_c)

        # Structural composite
        return 0.50 * seq_sim + 0.30 * stmt_sim + 0.20 * param_sim

    def predict(self, target_function: Dict[str, Any], candidates: List[Dict[str, Any]], language: str = "unknown") -> Dict[str, Any]:
        t_src = target_function.get("source", "")
        t_lang = language or "unknown"
        t_feats = extract_features(t_src, t_lang)

        scores = {}
        for c in candidates:
            cid = c.get("candidate_id", "")
            c_feats = extract_features(c.get("source", ""), t_lang)
            scores[cid] = self.score_candidate(t_feats, c_feats)

        if not scores:
            return {"prediction": "NEW", "confidence": 1.0, "scores": {}}

        sorted_cands = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
        top1_id = sorted_cands[0]
        top1_score = scores[top1_id]

        if top1_score >= self.new_threshold:
            return {"prediction": top1_id, "confidence": top1_score, "scores": scores, "method": "structural"}
        else:
            return {"prediction": "NEW", "confidence": max(0.1, 1.0 - top1_score), "scores": scores, "method": "structural_new"}

# ==============================================================================
# CONFIG C: HISTORICAL RETRIEVAL BASELINE
# ==============================================================================
class HistoricalBaseline:
    def __init__(self, new_threshold: float = 0.40):
        self.new_threshold = new_threshold

    def score_candidate(self, target_info: Dict[str, Any], cand_info: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> float:
        # File continuity signal
        t_path = target_info.get("file_path", "")
        c_path = cand_info.get("file_path", "")
        path_sim = 1.0 if t_path == c_path and t_path != "" else 0.5

        # Name continuity
        name_sim = levenshtein_similarity(target_info.get("name", ""), cand_info.get("name", ""))

        # Commit distance penalty: closer commits have higher likelihood of continuous lineage
        dist = cand_info.get("metadata", {}).get("commit_distance")
        if dist is None and context:
            dist = context.get("commit_distance")
        if dist is not None and isinstance(dist, (int, float)):
            dist_sim = max(0.2, 1.0 / (1.0 + 0.05 * float(dist)))
        else:
            dist_sim = 0.8

        # Evolution classification continuity
        evo_hint = cand_info.get("metadata", {}).get("evolution_type", "unknown")
        evo_weight = 1.0 if evo_hint in {"unchanged", "body_modification", "rename", "move"} else 0.7

        return (0.40 * path_sim + 0.35 * name_sim + 0.25 * dist_sim) * evo_weight

    def predict(self, target_function: Dict[str, Any], candidates: List[Dict[str, Any]], language: str = "unknown", context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        scores = {}
        for c in candidates:
            cid = c.get("candidate_id", "")
            scores[cid] = self.score_candidate(target_function, c, context)

        if not scores:
            return {"prediction": "NEW", "confidence": 1.0, "scores": {}}

        sorted_cands = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
        top1_id = sorted_cands[0]
        top1_score = scores[top1_id]

        if top1_score >= self.new_threshold:
            return {"prediction": top1_id, "confidence": top1_score, "scores": scores, "method": "historical"}
        else:
            return {"prediction": "NEW", "confidence": max(0.1, 1.0 - top1_score), "scores": scores, "method": "historical_new"}

# ==============================================================================
# CONFIG D: COMBINED RETRIEVAL (FUSION OF LEXICAL, STRUCTURAL & HISTORICAL)
# ==============================================================================
class CombinedRetrievalBaseline:
    """
    Combined Retrieval Pipeline:
    Blends Lexical, Structural AST, and Git Historical signals with explicit ambiguity gating.
    Weights tuned on validation split: w_lex=0.45, w_struct=0.35, w_hist=0.20
    """
    def __init__(
        self,
        w_lex: float = 0.45,
        w_struct: float = 0.35,
        w_hist: float = 0.20,
        new_threshold: float = 0.38,
        ambiguity_margin: float = 0.06
    ):
        self.lex = ExactLexicalBaseline()
        self.struct = StructuralBaseline()
        self.hist = HistoricalBaseline()
        self.w_lex = w_lex
        self.w_struct = w_struct
        self.w_hist = w_hist
        self.new_threshold = new_threshold
        self.ambiguity_margin = ambiguity_margin

    def predict(self, target_function: Dict[str, Any], candidates: List[Dict[str, Any]], language: str = "unknown", context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        t_src = target_function.get("source", "")
        t_name = target_function.get("name", "")

        # Fast tier: Exact hash match overrides everything
        for c in candidates:
            cid = c.get("candidate_id", "")
            if compute_source_hash(t_src) == compute_source_hash(c.get("source", "")) and t_name == c.get("name", ""):
                scores = {cand.get("candidate_id", ""): 0.1 for cand in candidates}
                scores[cid] = 1.0
                return {"prediction": cid, "confidence": 1.0, "scores": scores, "method": "tier1_exact_hash"}

        # Extract structural features once
        t_feats = extract_features(t_src, language or "unknown")

        scores = {}
        for c in candidates:
            cid = c.get("candidate_id", "")
            s_lex = self.lex.score_candidate(t_src, t_name, c.get("source", ""), c.get("name", ""))
            c_feats = extract_features(c.get("source", ""), language or "unknown")
            s_struct = self.struct.score_candidate(t_feats, c_feats)
            s_hist = self.hist.score_candidate(target_function, c, context)

            total = self.w_lex * s_lex + self.w_struct * s_struct + self.w_hist * s_hist
            scores[cid] = total

        if not scores:
            return {"prediction": "NEW", "confidence": 1.0, "scores": {}}

        sorted_cands = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
        top1_id = sorted_cands[0]
        top1_score = scores[top1_id]
        top2_score = scores[sorted_cands[1]] if len(sorted_cands) > 1 else 0.0

        # Ambiguity check
        if len(sorted_cands) > 1 and (top1_score - top2_score < self.ambiguity_margin) and top1_score >= self.new_threshold:
            return {
                "prediction": "NEW",
                "confidence": max(0.1, 1.0 - top1_score),
                "scores": scores,
                "method": "ambiguous_uncertain",
                "status": "uncertain"
            }

        if top1_score >= self.new_threshold:
            return {"prediction": top1_id, "confidence": top1_score, "scores": scores, "method": "combined"}
        else:
            return {"prediction": "NEW", "confidence": max(0.1, 1.0 - top1_score), "scores": scores, "method": "combined_new"}
'''

target_file = Path("d:/base papers considered/laya testing/src/evaluation/baselines/configurations.py")
with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Created {target_file} successfully!")
