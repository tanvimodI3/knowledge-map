"""
Unit and integration tests for Dev B: Local Context Awareness (Paper Sec 3.3).
Tests:
1. Output shape equals expected dimension (4 * LSTM_HIDDEN_DIM).
2. Single neighbor receives attention weight strictly equal to 1.0.
3. Cold start pair (no neighbors) returns zero vectors with has_local=False.
4. Neighborhood cap (NEIGHBOUR_CAP) is respected when node has excess neighbors.
5. LEAKAGE TEST: strictly verifies that NO pair from test_pairs.json appears in any neighborhood.
6. Integration test with real project data (sample_graph.json & test_pairs.json).
"""

from __future__ import annotations

import unittest

import torch

from part2_config import EMB_DIM, GRAPH_FILE, LSTM_HIDDEN_DIM, NEIGHBOUR_CAP, TEST_PAIRS_FILE
from part2_data import (
    build_embedding_table,
    get_dummy_fixture,
    load_graph_neighborhoods,
    load_node_vectors,
    load_test_pairs,
)
from part2b_local_context import (
    LocalContextModel,
    NeighborAttention,
    create_local_context_model,
)


class TestLocalContextModel(unittest.TestCase):
    def setUp(self) -> None:
        torch.manual_seed(42)
        self.fixture = get_dummy_fixture(emb_dim=16)
        self.emb_dim = 16
        self.output_dim = 32

        embedding, id_to_index, _ = build_embedding_table(
            self.fixture["node_vectors"],
            emb_dim=self.emb_dim,
        )

        self.model = LocalContextModel(
            embedding=embedding,
            id_to_index=id_to_index,
            user_to_items=self.fixture["user_to_items"],
            item_to_users=self.fixture["item_to_users"],
            test_pairs=self.fixture["test_pairs"],
            emb_dim=self.emb_dim,
            output_dim=self.output_dim,
            neighbour_cap=NEIGHBOUR_CAP,
        )

    def test_single_neighbor_attention(self) -> None:
        """Test a node with a single neighbor receives attention weight equal to 1.0."""
        attn_module = NeighborAttention(
            emb_dim=self.emb_dim,
            output_dim=self.output_dim,
        )
        target = torch.randn(self.emb_dim)
        single_neighbor = torch.randn(1, self.emb_dim)

        e_local, atten = attn_module(target, single_neighbor)

        self.assertEqual(e_local.shape, (self.output_dim,))
        self.assertEqual(atten.shape, (1,))
        self.assertAlmostEqual(atten[0].item(), 1.0, places=5)
        # Verify sigmoid output range is (0, 1)
        self.assertTrue(torch.all(e_local >= 0.0) and torch.all(e_local <= 1.0))

    def test_cold_start_fallback(self) -> None:
        """Test cold-start pair (u3 has no items, s5 has no users) returns has_local=False."""
        repr_out = self.model.build_local_repr("u3", "s5")

        self.assertFalse(repr_out.has_local)
        self.assertEqual(repr_out.user.shape, (self.output_dim,))
        self.assertEqual(repr_out.item.shape, (self.output_dim,))
        self.assertTrue(torch.all(repr_out.user == 0))
        self.assertTrue(torch.all(repr_out.item == 0))

    def test_partial_cold_start(self) -> None:
        """Test pair where user has neighbors but item has none (or vice versa)."""
        # u1 has items ['s1', 's2'], but s5 has no users
        repr_out = self.model.build_local_repr("u1", "s5")

        self.assertTrue(repr_out.has_local)
        self.assertFalse(torch.all(repr_out.user == 0))
        self.assertTrue(torch.all(repr_out.item == 0))

    def test_neighbor_cap_respected(self) -> None:
        """Test cap is strictly enforced when a node has more than NEIGHBOUR_CAP neighbors."""
        small_cap = 3
        # Create user with 10 neighbors
        large_user_dict = {"u_large": [f"item_{i}" for i in range(10)]}
        large_item_dict = {"item_target": [f"user_{i}" for i in range(10)]}

        cap_model = LocalContextModel(
            embedding=self.model.embedding,
            id_to_index=self.model.id_to_index,
            user_to_items=large_user_dict,
            item_to_users=large_item_dict,
            emb_dim=self.emb_dim,
            output_dim=self.output_dim,
            neighbour_cap=small_cap,
        )

        user_nbrs = cap_model.get_user_neighbors("u_large")
        item_nbrs = cap_model.get_item_neighbors("item_target")

        self.assertEqual(len(user_nbrs), small_cap)
        self.assertEqual(len(item_nbrs), small_cap)

    def test_leakage_guard(self) -> None:
        """
        LEAKAGE TEST:
        Ensure that NO pair from test_pairs.json exists in user_to_items or item_to_users.
        """
        # Load real test pairs and real neighborhoods
        test_pairs = load_test_pairs(TEST_PAIRS_FILE)
        self.assertGreater(len(test_pairs), 0, "test_pairs.json should not be empty")

        user_to_items, item_to_users = load_graph_neighborhoods(
            graph_file=GRAPH_FILE,
            test_pairs=test_pairs,
        )

        # 1. Check user -> items
        for u, v in test_pairs:
            items_for_u = user_to_items.get(u, [])
            self.assertNotIn(
                v,
                items_for_u,
                f"Data leakage detected! Test pair ({u}, {v}) found in user neighborhood V_u.",
            )

        # 2. Check item -> users
        for u, v in test_pairs:
            users_for_v = item_to_users.get(v, [])
            self.assertNotIn(
                u,
                users_for_v,
                f"Data leakage detected! Test pair ({u}, {v}) found in item neighborhood V_v.",
            )

    def test_real_data_integration(self) -> None:
        """Integration test using real project files."""
        model = create_local_context_model(
            emb_dim=EMB_DIM,
            output_dim=4 * LSTM_HIDDEN_DIM,
            neighbour_cap=NEIGHBOUR_CAP,
        )

        # Test on active user and item from sample_graph
        repr_out = model.build_local_repr("u_alice", "neural_networks")
        self.assertTrue(repr_out.has_local)
        self.assertEqual(repr_out.user.shape, (4 * LSTM_HIDDEN_DIM,))
        self.assertEqual(repr_out.item.shape, (4 * LSTM_HIDDEN_DIM,))


if __name__ == "__main__":
    unittest.main()
