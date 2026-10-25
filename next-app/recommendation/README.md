# Part 1A: Rule Discovery & Path Finding

Implementation of **Section 3.1.1** from *Knowledge graph-based multi-context-aware recommendation algorithm* (Wu et al., 2022).

---

## 1. Overview & Files

| File | Purpose |
| :--- | :--- |
| `path_finder.mjs` | Primary JavaScript/TypeScript (Node.js) execution for 1A. Works seamlessly inside Next.js. |
| `path_finder.py` | Python version for teammates working in Python or Jupyter Notebooks. |
| `sample_graph.json` | Sample Knowledge Graph with users, skills, and multi-relational edges. |
| `raw_paths.json` | **Output handed to 1B:** All discovered simple paths with their rule relations. |
| `test_pairs.json` | **Output handed to 1B/Part 3:** The held-out 20% test edges for evaluation. |

---

## 2. How to Run Part 1A

From the `next-app` directory:

```bash
node recommendation/path_finder.mjs
```

Or in Python:
```bash
python recommendation/path_finder.py
```

---

## 3. Hand-off Contract for 1B

Each entry in `raw_paths.json` adheres to the agreed format:

```json
{
  "user": "u_charlie",
  "item": "rag",
  "nodes": ["u_charlie", "python", "fastapi", "rag"],
  "relations": ["interacts", "prerequisite", "related_to"]
}
```

The `relations` array represents the candidate **Rule** (e.g. `interacts ∧ prerequisite ∧ related_to`).

Teammate 1B can now run their frequency filtering and $\chi^2$ credibility test directly on `raw_paths.json`!
