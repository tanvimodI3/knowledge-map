from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import patch

from . import live_path_recommendations


class LivePathRecommendationTests(unittest.TestCase):
    def test_returns_three_highest_scored_filtered_paths(self) -> None:
        paths = [
            {"user": "u", "item": "b", "nodes": ["u", "a", "b"], "relations": ["r", "r"]},
            {"user": "u", "item": "d", "nodes": ["u", "c", "d"], "relations": ["r", "r"]},
            {"user": "u", "item": "f", "nodes": ["u", "e", "f"], "relations": ["r", "r"]},
            {"user": "u", "item": "h", "nodes": ["u", "g", "h"], "relations": ["r", "r"]},
        ]
        payload = {
            "paths": paths,
            "testPairs": [],
            "graph": {
                "entities": {
                    node: {"name": node, "type": "user" if node == "u" else "skill"}
                    for node in ("u", "a", "b", "c", "d", "e", "f", "g", "h")
                },
                "triples": [],
            },
        }

        def filter_paths(
            _raw_paths: Path, _pairs: Path, _graph: Path, output: Path
        ) -> dict:
            (output / "filtered_paths.json").write_text(
                json.dumps(paths), encoding="utf-8"
            )
            return {"selected_filter": "frequency", "selected_rule_count": 1}

        vectors = {
            "a": [1.0],
            "b": [1.0],
            "c": [1.0],
            "d": [-1.0],
            "e": [0.0],
            "f": [0.0],
            "g": [1.0],
            "h": [0.0],
        }
        with (
            patch.object(live_path_recommendations, "run_part_1b", side_effect=filter_paths),
            patch.object(
                live_path_recommendations,
                "get_node_embeddings",
                return_value=vectors,
            ),
        ):
            result = live_path_recommendations.build_recommendation(payload)

        self.assertEqual(len(result["options"]), 3)
        self.assertEqual(result["options"][0]["item"], "b")
        self.assertEqual(
            [option["score"] for option in result["options"]],
            sorted((option["score"] for option in result["options"]), reverse=True),
        )
        self.assertEqual(result["summary"]["rawPathCount"], 4)
        self.assertEqual(result["summary"]["filteredPathCount"], 4)

    def test_empty_graph_returns_no_options(self) -> None:
        result = live_path_recommendations.build_recommendation(
            {"paths": [], "testPairs": [], "graph": {"entities": {}, "triples": []}}
        )
        self.assertEqual(result["options"], [])
        self.assertEqual(result["summary"]["rankedPathCount"], 0)


if __name__ == "__main__":
    unittest.main()
