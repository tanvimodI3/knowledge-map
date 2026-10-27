"""
Configuration settings for Part 2: Global + Local Context Awareness (MANN model).
Paper: Wu et al., Information Sciences 595 (2022).
"""

from pathlib import Path

# Paths
HERE = Path(__file__).parent
GRAPH_FILE = HERE / "sample_graph.json"
SAMPLED_PATHS_FILE = HERE / "sampled_paths.json"
NODE_VECTORS_FILE = HERE / "node_vectors.json"
RULES_FILE = HERE / "rules.json"
TEST_PAIRS_FILE = HERE / "test_pairs.json"
SUGGESTIONS_FILE = HERE / "suggestions.json"

# Model hyperparameters
# EMB_DIM defaults to 384 to match node_vectors.json (generated via all-MiniLM-L6-v2)
EMB_DIM = 384
K_PATHS = 5
NEIGHBOUR_CAP = 20
LEAKY_SLOPE = 0.2
AGGREGATOR = "concat"  # "sum" | "maxpool" | "concat"
SEED = 42

# Bi-LSTM settings (Section 3.2.1)
# LSTM_HIDDEN_DIM per direction (bidirectional output dimension = 2 * LSTM_HIDDEN_DIM)
LSTM_HIDDEN_DIM = 64
ATTENTION_DIM = 32

# Pooling methods: 'mean' or 'max'
PATH_POOLING = "mean"
RULE_POOLING = "mean"
