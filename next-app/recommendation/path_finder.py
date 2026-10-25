"""
Part 1A: Rule Discovery & Path Finding (Wu et al. 2022, Sec 3.1.1)

Python version for teammates working in Python/Jupyter environments.
Reads sample_graph.json -> outputs raw_paths.json & test_pairs.json.
"""

import json
import os
import random
from collections import deque
from pathlib import Path

def run_part_1a(graph_path="sample_graph.json", output_dir=".", max_depth=3, max_paths_per_pair=200, holdout_ratio=0.2):
    base_dir = Path(__file__).parent if "__file__" in locals() else Path(".")
    resolved_graph = base_dir / graph_path
    target_dir = base_dir / output_dir

    with open(resolved_graph, "r", encoding="utf-8") as f:
        graph = json.load(f)

    entities = graph.get("entities", {})
    triples = graph.get("triples", [])

    # 1. Identify all interaction pairs (user, item)
    all_interactions = [
        {"user": t["head"], "item": t["tail"]}
        for t in triples if t["relation"] == "interacts"
    ]

    # 2. Holdout 20% test edges
    random.seed(42)
    shuffled = list(all_interactions)
    random.shuffle(shuffled)
    test_count = max(1, round(len(shuffled) * holdout_ratio))
    test_pairs = shuffled[:test_count]
    train_pairs = shuffled[test_count:]

    test_set = {f"{p['user']}__interacts__{p['item']}" for p in test_pairs}

    # 3. Build Adjacency List for train graph (forward r and inverse r⁻¹)
    adj = {k: [] for k in entities.keys()}
    for t in triples:
        key = f"{t['head']}__interacts__{t['tail']}"
        if key in test_set:
            continue

        head, rel, tail = t["head"], t["relation"], t["tail"]
        is_interacts = (rel == "interacts")

        adj.setdefault(head, []).append({
            "target": tail, "relation": rel, "is_direct": is_interacts
        })
        adj.setdefault(tail, []).append({
            "target": head, "relation": f"{rel}⁻¹", "is_direct": is_interacts
        })

    # 4. Search simple paths via BFS up to max_depth
    all_paths = []
    rule_counts = {}

    for pair in train_pairs:
        u, v = pair["user"], pair["item"]
        queue = deque([{"node": u, "visited": {u}, "nodes": [u], "relations": []}])
        paths_for_pair = 0

        while queue:
            curr = queue.popleft()
            if curr["node"] == v and len(curr["relations"]) > 0:
                all_paths.append({
                    "user": u,
                    "item": v,
                    "nodes": curr["nodes"],
                    "relations": curr["relations"]
                })
                rule_key = " ∧ ".join(curr["relations"])
                rule_counts[rule_key] = rule_counts.get(rule_key, 0) + 1
                paths_for_pair += 1
                if paths_for_pair >= max_paths_per_pair:
                    break
                continue

            if len(curr["relations"]) >= max_depth:
                continue

            for edge in adj.get(curr["node"], []):
                if curr["node"] == u and edge["target"] == v and edge["is_direct"]:
                    continue # Skip direct interaction edge being explained

                if edge["target"] not in curr["visited"]:
                    queue.append({
                        "node": edge["target"],
                        "visited": curr["visited"] | {edge["target"]},
                        "nodes": curr["nodes"] + [edge["target"]],
                        "relations": curr["relations"] + [edge["relation"]]
                    })

    # 5. Write outputs
    raw_paths_file = target_dir / "raw_paths.json"
    test_pairs_file = target_dir / "test_pairs.json"

    with open(raw_paths_file, "w", encoding="utf-8") as f:
        json.dump(all_paths, f, indent=2)

    with open(test_pairs_file, "w", encoding="utf-8") as f:
        json.dump(test_pairs, f, indent=2)

    print(f"[✓] Wrote {len(all_paths)} paths to {raw_paths_file}")
    print(f"[✓] Wrote {len(test_pairs)} test pairs to {test_pairs_file}")

    # 6. Sanity Check
    print("\n[Step 6 Sanity Check] Random paths:")
    sample = random.sample(all_paths, min(10, len(all_paths)))
    for i, p in enumerate(sample, 1):
        chain = " -> ".join(
            f"{entities.get(p['nodes'][j], {}).get('name', p['nodes'][j])} [{p['relations'][j]}]"
            for j in range(len(p["relations"]))
        ) + f" -> {entities.get(p['nodes'][-1], {}).get('name', p['nodes'][-1])}"
        print(f"Path #{i}: {chain}")

if __name__ == "__main__":
    run_part_1a()
