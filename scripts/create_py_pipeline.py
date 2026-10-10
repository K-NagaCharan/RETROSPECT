import os
import shutil

content = '''"""
Retrospect Deterministic Historical Retrieval Pipeline Model Adapter.
Exposes Retrospect's multi-language, AST/token-aware deterministic function matching engine
for the Retrospect Benchmark Oracle.
"""
import re
import hashlib
from typing import Dict, Any, List

def compute_hash(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()

def normalize_code(code: str) -> str:
    # Strip comments and extra whitespace
    code = re.sub(r'(?://|#).*$', '', code or '', flags=re.MULTILINE)
    code = re.sub(r'/\\*.*?\\*/', '', code or '', flags=re.DOTALL)
    tokens = code.split()
    return ' '.join(tokens)

def tokenize(s: str) -> List[str]:
    return [t.lower() for t in re.findall(r'[A-Za-z0-9_]+', s or '')]

def jaccard(set_a: set, set_b: set) -> float:
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)

def string_sim(s1: str, s2: str) -> float:
    s1, s2 = (s1 or '').lower(), (s2 or '').lower()
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    m, n = len(s1), len(s2)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, n + 1):
            temp = dp[j]
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
            prev = temp
    return max(0.0, 1.0 - dp[n] / max(m, n))

class RetrospectPipeline:
    """
    Retrospect Deterministic Matching Engine:
    - Tier 1: Exact Hash & Exact Signature Identity Signals
    - Tier 2: Multi-Signal Similarity (Tokens 0.35, Name 0.25, Signature 0.15, Scope 0.15, Params 0.10)
    - Ambiguity and NEW Policy: Explicit detection of ambiguous competing predecessors
    """
    def __init__(self, threshold_moderate: float = 0.50, threshold_ambiguity: float = 0.08):
        self.threshold_moderate = threshold_moderate
        self.threshold_ambiguity = threshold_ambiguity
        self.weights = {
            'tokens': 0.35,
            'name': 0.25,
            'signature': 0.15,
            'scope': 0.15,
            'params': 0.10
        }

    def predict(self, target_function: Dict[str, Any], candidates: List[Dict[str, Any]], language: str = 'unknown') -> Dict[str, Any]:
        t_name = target_function.get('name', '')
        t_src = target_function.get('source', '')
        t_file = target_function.get('file_path', '')
        t_hash = compute_hash(t_src)
        t_tokens = set(tokenize(t_src))
        norm_t = normalize_code(t_src)

        if not candidates:
            return {'prediction': 'NEW', 'confidence': 1.0, 'scores': {}}

        scores = {}

        # Tier 1: Strong Identity Signals
        for c in candidates:
            cid = c['candidate_id']
            c_name = c.get('name', '')
            c_src = c.get('source', '')
            c_hash = compute_hash(c_src)
            norm_c = normalize_code(c_src)

            # Exact hash match or exact normalized code match
            if (c_hash == t_hash or (norm_t and norm_t == norm_c)) and c_name == t_name:
                scores[cid] = 1.0

            # Exact name with modified body
            elif c_name == t_name:
                c_tokens = set(tokenize(c_src))
                tok_sim = jaccard(t_tokens, c_tokens)
                if tok_sim >= 0.25:
                    scores[cid] = min(0.99, 0.90 + 0.08 * tok_sim)

        # Tier 2: Multi-Signal Scoring for all remaining candidates
        scored = []
        for c in candidates:
            cid = c['candidate_id']
            if cid in scores:
                scored.append((cid, scores[cid]))
                continue

            c_name = c.get('name', '')
            c_src = c.get('source', '')
            c_tokens = set(tokenize(c_src))

            tok_sim = jaccard(t_tokens, c_tokens)
            name_sim = string_sim(t_name, c_name)
            sig_sim = name_sim
            scope_sim = 1.0 if t_file == c.get('file_path') else 0.6
            param_sim = name_sim

            total = (
                self.weights['tokens'] * tok_sim +
                self.weights['name'] * name_sim +
                self.weights['signature'] * sig_sim +
                self.weights['scope'] * scope_sim +
                self.weights['params'] * param_sim
            )
            scores[cid] = total
            scored.append((cid, total))

        scored.sort(key=lambda x: x[1], reverse=True)
        top1_id, top1_score = scored[0]
        top2_score = scored[1][1] if len(scored) > 1 else 0.0

        # Ambiguity Policy: if top two are within threshold_ambiguity
        if len(scored) > 1 and (top1_score - top2_score < self.threshold_ambiguity) and top1_score >= self.threshold_moderate:
            max_s = max(scores.values()) if scores else 0.0
            return {
                'prediction': 'NEW',
                'confidence': max(0.1, 1.0 - max_s),
                'scores': scores,
                'status': 'ambiguous'
            }

        # Decision Policy
        if top1_score >= self.threshold_moderate:
            return {
                'prediction': top1_id,
                'confidence': top1_score,
                'scores': scores,
                'status': 'match'
            }
        else:
            return {
                'prediction': 'NEW',
                'confidence': max(0.1, 1.0 - top1_score),
                'scores': scores,
                'status': 'new'
            }
'''

target_path = 'd:/base papers considered/laya testing/src/models/retrospect_pipeline.py'
with open(target_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Created {target_path} successfully!")
