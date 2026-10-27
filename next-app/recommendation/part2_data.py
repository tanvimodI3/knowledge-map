"""
Data loaders and shared data structures for Part 2 (MANN recommendation model).
Paper: Wu et al., Information Sciences 595 (2022).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn

from part2_config import (
    EMB_DIM,
    GRAPH_FILE,
    NODE_VECTORS_FILE,
    RULES_FILE,
    SAMPLED_PATHS_FILE,
    TEST_PAIRS_FILE,
)


# ---------------------------------------------------------------------------
# Shared Return Dataclasses (Spec Contract)
# ---------------------------------------------------------------------------
@dataclass
class GlobalRepr:
    """Global context representation from Dev A (paper Sec 3.2)."""
    user: torch.Tensor        # e_ur
    item: torch.Tensor        # e_vr
    has_global: bool
    attention_weights: dict[str, float] | None = None
    top_rule: str | None = None


@dataclass
class LocalRepr:
    """Local context representation from Dev B (paper Sec 3.3)."""
    user: torch.Tensor        # e_ul
    item: torch.Tensor        # e_vl
    has_local: bool


# ---------------------------------------------------------------------------
# Data Loaders (Adapted to real Part 1 JSON outputs)
# ---------------------------------------------------------------------------
def load_sampled_paths(
    file_path: Path | str = SAMPLED_PATHS_FILE,
) -> dict[tuple[str, str], dict[str, list[list[str]]]]:
    """
    Load sampled paths from JSON.
    Adapts from file format {"u|v": {rule_key: [{"nodes": [...], ...}]}}
    to: dict[(user, item)] -> dict[rule_key] -> list[list[node_id]]
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"sampled_paths file not found at: {path}")

    with path.open("r", encoding="utf-8") as f:
        raw_data: dict[str, Any] = json.load(f)

    result: dict[tuple[str, str], dict[str, list[list[str]]]] = {}

    for pair_key, rules_dict in raw_data.items():
        if "|" in pair_key:
            u, v = pair_key.split("|", 1)
        elif isinstance(pair_key, str) and "," in pair_key:
            u, v = pair_key.split(",", 1)
        else:
            continue

        pair_tuple = (u.strip(), v.strip())
        result[pair_tuple] = {}

        if not isinstance(rules_dict, dict):
            continue

        for rule_key, paths_list in rules_dict.items():
            normalized_paths: list[list[str]] = []
            if isinstance(paths_list, list):
                for p in paths_list:
                    if isinstance(p, dict) and "nodes" in p:
                        normalized_paths.append([str(n) for n in p["nodes"]])
                    elif isinstance(p, list):
                        normalized_paths.append([str(n) for n in p])
            result[pair_tuple][rule_key] = normalized_paths

    return result


def load_node_vectors(
    file_path: Path | str = NODE_VECTORS_FILE,
) -> dict[str, list[float]]:
    """Load pre-computed node embeddings: id -> list[float]."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"node_vectors file not found at: {path}")

    with path.open("r", encoding="utf-8") as f:
        data: dict[str, list[float]] = json.load(f)

    return data


def load_rules(file_path: Path | str = RULES_FILE) -> list[str]:
    """
    Load rule keys from rules.json (or fallback from sampled_paths).
    Returns a list of standardized rule identifier strings.
    """
    path = Path(file_path)
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    rule_keys: list[str] = []
    if isinstance(data, dict) and "rules" in data and isinstance(data["rules"], list):
        for r_obj in data["rules"]:
            # Format rule as comma-separated or rule_text
            if isinstance(r_obj.get("rule"), list):
                rule_keys.append(",".join(r_obj["rule"]))
            elif "rule_text" in r_obj:
                rule_keys.append(str(r_obj["rule_text"]))
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, str):
                rule_keys.append(item)
            elif isinstance(item, dict) and "rule" in item:
                rule_keys.append(",".join(item["rule"]))

    return sorted(list(set(rule_keys)))


def load_test_pairs(
    file_path: Path | str = TEST_PAIRS_FILE,
) -> set[tuple[str, str]]:
    """Load held-out evaluation pairs into a set of (user, item) tuples."""
    path = Path(file_path)
    if not path.exists():
        return set()

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    test_set = set()
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and "user" in item and "item" in item:
                test_set.add((str(item["user"]), str(item["item"])))
            elif isinstance(item, (list, tuple)) and len(item) == 2:
                test_set.add((str(item[0]), str(item[1])))

    return test_set


def load_graph_neighborhoods(
    graph_file: Path | str = GRAPH_FILE,
    test_pairs: set[tuple[str, str]] | None = None,
) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """
    Builds training neighborhoods V_u and V_v from graph triples (Sec 3.3).
    Enforces LEAKAGE GUARD: strictly excludes every pair in test_pairs.

    Returns:
        user_to_items: dict[user_id, list[item_id]]
        item_to_users: dict[item_id, list[user_id]]
    """
    path = Path(graph_file)
    if not path.exists():
        return {}, {}

    if test_pairs is None:
        test_pairs = load_test_pairs()

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    triples = data.get("triples", []) if isinstance(data, dict) else []

    user_to_items: dict[str, list[str]] = {}
    item_to_users: dict[str, list[str]] = {}

    for t in triples:
        if not isinstance(t, dict):
            continue
        rel = t.get("relation")
        head = str(t.get("head"))
        tail = str(t.get("tail"))

        # Only 'interacts' edges define user-item interaction neighborhoods
        if rel == "interacts":
            # LEAKAGE GUARD: Skip if this (user, item) pair was held out for testing
            if (head, tail) in test_pairs:
                continue

            user_to_items.setdefault(head, []).append(tail)
            item_to_users.setdefault(tail, []).append(head)

    # Deduplicate while preserving order
    user_to_items = {u: list(dict.fromkeys(items)) for u, items in user_to_items.items()}
    item_to_users = {v: list(dict.fromkeys(users)) for v, users in item_to_users.items()}

    return user_to_items, item_to_users


def build_embedding_table(
    node_vectors: dict[str, list[float]],
    emb_dim: int = EMB_DIM,
) -> tuple[nn.Embedding, dict[str, int], dict[int, str]]:
    """
    Create a torch.nn.Embedding table initialized from pre-computed node vectors.
    Index 0 is reserved for <UNK> / padding.
    """
    id_to_index: dict[str, int] = {"<UNK>": 0}
    index_to_id: dict[int, str] = {0: "<UNK>"}

    vector_dim = emb_dim
    sample_key = next(iter(node_vectors), None)
    if sample_key is not None:
        vector_dim = len(node_vectors[sample_key])

    weights: list[list[float]] = [[0.0] * vector_dim]  # index 0 is zeros

    for idx, (node_id, vec) in enumerate(node_vectors.items(), start=1):
        id_to_index[node_id] = idx
        index_to_id[idx] = node_id
        if len(vec) == vector_dim:
            weights.append(vec)
        else:
            # Pad or truncate if dimensions differ
            padded = list(vec[:vector_dim]) + [0.0] * max(0, vector_dim - len(vec))
            weights.append(padded)

    weight_tensor = torch.tensor(weights, dtype=torch.float32)
    embedding = nn.Embedding.from_pretrained(weight_tensor, freeze=False)

    return embedding, id_to_index, index_to_id


# ---------------------------------------------------------------------------
# In-Memory Synthetic Fixture for Independent Unit Testing
# ---------------------------------------------------------------------------
def get_dummy_fixture(emb_dim: int = 16) -> dict[str, Any]:
    """Generates synthetic data (15 pairs, 3 rules, 16-dim vectors) for testing."""
    users = ["u1", "u2", "u3"]
    skills = ["s1", "s2", "s3", "s4", "s5"]
    nodes = users + skills + ["w1", "w2"]

    # Random node vectors
    rng = np.random.default_rng(42)
    node_vectors = {node: rng.normal(0, 1, emb_dim).tolist() for node in nodes}

    rules = [
        "interacts,prerequisite",
        "interacts,related_to",
        "interacts,prerequisite,prerequisite",
    ]

    sampled_paths: dict[tuple[str, str], dict[str, list[list[str]]]] = {
        ("u1", "s1"): {
            "interacts,prerequisite": [["u1", "s2", "s1"]],
            "interacts,related_to": [["u1", "w1", "s1"]],
        },
        ("u1", "s2"): {
            "interacts,prerequisite": [["u1", "s3", "s2"]],
        },
        ("u2", "s3"): {
            "interacts,prerequisite,prerequisite": [["u2", "s1", "w1", "s3"]],
        },
        ("u3", "s5"): {},  # Cold start pair (zero paths)
    }

    test_pairs = {("u1", "s4"), ("u2", "s5")}

    # Training neighborhoods strictly excluding test_pairs (Leakage Guard)
    user_to_items = {
        "u1": ["s1", "s2"],      # interacts with s1, s2 (s4 held out)
        "u2": ["s1", "s3"],      # interacts with s1, s3 (s5 held out)
        "u3": [],                # Cold-start user (no items)
    }

    item_to_users = {
        "s1": ["u1", "u2"],
        "s2": ["u1"],
        "s3": ["u2"],
        "s4": [],                # Only interacted with u1 (which was held out)
        "s5": [],                # Cold-start item
    }

    return {
        "sampled_paths": sampled_paths,
        "node_vectors": node_vectors,
        "rules": rules,
        "test_pairs": test_pairs,
        "user_to_items": user_to_items,
        "item_to_users": item_to_users,
        "emb_dim": emb_dim,
    }
