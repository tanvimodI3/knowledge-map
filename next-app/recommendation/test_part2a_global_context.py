"""
Unit and integration tests for Dev A: Global Context Awareness (Paper Sec 3.2).
Tests:
1. Output shape equals expected dimension (4 * LSTM_HIDDEN_DIM).
2. Single-path rule works and produces valid representation.
3. Fully masked pair (cold-start) returns zeros and has_global=False.
4. Attention weights sum to 1.0 over active (unmasked) rules.
5. Inactive rules receive 0 attention weight.
6. Integration test with real project data (sampled_paths.json & node_vectors.json).
"""

from __future__ import annotations

import unittest
from pathlib import Path

import torch

from part2_config import EMB_DIM, LSTM_HIDDEN_DIM
from part2_data import (
    build_embedding_table,
    get_dummy_fixture,
    load_node_vectors,
    load_rules,
    load_sampled_paths,
)
from part2a_global_context import (
    BiLSTMPathEncoder,
    GlobalContextModel,
    MultiRuleAttention,
    create_global_context_model,
)


class TestGlobalContextModel(unittest.TestCase):
    def setUp(self) -> None:
        torch.manual_seed(42)
        self.fixture = get_dummy_fixture(emb_dim=16)
        self.emb_dim = 16
        self.hidden_dim = 8
        self.expected_output_dim = 4 * self.hidden_dim  # 32

        embedding, id_to_index, _ = build_embedding_table(
            self.fixture["node_vectors"],
            emb_dim=self.emb_dim,
        )

        self.model = GlobalContextModel(
            embedding=embedding,
            id_to_index=id_to_index,
            all_rules=self.fixture["rules"],
            emb_dim=self.emb_dim,
            lstm_hidden_dim=self.hidden_dim,
        )

    def test_bilstm_path_encoder_shapes(self) -> None:
        """Test BiLSTM path encoder produces expected 4 * hidden_dim shape."""
        encoder = BiLSTMPathEncoder(emb_dim=self.emb_dim, hidden_dim=self.hidden_dim)
        dummy_nodes = torch.randn(4, self.emb_dim)  # path with 4 nodes

        e_up, e_vp = encoder(dummy_nodes)
        self.assertEqual(e_up.shape, (self.expected_output_dim,))
        self.assertEqual(e_vp.shape, (self.expected_output_dim,))

    def test_single_path_rule(self) -> None:
        """Test a pair with a single path under one rule."""
        paths = {
            "interacts,prerequisite": [["u1", "s2", "s1"]],
        }
        repr_out = self.model.build_global_repr("u1", "s1", paths)

        self.assertTrue(repr_out.has_global)
        self.assertEqual(repr_out.user.shape, (self.expected_output_dim,))
        self.assertEqual(repr_out.item.shape, (self.expected_output_dim,))
        self.assertIsNotNone(repr_out.top_rule)
        self.assertEqual(repr_out.top_rule, "interacts,prerequisite")

        # When only 1 rule is active, its attention weight should be 1.0
        self.assertIn("interacts,prerequisite", repr_out.attention_weights)
        self.assertAlmostEqual(repr_out.attention_weights["interacts,prerequisite"], 1.0, places=4)

    def test_fully_masked_pair_cold_start(self) -> None:
        """Test a pair with no paths returns zeros and has_global=False."""
        empty_paths = {}
        repr_out = self.model.build_global_repr("u3", "s5", empty_paths)

        self.assertFalse(repr_out.has_global)
        self.assertEqual(repr_out.user.shape, (self.expected_output_dim,))
        self.assertEqual(repr_out.item.shape, (self.expected_output_dim,))
        self.assertTrue(torch.all(repr_out.user == 0))
        self.assertTrue(torch.all(repr_out.item == 0))
        self.assertIsNone(repr_out.top_rule)
        self.assertEqual(repr_out.attention_weights, {})

    def test_attention_weights_sum_to_one(self) -> None:
        """Test attention weights sum to 1.0 across active unmasked rules."""
        paths = {
            "interacts,prerequisite": [["u1", "s2", "s1"]],
            "interacts,related_to": [["u1", "w1", "s1"]],
        }
        repr_out = self.model.build_global_repr("u1", "s1", paths)

        self.assertTrue(repr_out.has_global)
        self.assertEqual(len(repr_out.attention_weights), 2)

        # Sum of active attention weights must equal 1.0
        total_weight = sum(repr_out.attention_weights.values())
        self.assertAlmostEqual(total_weight, 1.0, places=3)

    def test_multi_rule_attention_masking(self) -> None:
        """Test MultiRuleAttention zero-masks inactive rules."""
        attn_module = MultiRuleAttention(input_dim=self.expected_output_dim)
        rule_vectors = torch.randn(3, self.expected_output_dim)
        # Only rule index 0 and 2 are active
        mask = torch.tensor([True, False, True])

        aggregated, weights = attn_module(rule_vectors, mask)
        self.assertEqual(aggregated.shape, (self.expected_output_dim,))
        self.assertEqual(weights[1].item(), 0.0)  # Inactive rule must be 0
        self.assertAlmostEqual(weights.sum().item(), 1.0, places=4)

    def test_real_data_integration(self) -> None:
        """Integration test using real project files in recommendation/."""
        sampled = load_sampled_paths()
        vectors = load_node_vectors()
        rules = load_rules()

        real_model = create_global_context_model(
            node_vectors=vectors,
            rules=rules,
            emb_dim=len(next(iter(vectors.values()))),
            lstm_hidden_dim=LSTM_HIDDEN_DIM,
        )

        # Test on an actual pair from sampled_paths.json
        test_pair = next(iter(sampled.keys()))
        u, v = test_pair
        paths_dict = sampled[test_pair]

        repr_out = real_model.build_global_repr(u, v, paths_dict)
        self.assertTrue(repr_out.has_global)
        self.assertEqual(repr_out.user.shape, (4 * LSTM_HIDDEN_DIM,))
        self.assertEqual(repr_out.item.shape, (4 * LSTM_HIDDEN_DIM,))
        self.assertIsNotNone(repr_out.top_rule)
        self.assertGreater(len(repr_out.attention_weights), 0)


if __name__ == "__main__":
    unittest.main()
