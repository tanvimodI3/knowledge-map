"""
Part 1C: Path Scoring and Sampling
===================================
Paper: MANN (Wu et al., Information Sciences 595, 2022), Sec 3.1.3.

Input  : filtered_paths.json  (from 1B; shape: {user, item, nodes, relations})
         test_pairs.json       (from 1A; shape: [{user, item}])
Output : sampled_paths.json   (top-K paths per (user, item, rule) group)
         node_vectors.json     (node_id -> embedding vector)

Node embeddings: sentence-transformer text embeddings of each node's readable name.
K = 5  (top paths kept per (user, item, rule) group).

Run:
    pip install sentence-transformers
    python recommendation/part1c_path_scoring.py
(from the next-app directory, or adjust HERE below)
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Constants (names match the MD spec exactly)
# ---------------------------------------------------------------------------
K = 5
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# ---------------------------------------------------------------------------
# Paths  (all files live in the same recommendation/ folder as this script)
# ---------------------------------------------------------------------------
HERE = Path(__file__).parent

# Primary input from 1B (used when available)
FILTERED_PATHS_FILE = HERE / "filtered_paths.json"

# Fallback: 1A raw_paths has the identical shape and is already present
RAW_PATHS_FILE = HERE / "raw_paths.json"

# From 1A – already present
TEST_PAIRS_FILE = HERE / "test_pairs.json"

# Outputs handed to Part 2
SAMPLED_PATHS_FILE = HERE / "sampled_paths.json"
NODE_VECTORS_FILE  = HERE / "node_vectors.json"


# ---------------------------------------------------------------------------
# Step 0 – Resolve inputs
# ---------------------------------------------------------------------------
def load_inputs() -> tuple[list[dict], list[dict]]:
    """
    Load filtered_paths and test_pairs.
    Uses filtered_paths.json when available (real 1B output),
    otherwise falls back to raw_paths.json (same shape, from 1A).
    """
    if FILTERED_PATHS_FILE.exists():
        print(f"[1C] Using filtered_paths.json (1B output): {FILTERED_PATHS_FILE}")
        with FILTERED_PATHS_FILE.open(encoding="utf-8") as f:
            filtered_paths: list[dict] = json.load(f)
    elif RAW_PATHS_FILE.exists():
        print(f"[1C] filtered_paths.json not found – falling back to raw_paths.json (1A output)")
        with RAW_PATHS_FILE.open(encoding="utf-8") as f:
            filtered_paths = json.load(f)
    else:
        sys.exit(
            "[1C] ERROR: Neither filtered_paths.json nor raw_paths.json found.\n"
            "       Run 1A first (node recommendation/path_finder.mjs) to generate raw_paths.json."
        )

    if TEST_PAIRS_FILE.exists():
        with TEST_PAIRS_FILE.open(encoding="utf-8") as f:
            test_pairs: list[dict] = json.load(f)
        print(f"[1C] Loaded {len(test_pairs)} test pairs from test_pairs.json")
    else:
        print("[1C] test_pairs.json not found – leakage test will be skipped.")
        test_pairs = []

    return filtered_paths, test_pairs


# ---------------------------------------------------------------------------
# Step 1 – Node embeddings via sentence-transformers
# ---------------------------------------------------------------------------
def node_name_from_id(node_id: str) -> str:
    """
    Turn a node id into a human-readable name for embedding.

    Examples:
        u_alice          -> alice
        neural_networks  -> neural networks
        prerequisite⁻¹  -> (not a node, but handled gracefully)
        rag              -> rag
        vector_db        -> vector db
    """
    # Strip user prefix  (u_alice -> alice)
    name = re.sub(r"^u_", "", node_id)
    # Replace underscores with spaces
    name = name.replace("_", " ")
    # Camel-case boundary  (nextjs -> nextjs, no change needed here)
    name = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)
    return name


def get_node_embeddings(node_ids: list[str]) -> dict[str, list[float]]:
    """
    Compute sentence-transformer embeddings for every node's readable name.
    Returns: {node_id: [float, ...]}
    Vectors are unit-normalised (normalize_embeddings=True).
    """
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ImportError:
        sys.exit(
            "[1C] ERROR: sentence-transformers is not installed.\n"
            "       Run:  pip install sentence-transformers"
        )

    print(f"[1C] Loading sentence-transformer model '{EMBEDDING_MODEL}' ...")
    model = SentenceTransformer(EMBEDDING_MODEL)

    names = [node_name_from_id(nid) for nid in node_ids]
    print(f"[1C] Embedding {len(node_ids)} unique nodes ...")
    vectors = model.encode(names, show_progress_bar=True, normalize_embeddings=True)

    node_vectors: dict[str, list[float]] = {
        nid: vec.tolist() for nid, vec in zip(node_ids, vectors)
    }
    return node_vectors


# ---------------------------------------------------------------------------
# Step 2 – Path scoring (avg cosine similarity of adjacent node embeddings)
# ---------------------------------------------------------------------------
def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Dot product of two unit-normalised vectors == cosine similarity.
    sentence-transformers returns unit-normalised vectors when
    normalize_embeddings=True.
    """
    return sum(x * y for x, y in zip(a, b))


def score_path(nodes: list[str], node_vectors: dict[str, list[float]]) -> float:
    """
    Average cosine similarity over adjacent skill/concept node pairs in the path.

    The first node is always the user (e.g. u_alice). With text embeddings,
    sim(user_name, skill_name) is meaningless noise, so we skip the first hop
    and score only the skill-to-skill pairs: [n1, n2, ...].

    Path [n0, n1, n2, n3] -> avg( sim(n1,n2), sim(n2,n3) )
    Returns 0.0 if the path has fewer than 3 nodes (no skill-to-skill pair).
    """
    sims: list[float] = []
    for i in range(1, len(nodes) - 1):   # start at 1 to skip user -> first_skill
        a_id, b_id = nodes[i], nodes[i + 1]
        if a_id in node_vectors and b_id in node_vectors:
            sims.append(cosine_similarity(node_vectors[a_id], node_vectors[b_id]))
    return sum(sims) / len(sims) if sims else 0.0


# ---------------------------------------------------------------------------
# Steps 3 + 4 – Group paths by (user, item, rule) and sample top K
# ---------------------------------------------------------------------------
def group_and_sample(
    filtered_paths: list[dict],
    node_vectors: dict[str, list[float]],
    k: int = K,
) -> dict:
    """
    Groups all paths by (user, item, rule) and keeps the top-K by score.

    rule_key = comma-joined relation tuple, e.g. "interacts,prerequisite"
    (inverse relations like "prerequisite⁻¹" are kept as-is).

    Output shape (what Part 2 reads):
    {
      "<user>|<item>": {
        "<r1,r2,...>": [
          {"nodes": [...], "relations": [...], "score": float},
          ...    # at most K, sorted descending by score
        ]
      }
    }
    """
    # Score every path
    scored: list[dict] = []
    for entry in filtered_paths:
        user      = entry["user"]
        item      = entry["item"]
        nodes     = entry["nodes"]
        relations = entry["relations"]
        rule_key  = ",".join(relations)
        score     = score_path(nodes, node_vectors)
        scored.append({
            "user":      user,
            "item":      item,
            "nodes":     nodes,
            "relations": relations,
            "rule_key":  rule_key,
            "score":     score,
        })

    # Group by (user, item, rule_key)
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for s in scored:
        groups[(s["user"], s["item"], s["rule_key"])].append(s)

    # Sort within each group, keep top K
    sampled_paths: dict[str, dict[str, list[dict]]] = {}
    for (user, item, rule_key), paths in groups.items():
        pair_key = f"{user}|{item}"
        if pair_key not in sampled_paths:
            sampled_paths[pair_key] = {}

        top_k = sorted(paths, key=lambda p: p["score"], reverse=True)[:k]
        sampled_paths[pair_key][rule_key] = [
            {
                "nodes":     p["nodes"],
                "relations": p["relations"],
                "score":     p["score"],
            }
            for p in top_k
        ]

    return sampled_paths


# ---------------------------------------------------------------------------
# Step 6 – Leakage test
# ---------------------------------------------------------------------------
def leakage_test(sampled_paths: dict, test_pairs: list[dict]) -> None:
    """
    Verifies that no held-out (user, item) pair from test_pairs appears as
    a direct consecutive edge inside any sampled path.
    """
    if not test_pairs:
        print("[1C] Leakage test skipped – no test_pairs provided.")
        return

    held_out: set[tuple] = {(p["user"], p["item"]) for p in test_pairs}

    leaks: list[tuple] = []
    for pair_key, rules in sampled_paths.items():
        for rule_key, paths in rules.items():
            for path in paths:
                nodes = path["nodes"]
                for i in range(len(nodes) - 1):
                    edge     = (nodes[i], nodes[i + 1])
                    edge_rev = (nodes[i + 1], nodes[i])
                    if edge in held_out or edge_rev in held_out:
                        leaks.append((pair_key, rule_key, edge))

    if leaks:
        print(f"[1C] WARNING: LEAKAGE DETECTED – {len(leaks)} path(s) contain held-out edges:")
        for lk in leaks[:10]:
            print(f"      pair={lk[0]}  rule={lk[1]}  edge={lk[2]}")
    else:
        print("[1C] Leakage test PASSED – 0 held-out edges found in sampled paths.")


# ---------------------------------------------------------------------------
# Step 7 – Inspect top / bottom scoring path for one rule group
# ---------------------------------------------------------------------------
def inspect_one_rule(sampled_paths: dict) -> None:
    """
    Prints the top-scoring and lowest-scoring path for the first
    (user, item, rule) group that contains at least 2 paths.
    """
    for pair_key, rules in sampled_paths.items():
        for rule_key, paths in rules.items():
            if len(paths) >= 2:
                top    = paths[0]   # sorted descending, so first = highest
                bottom = paths[-1]

                def fmt(path: dict) -> str:
                    nodes_clean = [node_name_from_id(n) for n in path["nodes"]]
                    rels = path["relations"]
                    parts = [nodes_clean[0]]
                    for i, r in enumerate(rels):
                        parts.append(f"--[{r}]-->")
                        parts.append(nodes_clean[i + 1])
                    return " ".join(parts) + f"  (score={path['score']:.4f})"

                print(f"\n[1C] Inspection: pair={pair_key}  rule={rule_key}")
                print(f"  TOP   : {fmt(top)}")
                print(f"  BOTTOM: {fmt(bottom)}")
                return

    print("[1C] Inspection: no rule group has >= 2 paths – nothing to compare.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    # Step 0: Load inputs
    filtered_paths, test_pairs = load_inputs()
    print(f"[1C] {len(filtered_paths)} paths loaded.")

    # Step 1: Collect unique node IDs and compute embeddings
    all_node_ids: list[str] = sorted(
        {n for entry in filtered_paths for n in entry["nodes"]}
    )
    node_vectors: dict[str, list[float]] = get_node_embeddings(all_node_ids)

    # Write node_vectors.json  (Part 2 reuses these to initialise its embedding table)
    with NODE_VECTORS_FILE.open("w", encoding="utf-8") as f:
        json.dump(node_vectors, f, indent=2)
    print(f"[1C] node_vectors.json written ({len(node_vectors)} nodes) -> {NODE_VECTORS_FILE}")

    # Steps 2–4: Score paths, group by (user, item, rule), sample top K
    sampled_paths: dict = group_and_sample(filtered_paths, node_vectors, k=K)

    total_kept = sum(
        len(paths)
        for rules in sampled_paths.values()
        for paths in rules.values()
    )
    print(
        f"[1C] Sampling done – {len(sampled_paths)} (user, item) pairs, "
        f"{total_kept} total paths kept (K={K})."
    )

    # Step 5: Write sampled_paths.json
    with SAMPLED_PATHS_FILE.open("w", encoding="utf-8") as f:
        json.dump(sampled_paths, f, indent=2)
    print(f"[1C] sampled_paths.json written -> {SAMPLED_PATHS_FILE}")

    # Step 6: Leakage test
    leakage_test(sampled_paths, test_pairs)

    # Step 7: Inspect
    inspect_one_rule(sampled_paths)

    print("\n[1C] Done.")


if __name__ == "__main__":
    main()
