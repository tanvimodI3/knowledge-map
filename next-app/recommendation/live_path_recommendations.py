"""Filter and score paths discovered from a live knowledge map."""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

from part1b_rule_filtering import run_part_1b
from part1c_path_scoring import get_node_embeddings, score_path


def build_recommendation(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the existing 1B/1C algorithms against paths and graph supplied by the API."""
    raw_paths = payload.get("paths")
    test_pairs = payload.get("testPairs")
    graph = payload.get("graph")
    if not isinstance(raw_paths, list) or not isinstance(test_pairs, list) or not isinstance(graph, dict):
        raise ValueError("Expected paths, testPairs, and graph in the request.")

    entities = graph.get("entities")
    if not isinstance(entities, dict):
        raise ValueError("Graph entities must be an object.")
    if not raw_paths or not any(
        isinstance(entity, dict) and entity.get("type") != "user"
        for entity in entities.values()
    ):
        return {
            "options": [],
            "summary": {
                "rawPathCount": len(raw_paths),
                "filteredPathCount": 0,
                "selectedFilter": "frequency",
                "selectedRuleCount": 0,
                "rankedPathCount": 0,
            },
        }

    with tempfile.TemporaryDirectory(prefix="knowledge-map-paths-") as directory:
        work_dir = Path(directory)
        raw_paths_file = work_dir / "raw_paths.json"
        test_pairs_file = work_dir / "test_pairs.json"
        graph_file = work_dir / "graph.json"
        raw_paths_file.write_text(json.dumps(raw_paths), encoding="utf-8")
        test_pairs_file.write_text(json.dumps(test_pairs), encoding="utf-8")
        graph_file.write_text(json.dumps(graph), encoding="utf-8")

        with contextlib.redirect_stdout(io.StringIO()):
            filter_summary = run_part_1b(
                raw_paths_file,
                test_pairs_file,
                graph_file,
                work_dir,
            )
        filtered_paths = json.loads(
            (work_dir / "filtered_paths.json").read_text(encoding="utf-8")
        )

        node_ids = sorted({node for path in filtered_paths for node in path["nodes"]})
        node_names = {
            node_id: entity["name"]
            for node_id, entity in entities.items()
            if isinstance(entity, dict) and isinstance(entity.get("name"), str)
        }

        with contextlib.redirect_stdout(io.StringIO()):
            vectors = get_node_embeddings(node_ids, node_names)

        scored: list[dict[str, Any]] = []
        seen: set[str] = set()
        for path in filtered_paths:
            identity = json.dumps(
                [path["user"], path["item"], path["nodes"], path["relations"]],
                ensure_ascii=False,
                separators=(",", ":"),
            )
            path_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()
            if path_id in seen:
                continue
            seen.add(path_id)
            scored.append(
                {
                    "id": path_id,
                    "user": path["user"],
                    "item": path["item"],
                    "nodes": path["nodes"],
                    "relations": path["relations"],
                    "ruleKey": " ∧ ".join(path["relations"]),
                    "score": score_path(path["nodes"], vectors),
                }
            )

        scored.sort(key=lambda path: (-path["score"], path["id"]))
        return {
            "options": scored[:3],
            "summary": {
                "rawPathCount": len(raw_paths),
                "filteredPathCount": len(filtered_paths),
                "selectedFilter": filter_summary["selected_filter"],
                "selectedRuleCount": filter_summary["selected_rule_count"],
                "rankedPathCount": len(scored),
            },
        }


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    payload = json.load(sys.stdin)
    result = build_recommendation(payload)
    json.dump(result, sys.stdout, ensure_ascii=False, allow_nan=False)


if __name__ == "__main__":
    main()
