"""Focused tests for Part 1B rule counting and filtering."""

import json
import tempfile
import unittest
from pathlib import Path

from .part1b_rule_filtering import (
    count_rule_pairs,
    get_rule_connected_pairs,
    make_contingency_counts,
    run_part_1b,
)


class Part1BTests(unittest.TestCase):
    def setUp(self):
        self.graph = {
            "entities": {
                "u1": {"type": "user"},
                "u2": {"type": "user"},
                "a": {"type": "skill"},
                "b": {"type": "skill"},
                "c": {"type": "skill"},
            },
            "triples": [
                {"head": "u1", "relation": "interacts", "tail": "a"},
                {"head": "u1", "relation": "interacts", "tail": "b"},
                {"head": "u2", "relation": "interacts", "tail": "a"},
                {"head": "a", "relation": "related_to", "tail": "b"},
            ],
        }
        self.rule = ("interacts", "related_to")

    def test_rule_frequency_counts_distinct_pairs_not_path_count(self):
        paths = [
            {"user": "u1", "item": "b", "relations": list(self.rule)},
            {"user": "u1", "item": "b", "relations": list(self.rule)},
            {"user": "u2", "item": "b", "relations": list(self.rule)},
        ]
        self.assertEqual(count_rule_pairs(paths)[self.rule], {("u1", "b"), ("u2", "b")})

    def test_rule_search_finds_all_candidate_pairs_and_excludes_held_out_edges(self):
        pairs = get_rule_connected_pairs(
            self.graph, self.rule, ["u1", "u2"], ["a", "b", "c"], set()
        )
        self.assertEqual(pairs, {("u1", "b"), ("u2", "b")})
        without_u1_a = get_rule_connected_pairs(
            self.graph, self.rule, ["u1", "u2"], ["a", "b", "c"], {("u1", "a")}
        )
        self.assertEqual(without_u1_a, {("u2", "b")})

    def test_contingency_counts_follow_project_definitions(self):
        predicted = {("u1", "b"), ("u2", "b")}
        positives = {("u1", "a"), ("u1", "b"), ("u2", "a")}
        universe = {(user, item) for user in ("u1", "u2") for item in ("a", "b", "c")}
        self.assertEqual(
            make_contingency_counts(predicted, positives, universe),
            {"tp": 1, "fp": 2, "fn": 1, "tn": 2},
        )

    def test_full_run_writes_part1c_compatible_outputs(self):
        paths = [
            {
                "user": "u1",
                "item": "b",
                "nodes": ["u1", "a", "b"],
                "relations": list(self.rule),
            },
            {
                "user": "u2",
                "item": "b",
                "nodes": ["u2", "a", "b"],
                "relations": list(self.rule),
            },
        ]
        test_pairs = [{"user": "u1", "item": "b"}]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            for filename, data in (
                ("raw_paths.json", paths),
                ("test_pairs.json", test_pairs),
                ("sample_graph.json", self.graph),
            ):
                (root / filename).write_text(json.dumps(data), encoding="utf-8")
            summary = run_part_1b(
                root / "raw_paths.json",
                root / "test_pairs.json",
                root / "sample_graph.json",
                root,
                min_frequency=2,
            )
            filtered = json.loads((root / "filtered_paths.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["selected_filter"], "frequency")
            self.assertEqual(summary["candidate_user_item_pairs"], 5)
            self.assertEqual(summary["positive_interactions"], 2)
            self.assertEqual(filtered, paths)
            self.assertTrue((root / "rules.json").is_file())
            self.assertTrue((root / "rule_comparison.csv").is_file())


if __name__ == "__main__":
    unittest.main()
