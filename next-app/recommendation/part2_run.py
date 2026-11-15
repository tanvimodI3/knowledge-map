"""
Part 2 Pipeline Runner: runs Global + Local context awareness,
aggregates representations, scores unlearned candidate items,
ranks them, and writes suggestions.json.

Paper: Wu et al., Information Sciences 595 (2022).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import torch

from part2_config import (
    AGGREGATOR,
    EMB_DIM,
    GRAPH_FILE,
    LSTM_HIDDEN_DIM,
    NEIGHBOUR_CAP,
    SEED,
    SUGGESTIONS_FILE,
    TEST_PAIRS_FILE,
)
from part2_data import (
    load_graph_neighborhoods,
    load_node_vectors,
    load_rules,
    load_sampled_paths,
    load_test_pairs,
)
from part2a_global_context import create_global_context_model
from part2b_local_context import create_local_context_model
from part2c_aggregation import ContextAggregator


def run_recommendation_pipeline(
    graph_path: Path | str = GRAPH_FILE,
    output_path: Path | str = SUGGESTIONS_FILE,
    aggregator_type: str = AGGREGATOR,
    seed: int = SEED,
) -> dict[str, list[dict[str, Any]]]:
    """
    Runs full MANN inference across all users:
    1. Loads graph and splits.
    2. Instantiates Global, Local, and Aggregator models.
    3. Identifies candidate items (items user does not already have).
    4. Computes scores, ranks candidates, and exports suggestions.json.
    """
    torch.manual_seed(seed)

    print("\n=======================================================")
    print("[Part 2] Running MANN Recommendation Pipeline")
    print("=======================================================")

    # 1. Load data
    with open(graph_path, "r", encoding="utf-8") as f:
        graph_data = json.load(f)

    entities: dict[str, dict[str, str]] = graph_data.get("entities", {})
    all_users = [k for k, v in entities.items() if v.get("type") == "user"]
    all_skills = [k for k, v in entities.items() if v.get("type") != "user"]

    sampled_paths = load_sampled_paths()
    node_vectors = load_node_vectors()
    rules = load_rules()
    test_pairs = load_test_pairs(TEST_PAIRS_FILE)
    user_to_items, _ = load_graph_neighborhoods(graph_path, test_pairs)

    actual_emb_dim = len(next(iter(node_vectors.values())))
    output_dim = 4 * LSTM_HIDDEN_DIM

    print(f"- Total Users:       {len(all_users)}")
    print(f"- Total Skills:      {len(all_skills)}")
    print(f"- Embedding Dim:     {actual_emb_dim}")
    print(f"- Representation:    {output_dim}")
    print(f"- Aggregator:        {aggregator_type.upper()}")

    # 2. Build Models
    global_model = create_global_context_model(
        node_vectors=node_vectors,
        rules=rules,
        emb_dim=actual_emb_dim,
        lstm_hidden_dim=LSTM_HIDDEN_DIM,
    )
    global_model.eval()

    local_model = create_local_context_model(
        node_vectors=node_vectors,
        graph_file=str(graph_path),
        test_pairs_file=str(TEST_PAIRS_FILE),
        emb_dim=actual_emb_dim,
        output_dim=output_dim,
        neighbour_cap=NEIGHBOUR_CAP,
    )
    local_model.eval()

    aggregator = ContextAggregator(
        dim=output_dim,
        aggregator_type=aggregator_type,  # type: ignore
    )
    aggregator.eval()

    # 3. Score candidates for each user
    suggestions: dict[str, list[dict[str, Any]]] = {}

    with torch.no_grad():
        for user_id in all_users:
            known_items = set(user_to_items.get(user_id, []))
            candidate_skills = [s for s in all_skills if s not in known_items]
            user_suggestions: list[dict[str, Any]] = []

            for item_id in candidate_skills:
                # 1. Dev A: Global Context
                paths_for_pair = sampled_paths.get((user_id, item_id), {})
                global_repr = global_model.build_global_repr(
                    user=user_id,
                    item=item_id,
                    rule_paths=paths_for_pair,
                )

                # 2. Dev B: Local Context
                local_repr = local_model.build_local_repr(
                    user=user_id,
                    item=item_id,
                )

                # 3. Joint: Representation Aggregation
                agg_out = aggregator(
                    global_repr,
                    local_repr,
                    override_aggregator=aggregator_type,  # type: ignore
                )

                item_name = entities.get(item_id, {}).get("name", item_id)
                user_suggestions.append({
                    "item": item_id,
                    "name": item_name,
                    "score": agg_out.score,
                    "topRule": global_repr.top_rule or "none",
                    "hasGlobal": agg_out.has_global,
                    "hasLocal": agg_out.has_local,
                })

            # Sort by predicted probability descending
            user_suggestions.sort(key=lambda x: x["score"], reverse=True)
            suggestions[user_id] = user_suggestions

    # 4. Write output file
    out_file = Path(output_path)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(suggestions, f, indent=2)

    print(f"\n[OK] Successfully wrote ranked suggestions to: {out_file}")

    # 5. Print Summary of Top Recommendations
    print("\n-------------------------------------------------------")
    print("Top Recommendations Per User:")
    print("-------------------------------------------------------")
    for user_id, recs in suggestions.items():
        user_name = entities.get(user_id, {}).get("name", user_id)
        print(f"\nUser: {user_name} ({user_id}):")
        for rank, rec in enumerate(recs[:3], start=1):
            rule_str = f" [via {rec['topRule']}]" if rec["topRule"] != "none" else ""
            print(
                f"   {rank}. {rec['name']} (score: {rec['score']:.4f}){rule_str}"
            )

    return suggestions


if __name__ == "__main__":
    run_recommendation_pipeline()
