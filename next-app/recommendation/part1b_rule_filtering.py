"""Count and filter Part 1A rules using frequency and chi-square tests."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import warnings
from collections import defaultdict
from pathlib import Path
from typing import Any

from scipy.stats import chi2_contingency


HERE = Path(__file__).parent
DEFAULT_ALPHA = 0.05
DEFAULT_MIN_FREQUENCY = 2
INVERSE_SUFFIX = "⁻¹"


def load_json(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read valid JSON from {path}: {exc}") from exc


def validate_inputs(
    raw_paths: Any, test_pairs: Any, graph: Any
) -> tuple[list[dict[str, Any]], list[dict[str, str]], dict[str, Any]]:
    if not isinstance(raw_paths, list):
        raise ValueError("raw_paths.json must contain a JSON array.")
    if not isinstance(test_pairs, list):
        raise ValueError("test_pairs.json must contain a JSON array.")
    if not isinstance(graph, dict):
        raise ValueError("sample_graph.json must contain a JSON object.")

    entities = graph.get("entities")
    triples = graph.get("triples")
    if not isinstance(entities, dict) or not isinstance(triples, list):
        raise ValueError("Graph must contain an entities object and triples array.")

    for index, entry in enumerate(raw_paths):
        if (
            not isinstance(entry, dict)
            or not isinstance(entry.get("user"), str)
            or not isinstance(entry.get("item"), str)
            or not isinstance(entry.get("nodes"), list)
            or not isinstance(entry.get("relations"), list)
            or not entry["relations"]
            or len(entry["nodes"]) != len(entry["relations"]) + 1
            or not all(isinstance(node, str) for node in entry["nodes"])
            or not all(isinstance(relation, str) for relation in entry["relations"])
        ):
            raise ValueError(f"raw_paths.json entry {index} has an invalid path shape.")

    for index, pair in enumerate(test_pairs):
        if (
            not isinstance(pair, dict)
            or not isinstance(pair.get("user"), str)
            or not isinstance(pair.get("item"), str)
        ):
            raise ValueError(f"test_pairs.json entry {index} must contain user and item.")

    for index, triple in enumerate(triples):
        if (
            not isinstance(triple, dict)
            or not all(isinstance(triple.get(key), str) for key in ("head", "relation", "tail"))
        ):
            raise ValueError(f"Graph triple {index} must contain string head, relation, and tail.")

    return raw_paths, test_pairs, graph


def rule_key(relations: tuple[str, ...] | list[str]) -> str:
    return " ∧ ".join(relations)


def count_rule_pairs(
    raw_paths: list[dict[str, Any]],
) -> dict[tuple[str, ...], set[tuple[str, str]]]:
    pairs_by_rule: dict[tuple[str, ...], set[tuple[str, str]]] = defaultdict(set)
    for path in raw_paths:
        pairs_by_rule[tuple(path["relations"])].add((path["user"], path["item"]))
    return pairs_by_rule


def get_rule_connected_pairs(
    graph: dict[str, Any],
    rule: tuple[str, ...],
    users: list[str],
    items: list[str],
    held_out: set[tuple[str, str]],
) -> set[tuple[str, str]]:
    """Find every candidate pair connected by this exact relation sequence."""
    adjacency: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for triple in graph["triples"]:
        head, relation, tail = triple["head"], triple["relation"], triple["tail"]
        if relation == "interacts" and (head, tail) in held_out:
            continue
        adjacency[head].append((tail, relation))
        adjacency[tail].append((head, f"{relation}{INVERSE_SUFFIX}"))

    connected: set[tuple[str, str]] = set()
    for user in users:
        for item in items:
            frontier: set[tuple[str, frozenset[str]]] = {(user, frozenset((user,)))}
            for expected_relation in rule:
                next_frontier: set[tuple[str, frozenset[str]]] = set()
                for node, visited in frontier:
                    for target, relation in adjacency.get(node, []):
                        if relation == expected_relation and target not in visited:
                            next_frontier.add((target, visited | {target}))
                frontier = next_frontier
                if not frontier:
                    break
            if any(node == item for node, _ in frontier):
                connected.add((user, item))
    return connected


def make_contingency_counts(
    predicted: set[tuple[str, str]],
    positives: set[tuple[str, str]],
    all_pairs: set[tuple[str, str]],
) -> dict[str, int]:
    tp = len(predicted & positives)
    # Keep the fp/fn naming exactly as specified in the project hand-off:
    # fp is a missed interaction; fn is a rule match without an interaction.
    fp = len(positives - predicted)
    fn = len(predicted - positives)
    tn = len(all_pairs) - tp - fp - fn
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn}


def evaluate_rule(
    counts: dict[str, int], alpha: float
) -> dict[str, Any]:
    table = [[counts["tp"], counts["fp"]], [counts["fn"], counts["tn"]]]
    row_totals = [sum(row) for row in table]
    column_totals = [sum(table[row][column] for row in range(2)) for column in range(2)]
    total = sum(row_totals)
    expected = [
        [row_totals[row] * column_totals[column] / total for column in range(2)]
        for row in range(2)
    ] if total else [[0.0, 0.0], [0.0, 0.0]]
    has_zero_expected = any(value == 0 for row in expected for value in row)
    if has_zero_expected:
        return {
            "chi2": None,
            "p_value": None,
            "degrees_of_freedom": 1,
            "expected_counts": expected,
            "expected_count_below_5": any(value < 5 for row in expected for value in row),
            "chi_square_testable": False,
            "kept_by_chi_square": False,
        }

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        statistic, p_value, dof, scipy_expected = chi2_contingency(table)

    return {
        "chi2": float(statistic),
        "p_value": float(p_value),
        "degrees_of_freedom": int(dof),
        "expected_counts": scipy_expected.tolist(),
        "expected_count_below_5": bool((scipy_expected < 5).any()),
        "chi_square_testable": True,
        "chi_square_warnings": [str(warning.message) for warning in caught],
        "kept_by_chi_square": bool(p_value < alpha),
    }


def run_part_1b(
    raw_paths_path: Path = HERE / "raw_paths.json",
    test_pairs_path: Path = HERE / "test_pairs.json",
    graph_path: Path = HERE / "sample_graph.json",
    output_dir: Path = HERE,
    min_frequency: int = DEFAULT_MIN_FREQUENCY,
    alpha: float = DEFAULT_ALPHA,
) -> dict[str, Any]:
    if min_frequency < 1:
        raise ValueError("--min-frequency must be at least 1.")
    if not 0 < alpha < 1:
        raise ValueError("--alpha must be between 0 and 1.")

    raw_paths, test_pairs, graph = validate_inputs(
        load_json(raw_paths_path), load_json(test_pairs_path), load_json(graph_path)
    )
    entities = graph["entities"]
    users = sorted(node_id for node_id, entity in entities.items() if entity.get("type") == "user")
    items = sorted(node_id for node_id, entity in entities.items() if entity.get("type") != "user")
    if not users or not items:
        raise ValueError("Graph must contain at least one user and one non-user item entity.")

    all_pairs = {(user, item) for user in users for item in items}
    positives = {
        (triple["head"], triple["tail"])
        for triple in graph["triples"]
        if triple["relation"] == "interacts"
    }
    if not positives <= all_pairs:
        raise ValueError("Every interacts edge must connect a known user to a known item.")

    held_out = {(pair["user"], pair["item"]) for pair in test_pairs}
    if not held_out <= positives:
        raise ValueError("Every test pair must be an interacts edge in the graph.")
    all_pairs -= held_out
    positives -= held_out

    pairs_by_rule = count_rule_pairs(raw_paths)
    rule_results: list[dict[str, Any]] = []
    for rule in sorted(pairs_by_rule):
        rule_pairs_from_paths = pairs_by_rule[rule]
        connected_pairs = get_rule_connected_pairs(
            graph, rule, users, items, held_out
        ) & all_pairs
        counts = make_contingency_counts(connected_pairs, positives, all_pairs)
        frequency_kept = len(rule_pairs_from_paths) >= min_frequency
        test_result = evaluate_rule(counts, alpha)
        rule_results.append(
            {
                "rule": list(rule),
                "rule_text": rule_key(rule),
                "frequency": len(rule_pairs_from_paths),
                "graph_connected_pairs": len(connected_pairs),
                **counts,
                **test_result,
                "kept_by_frequency": frequency_kept,
            }
        )

    chi_square_rules = {
        tuple(rule["rule"])
        for rule in rule_results
        if rule["kept_by_chi_square"]
    }
    frequency_rules = {
        tuple(rule["rule"])
        for rule in rule_results
        if rule["kept_by_frequency"]
    }
    selected_method = "chi_square" if chi_square_rules else "frequency"
    selected_rules = chi_square_rules if chi_square_rules else frequency_rules
    for result in rule_results:
        result["kept_for_part2"] = tuple(result["rule"]) in selected_rules

    filtered_paths = [
        path
        for path in raw_paths
        if tuple(path["relations"]) in selected_rules
    ]
    summary = {
        "selected_filter": selected_method,
        "minimum_frequency": min_frequency,
        "alpha": alpha,
        "candidate_user_item_pairs": len(all_pairs),
        "total_user_item_pairs": len(users) * len(items),
        "positive_interactions": len(positives),
        "held_out_interactions_excluded_from_rule_search": len(held_out),
        "rule_count": len(rule_results),
        "selected_rule_count": len(selected_rules),
        "rules": rule_results,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "rules.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (output_dir / "filtered_paths.json").write_text(
        json.dumps(filtered_paths, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    write_comparison_csv(output_dir / "rule_comparison.csv", rule_results)

    low_expected = sum(rule["expected_count_below_5"] for rule in rule_results)
    print(
        f"[1B] Evaluated {len(rule_results)} rules across {len(all_pairs)} candidate pairs."
    )
    print(
        f"[1B] Selected {len(selected_rules)} rules using {selected_method}; "
        f"wrote {len(filtered_paths)} filtered paths."
    )
    print(f"[1B] Comparison table: {output_dir / 'rule_comparison.csv'}")
    if low_expected:
        print(
            f"[1B] Note: {low_expected} rule(s) have expected counts below 5; "
            "interpret chi-square p-values cautiously at this graph size."
        )
    if not chi_square_rules:
        print(
            "[1B] No rule passed chi-square at the requested alpha; "
            "filtered_paths.json uses the frequency threshold instead."
        )
    return summary


def write_comparison_csv(path: Path, rules: list[dict[str, Any]]) -> None:
    columns = [
        "rule_text",
        "frequency",
        "graph_connected_pairs",
        "tp",
        "fp",
        "fn",
        "tn",
        "chi2",
        "p_value",
        "expected_count_below_5",
        "kept_by_frequency",
        "kept_by_chi_square",
        "kept_for_part2",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        for rule in rules:
            writer.writerow({column: rule.get(column) for column in columns})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-paths", type=Path, default=HERE / "raw_paths.json")
    parser.add_argument("--test-pairs", type=Path, default=HERE / "test_pairs.json")
    parser.add_argument("--graph", type=Path, default=HERE / "sample_graph.json")
    parser.add_argument("--output-dir", type=Path, default=HERE)
    parser.add_argument("--min-frequency", type=int, default=DEFAULT_MIN_FREQUENCY)
    parser.add_argument("--alpha", type=float, default=DEFAULT_ALPHA)
    args = parser.parse_args()
    try:
        run_part_1b(
            args.raw_paths,
            args.test_pairs,
            args.graph,
            args.output_dir,
            args.min_frequency,
            args.alpha,
        )
    except (ValueError, OSError) as exc:
        print(f"[1B] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
