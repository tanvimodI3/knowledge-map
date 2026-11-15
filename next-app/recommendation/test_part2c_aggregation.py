"""
Unit tests for Representation Aggregation (Paper Sec 3.4.1).
Tests:
1. All three aggregators ('concat', 'sum', 'maxpool') produce valid scores in [0.0, 1.0].
2. Output user and item vectors have correct shape (dim,).
3. Fallback when has_global=False (only local) works without feeding zero tensors.
4. Fallback when has_local=False (only global) works without feeding zero tensors.
5. Total cold-start (both false) returns score 0.0 and zero vectors.
6. Gradients propagate properly (modules are trainable).
"""

from __future__ import annotations

import unittest

import torch

from part2_data import GlobalRepr, LocalRepr
from part2c_aggregation import ContextAggregator


class TestContextAggregator(unittest.TestCase):
    def setUp(self) -> None:
        torch.manual_seed(42)
        self.dim = 32
        self.aggregator = ContextAggregator(dim=self.dim, aggregator_type="concat")

        self.global_repr = GlobalRepr(
            user=torch.randn(self.dim),
            item=torch.randn(self.dim),
            has_global=True,
            attention_weights={"rule1": 1.0},
            top_rule="rule1",
        )

        self.local_repr = LocalRepr(
            user=torch.randn(self.dim),
            item=torch.randn(self.dim),
            has_local=True,
        )

    def test_three_aggregators_produce_valid_scores(self) -> None:
        """Test concat, sum, and maxpool all produce valid shapes and scores in [0.0, 1.0]."""
        for mode in ["concat", "sum", "maxpool"]:
            out = self.aggregator(
                self.global_repr,
                self.local_repr,
                override_aggregator=mode,
            )
            self.assertTrue(out.has_global)
            self.assertTrue(out.has_local)
            self.assertEqual(out.user.shape, (self.dim,))
            self.assertEqual(out.item.shape, (self.dim,))
            self.assertGreaterEqual(out.score, 0.0)
            self.assertLessEqual(out.score, 1.0)

    def test_fallback_global_only(self) -> None:
        """Test fallback when has_local is False."""
        local_empty = LocalRepr(
            user=torch.zeros(self.dim),
            item=torch.zeros(self.dim),
            has_local=False,
        )

        out = self.aggregator(self.global_repr, local_empty)
        self.assertTrue(out.has_global)
        self.assertFalse(out.has_local)
        self.assertEqual(out.user.shape, (self.dim,))
        self.assertEqual(out.item.shape, (self.dim,))
        self.assertGreater(out.score, 0.0)

    def test_fallback_local_only(self) -> None:
        """Test fallback when has_global is False."""
        global_empty = GlobalRepr(
            user=torch.zeros(self.dim),
            item=torch.zeros(self.dim),
            has_global=False,
        )

        out = self.aggregator(global_empty, self.local_repr)
        self.assertFalse(out.has_global)
        self.assertTrue(out.has_local)
        self.assertEqual(out.user.shape, (self.dim,))
        self.assertEqual(out.item.shape, (self.dim,))
        self.assertGreater(out.score, 0.0)

    def test_total_cold_start_both_false(self) -> None:
        """Test fallback when neither context is available."""
        global_empty = GlobalRepr(
            user=torch.zeros(self.dim),
            item=torch.zeros(self.dim),
            has_global=False,
        )
        local_empty = LocalRepr(
            user=torch.zeros(self.dim),
            item=torch.zeros(self.dim),
            has_local=False,
        )

        out = self.aggregator(global_empty, local_empty)
        self.assertFalse(out.has_global)
        self.assertFalse(out.has_local)
        self.assertEqual(out.score, 0.0)
        self.assertTrue(torch.all(out.user == 0))
        self.assertTrue(torch.all(out.item == 0))

    def test_gradient_propagation(self) -> None:
        """Test that gradients flow through the aggregator (trainable module)."""
        g_repr = GlobalRepr(
            user=torch.randn(self.dim, requires_grad=True),
            item=torch.randn(self.dim, requires_grad=True),
            has_global=True,
        )
        l_repr = LocalRepr(
            user=torch.randn(self.dim, requires_grad=True),
            item=torch.randn(self.dim, requires_grad=True),
            has_local=True,
        )

        # Forward pass in concat mode
        out = self.aggregator(g_repr, l_repr, override_aggregator="concat")
        # Run backward on the concatenated vector
        loss = torch.sum(out.user) + torch.sum(out.item)
        loss.backward()

        self.assertIsNotNone(g_repr.user.grad)
        self.assertIsNotNone(l_repr.user.grad)


if __name__ == "__main__":
    unittest.main()
