"""
Dev B: Local Context Awareness (Paper Sec 3.3, neighborhood-based representation).
Paper: Wu et al., Information Sciences 595 (2022).

Implements:
1. Extraction of neighborhoods V_u (items user interacts with) and V_v (users who interact with item).
2. Leakage Guard: strictly enforces exclusion of every pair in test_pairs.json.
3. Attention over neighbors:
   - score = a(W @ [e_u || e_v'])
   - atten = softmax(LeakyReLU(score))
   - e_ul = sigmoid(sum(atten * (W @ e_v')))
4. Symmetrical attention over item's user neighborhood to obtain e_vl.
5. Fallbacks: cold-start handling (has_local=False, zero vectors), neighborhood capping at NEIGHBOUR_CAP.
6. Entry point: build_local_repr(user, item) -> LocalRepr.
"""

from __future__ import annotations

from typing import Any

import torch
import torch.nn as nn

from part2_config import (
    ATTENTION_DIM,
    EMB_DIM,
    GRAPH_FILE,
    LEAKY_SLOPE,
    LSTM_HIDDEN_DIM,
    NEIGHBOUR_CAP,
    TEST_PAIRS_FILE,
)
from part2_data import (
    LocalRepr,
    build_embedding_table,
    load_graph_neighborhoods,
    load_node_vectors,
    load_test_pairs,
)


class NeighborAttention(nn.Module):
    """
    Attentional Neighbor Aggregation (Paper Sec 3.3, Eqs 16-18).
    Computes attention scores over 1-hop neighbors and aggregates them with a sigmoid activation.
    """

    def __init__(
        self,
        emb_dim: int = EMB_DIM,
        output_dim: int = 4 * LSTM_HIDDEN_DIM,
        attention_dim: int = ATTENTION_DIM,
        leaky_slope: float = LEAKY_SLOPE,
    ) -> None:
        super().__init__()
        self.emb_dim = emb_dim
        self.output_dim = output_dim
        self.leaky_slope = leaky_slope

        # W transformation projecting neighbor embeddings to output_dim (Eq 18)
        self.w_proj = nn.Linear(emb_dim, output_dim)

        # Mapping concatenated pair [e_target || e_neighbor] to scalar score (Eq 16)
        self.w_concat = nn.Linear(2 * emb_dim, attention_dim)
        self.leaky_relu = nn.LeakyReLU(negative_slope=leaky_slope)
        self.a = nn.Linear(attention_dim, 1, bias=False)

    def forward(
        self,
        target_emb: torch.Tensor,
        neighbor_embs: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            target_emb: Embedding of center node (e.g. e_u), shape (emb_dim,)
            neighbor_embs: Embeddings of neighbors (e.g. e_v'), shape (num_neighbors, emb_dim)
        Returns:
            e_local: Aggregated representation of shape (output_dim,)
            atten: Attention weights of shape (num_neighbors,)
        """
        num_neighbors = neighbor_embs.shape[0]
        if num_neighbors == 0:
            zeros = torch.zeros(
                self.output_dim,
                dtype=target_emb.dtype,
                device=target_emb.device,
            )
            empty_weights = torch.empty(0, dtype=target_emb.dtype, device=target_emb.device)
            return zeros, empty_weights

        # Expand target embedding to match all neighbors: (num_neighbors, emb_dim)
        target_expanded = target_emb.unsqueeze(0).expand(num_neighbors, -1)

        # Concatenate: [e_target || e_neighbor] of shape (num_neighbors, 2 * emb_dim)
        pair_features = torch.cat([target_expanded, neighbor_embs], dim=-1)

        # score = a(W @ [e_target || e_neighbor])
        hidden = self.w_concat(pair_features)  # (num_neighbors, attention_dim)
        raw_scores = self.a(hidden).squeeze(-1)  # (num_neighbors,)

        # atten = softmax(LeakyReLU(score)) (Eq 17)
        # Note: if num_neighbors == 1, softmax outputs strictly 1.0
        leaky_scores = self.leaky_relu(raw_scores)
        atten = torch.softmax(leaky_scores, dim=0)

        # W @ e_neighbor (Eq 18)
        proj_neighbors = self.w_proj(neighbor_embs)  # (num_neighbors, output_dim)

        # e_local = sigmoid( sum( atten * (W @ e_neighbor) ) ) (Eq 18)
        weighted_sum = torch.sum(atten.unsqueeze(-1) * proj_neighbors, dim=0)
        e_local = torch.sigmoid(weighted_sum)

        return e_local, atten


class LocalContextModel(nn.Module):
    """
    Full Local Context Awareness Module for Dev B (Paper Sec 3.3).
    Encapsulates 1-hop neighborhood lookup, leakage guard, neighbor capping, and attention.
    """

    def __init__(
        self,
        embedding: nn.Embedding,
        id_to_index: dict[str, int],
        user_to_items: dict[str, list[str]],
        item_to_users: dict[str, list[str]],
        test_pairs: set[tuple[str, str]] | None = None,
        emb_dim: int = EMB_DIM,
        output_dim: int = 4 * LSTM_HIDDEN_DIM,
        attention_dim: int = ATTENTION_DIM,
        neighbour_cap: int = NEIGHBOUR_CAP,
        leaky_slope: float = LEAKY_SLOPE,
    ) -> None:
        super().__init__()
        self.embedding = embedding
        self.id_to_index = id_to_index
        self.emb_dim = emb_dim
        self.output_dim = output_dim
        self.neighbour_cap = neighbour_cap
        self.test_pairs = test_pairs or set()

        # Enforce Leakage Guard on initial neighborhoods
        self.user_to_items = self._apply_leakage_guard(user_to_items, is_user_dict=True)
        self.item_to_users = self._apply_leakage_guard(item_to_users, is_user_dict=False)

        # Symmetrical neighbor attention modules
        self.user_neighbor_attn = NeighborAttention(
            emb_dim=emb_dim,
            output_dim=output_dim,
            attention_dim=attention_dim,
            leaky_slope=leaky_slope,
        )
        self.item_neighbor_attn = NeighborAttention(
            emb_dim=emb_dim,
            output_dim=output_dim,
            attention_dim=attention_dim,
            leaky_slope=leaky_slope,
        )

    def _apply_leakage_guard(
        self,
        neighborhoods: dict[str, list[str]],
        is_user_dict: bool,
    ) -> dict[str, list[str]]:
        """Strictly removes any held-out test pair from neighborhoods."""
        clean_dict: dict[str, list[str]] = {}
        for key, neighbors in neighborhoods.items():
            valid_neighbors: list[str] = []
            for nbr in neighbors:
                pair = (key, nbr) if is_user_dict else (nbr, key)
                if pair not in self.test_pairs:
                    valid_neighbors.append(nbr)
            clean_dict[key] = list(dict.fromkeys(valid_neighbors))
        return clean_dict

    def _lookup_embeddings(self, node_ids: list[str]) -> torch.Tensor:
        """Helper to look up embedding tensor for a list of node IDs."""
        indices = [self.id_to_index.get(nid, 0) for nid in node_ids]
        idx_tensor = torch.tensor(indices, dtype=torch.long)
        return self.embedding(idx_tensor)

    def get_user_neighbors(self, user: str) -> list[str]:
        """Returns capped list of items user u interacts with (V_u)."""
        raw = self.user_to_items.get(user, [])
        return raw[: self.neighbour_cap]

    def get_item_neighbors(self, item: str) -> list[str]:
        """Returns capped list of users who interact with item v (V_v)."""
        raw = self.item_to_users.get(item, [])
        return raw[: self.neighbour_cap]

    def build_local_repr(self, user: str, item: str) -> LocalRepr:
        """
        Entry point to construct LocalRepr for a (user, item) pair.
        Args:
            user: User node ID
            item: Item node ID
        Returns:
            LocalRepr dataclass with e_ul, e_vl, and has_local flag.
        """
        # Lookup user and item center embeddings
        u_idx = self.id_to_index.get(user, 0)
        v_idx = self.id_to_index.get(item, 0)
        e_u = self.embedding(torch.tensor(u_idx, dtype=torch.long))
        e_v = self.embedding(torch.tensor(v_idx, dtype=torch.long))

        # 1. User Local Context e_ul over V_u
        user_nbr_ids = self.get_user_neighbors(user)
        has_user_local = len(user_nbr_ids) > 0
        if has_user_local:
            nbr_embs_u = self._lookup_embeddings(user_nbr_ids)
            e_ul, _ = self.user_neighbor_attn(e_u, nbr_embs_u)
        else:
            e_ul = torch.zeros(self.output_dim, dtype=torch.float32)

        # 2. Item Local Context e_vl over V_v
        item_nbr_ids = self.get_item_neighbors(item)
        has_item_local = len(item_nbr_ids) > 0
        if has_item_local:
            nbr_embs_v = self._lookup_embeddings(item_nbr_ids)
            e_vl, _ = self.item_neighbor_attn(e_v, nbr_embs_v)
        else:
            e_vl = torch.zeros(self.output_dim, dtype=torch.float32)

        # has_local is True if at least one side had neighborhood context
        has_local = has_user_local or has_item_local

        return LocalRepr(
            user=e_ul,
            item=e_vl,
            has_local=has_local,
        )


# ---------------------------------------------------------------------------
# Convenience Factory to Build Dev B Model from Real Project Files
# ---------------------------------------------------------------------------
def create_local_context_model(
    node_vectors: dict[str, list[float]] | None = None,
    graph_file: str | None = None,
    test_pairs_file: str | None = None,
    emb_dim: int = EMB_DIM,
    output_dim: int = 4 * LSTM_HIDDEN_DIM,
    neighbour_cap: int = NEIGHBOUR_CAP,
) -> LocalContextModel:
    """Builds and returns initialized LocalContextModel ready for inference."""
    if node_vectors is None:
        node_vectors = load_node_vectors()

    embedding, id_to_index, _ = build_embedding_table(node_vectors, emb_dim=emb_dim)
    test_pairs = load_test_pairs(test_pairs_file or TEST_PAIRS_FILE)
    user_to_items, item_to_users = load_graph_neighborhoods(
        graph_file=graph_file or GRAPH_FILE,
        test_pairs=test_pairs,
    )

    model = LocalContextModel(
        embedding=embedding,
        id_to_index=id_to_index,
        user_to_items=user_to_items,
        item_to_users=item_to_users,
        test_pairs=test_pairs,
        emb_dim=emb_dim,
        output_dim=output_dim,
        neighbour_cap=neighbour_cap,
    )
    return model
