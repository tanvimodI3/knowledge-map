# Recommendation Pipeline: Parts 1A–1C

Part 1A finds user-to-skill paths, Part 1B counts and filters their relation rules, and Part 1C scores and samples the filtered paths.

## 1A: Rule Discovery & Path Finding

| File | Purpose |
| :--- | :--- |
| `path_finder.mjs` | Primary JavaScript/TypeScript (Node.js) execution for 1A. |
| `path_finder.py` | Python version for teammates working in Python or Jupyter environments. |
| `sample_graph.json` | Sample knowledge graph with users, skills, and multi-relational edges. |
| `raw_paths.json` | Input to 1B: discovered simple paths with their relation sequences. |
| `test_pairs.json` | Input to 1B and Part 3: held-out interaction edges. |

Run from `next-app`:

```powershell
node recommendation/path_finder.mjs
```

Alternatively, run the Python implementation:

```powershell
python recommendation/path_finder.py
```

## 1B: Rule Counting & Filtering

Install the Python dependency once, then run the filter from `next-app`:

```powershell
python -m pip install -r recommendation/requirements.txt
python recommendation/part1b_rule_filtering.py
```

The script reads `raw_paths.json`, `test_pairs.json`, and `sample_graph.json`, and writes:

- `rules.json`: per-rule distinct-pair frequency, contingency counts, chi-square statistic/p-value, and filter decisions.
- `rule_comparison.csv`: the comparison table for the report.
- `filtered_paths.json`: input for Part 1C, retaining paths whose rules passed chi-square, or frequency as a fallback if none passed chi-square.

Options `--min-frequency 2` and `--alpha 0.05` are the defaults. Paths are counted by distinct `(user, item)` pairs, not duplicate path rows. For chi-square, the script searches each relation sequence across every user × skill candidate pair in the graph, rather than treating pairs absent from positive-only `raw_paths.json` as rule negatives. Held-out interaction edges are removed from rule search and from the statistical test's labeled-pair universe, so the test set does not influence which rules survive.

The requested contingency-table naming is preserved: `fp` means an actual interaction missed by a rule, and `fn` means a rule-connected pair with no interaction. These labels are reversed from standard classification terminology; the chi-square p-value is unaffected by swapping those off-diagonal labels. Small graphs can have expected cell counts below 5, so interpret their p-values cautiously.

Focused tests:

```powershell
python -m unittest recommendation.test_part1b_rule_filtering
```

## 1C: Path Scoring & Sampling

Run after 1B to consume `filtered_paths.json`:

```powershell
python recommendation/part1c_path_scoring.py
```
