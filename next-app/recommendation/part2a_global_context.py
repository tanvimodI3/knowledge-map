"""
Dev A: Global Context Awareness (Paper Sec 3.2, rule-based path representation).
Paper: Wu et al., Information Sciences 595 (2022).

Implements:
1. Embedding lookup from shared table.
2. Bi-LSTM path representation (Sec 3.2.1) -> e_up, e_vp.
3. Rule-based path pooling (Sec 3.2.2) -> e_ur, e_vr per rule.
4. Multi-rule attention mechanism with masking (Sec 3.2.3) -> final e_ur, e_vr.
5. Explainability: outputs attention weights and top_rule for the UI.
6. Fallbacks: handles masked rules and cold-start pairs (has_global=False).
"""

from __future__ import annotations

from typing import Any

import torch
import torch.nn as nn

from part2_config import (
    ATTENTION_DIM,
    EMB_DIM,
    K_PATHS,
    LEAKY_SLOPE,
    LSTM_HIDDEN_DIM,
    PATH_POOLING,
    RULE_POOLING,
)
from part2_data import (
    GlobalRepr,
    build_embedding_table,
    load_node_vectors,
    load_rules,
    load_sampled_paths,
)


class BiLSTMPathEncoder(nn.Module):
    """
    Bi-LSTM Path Encoder (Paper Sec 3.2.1).
    Encodes sequence of node embeddings along a path forwards and backwards.
    """

    def __init__(
        self,
        emb_dim: int = EMB_DIM,
        hidden_dim: int = LSTM_HIDDEN_DIM,
        pooling: str = PATH_POOLING,
    ) -> None:
        super().__init__()
        self.emb_dim = emb_dim
        self.hidden_dim = hidden_dim
        self.pooling = pooling.lower()

        # Bidirectional LSTM over node sequence
        self.lstm = nn.LSTM(
            input_size=emb_dim,
            hidden_size=hidden_dim,
            batch_first=True,
            bidirectional=True,
        )

        # Output dimension: h_node (2 * hidden_dim) + e_p (2 * hidden_dim) = 4 * hidden_dim
        self.output_dim = 4 * hidden_dim

    def forward(
        self,
        node_embeddings: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            node_embeddings: Tensor of shape (seq_len, emb_dim)
        Returns:
            e_up: [h_u || e_p] of shape (4 * hidden_dim,)
            e_vp: [h_v || e_p] of shape (4 * hidden_dim,)
        """
        # Batch dimension: (1, seq_len, emb_dim)
        x = node_embeddings.unsqueeze(0)
        lstm_out, _ = self.lstm(x)  # shape (1, seq_len, 2 * hidden_dim)
        h = lstm_out.squeeze(0)     # shape (seq_len, 2 * hidden_dim)

        h_u = h[0]   # hidden state of start node (user)
        h_v = h[-1]  # hidden state of end node (item)

        # Pool hidden states across the path to obtain e_p
        if self.pooling == "max":
            e_p, _ = torch.max(h, dim=0)
        else:
            e_p = torch.mean(h, dim=0)

        # Concatenate start/end node states with path vector e_p
        e_up = torch.cat([h_u, e_p], dim=-1)
        e_vp = torch.cat([h_v, e_p], dim=-1)

        return e_up, e_vp


class MultiRuleAttention(nn.Module):
    """
    Multi-rule Attention Mechanism (Paper Sec 3.2.3).
    Differentiates the importance of different rules in reflecting user preference.
    """

    def __init__(
        self,
        input_dim: int,
        attention_dim: int = ATTENTION_DIM,
        leaky_slope: float = LEAKY_SLOPE,
    ) -> None:
        super().__init__()
        self.w1 = nn.Linear(input_dim, attention_dim)
        self.leaky_relu = nn.LeakyReLU(negative_slope=leaky_slope)
        self.w2 = nn.Linear(attention_dim, 1, bias=False)

    def forward(
        self,
        rule_vectors: torch.Tensor,
        mask: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            rule_vectors: Matrix E of shape (num_rules, input_dim)
            mask: Bool tensor of shape (num_rules,) where True indicates active rule
        Returns:
            aggregated: Weighted sum vector of shape (input_dim,)
            atten_weights: Normalized attention weights of shape (num_rules,)
        """
        # If no active rules, return zeros
        if not mask.any():
            zeros = torch.zeros(
                rule_vectors.shape[-1],
                dtype=rule_vectors.dtype,
                device=rule_vectors.device,
            )
            zero_weights = torch.zeros(
                len(mask),
                dtype=rule_vectors.dtype,
                device=rule_vectors.device,
            )
            return zeros, zero_weights

        # score = LeakyReLU(W1 @ E)
        hidden = self.leaky_relu(self.w1(rule_vectors))  # (num_rules, attention_dim)
        raw_scores = self.w2(hidden).squeeze(-1)         # (num_rules,)

        # Mask inactive rules by setting to large negative value before softmax
        masked_scores = torch.where(
            mask,
            raw_scores,
            torch.tensor(-1e9, dtype=raw_scores.dtype, device=raw_scores.device),
        )

        atten_weights = torch.softmax(masked_scores, dim=-1)
        # Multiply attention weights with rule representations
        aggregated = torch.sum(atten_weights.unsqueeze(-1) * rule_vectors, dim=0)

        return aggregated, atten_weights


class GlobalContextModel(nn.Module):
    """
    Full Global Context Awareness Module for Dev A (Paper Sec 3.2).
    Integrates embedding table, Bi-LSTM path encoder, rule pooling, and attention.
    """

    def __init__(
        self,
        embedding: nn.Embedding,
        id_to_index: dict[str, int],
        all_rules: list[str],
        emb_dim: int = EMB_DIM,
        lstm_hidden_dim: int = LSTM_HIDDEN_DIM,
        attention_dim: int = ATTENTION_DIM,
        k_paths: int = K_PATHS,
        path_pooling: str = PATH_POOLING,
        rule_pooling: str = RULE_POOLING,
    ) -> None:
        super().__init__()
        self.embedding = embedding
        self.id_to_index = id_to_index
        self.all_rules = all_rules
        self.rule_to_idx = {r: i for i, r in enumerate(all_rules)}
        self.k_paths = k_paths
        self.rule_pooling = rule_pooling.lower()

        # Output dimension: 4 * lstm_hidden_dim
        self.path_encoder = BiLSTMPathEncoder(
            emb_dim=emb_dim,
            hidden_dim=lstm_hidden_dim,
            pooling=path_pooling,
        )
        self.output_dim = self.path_encoder.output_dim

        # Separate attention for user and item as described in paper Eq 13-15
        self.user_attention = MultiRuleAttention(
            input_dim=self.output_dim,
            attention_dim=attention_dim,
        )
        self.item_attention = MultiRuleAttention(
            input_dim=self.output_dim,
            attention_dim=attention_dim,
        )

    def _lookup_path_embeddings(self, node_ids: list[str]) -> torch.Tensor:
        """Looks up embedding vectors for a list of node IDs."""
        indices = [self.id_to_index.get(nid, 0) for nid in node_ids]
        idx_tensor = torch.tensor(indices, dtype=torch.long)
        return self.embedding(idx_tensor)

    def build_global_repr(
        self,
        user: str,
        item: str,
        rule_paths: dict[str, list[list[str]]] | None = None,
    ) -> GlobalRepr:
        """
        Entry point to construct GlobalRepr for a (user, item) pair.
        Args:
            user: User node ID
            item: Target item node ID
            rule_paths: dict of rule_key -> list of paths (each path is a list of node IDs)
        Returns:
            GlobalRepr dataclass with user tensor, item tensor, and explainability info.
        """
        num_rules = len(self.all_rules)

        if not rule_paths or not any(rule_paths.values()):
            # Fallback: pair has no paths / cold-start
            zeros = torch.zeros(self.output_dim, dtype=torch.float32)
            return GlobalRepr(
                user=zeros,
                item=zeros,
                has_global=False,
                attention_weights={},
                top_rule=None,
            )

        # Pre-allocate rule embedding matrices E_u, E_v and rule mask
        e_u_rules = torch.zeros((num_rules, self.output_dim), dtype=torch.float32)
        e_v_rules = torch.zeros((num_rules, self.output_dim), dtype=torch.float32)
        mask = torch.zeros(num_rules, dtype=torch.bool)

        for rule_key, paths in rule_paths.items():
            if rule_key not in self.rule_to_idx or not paths:
                continue

            r_idx = self.rule_to_idx[rule_key]
            # Cap at K paths per rule (Sec 3.1.3)
            sampled = paths[: self.k_paths]

            e_up_list: list[torch.Tensor] = []
            e_vp_list: list[torch.Tensor] = []

            for p_nodes in sampled:
                if len(p_nodes) < 2:
                    continue
                path_embs = self._lookup_path_embeddings(p_nodes)
                e_up, e_vp = self.path_encoder(path_embs)
                e_up_list.append(e_up)
                e_vp_list.append(e_vp)

            if not e_up_list:
                continue

            # Pool paths under this rule (Sec 3.2.2)
            up_stack = torch.stack(e_up_list, dim=0)
            vp_stack = torch.stack(e_vp_list, dim=0)

            if self.rule_pooling == "max":
                e_ur, _ = torch.max(up_stack, dim=0)
                e_vr, _ = torch.max(vp_stack, dim=0)
            else:
                e_ur = torch.mean(up_stack, dim=0)
                e_vr = torch.mean(vp_stack, dim=0)

            e_u_rules[r_idx] = e_ur
            e_v_rules[r_idx] = e_vr
            mask[r_idx] = True

        if not mask.any():
            zeros = torch.zeros(self.output_dim, dtype=torch.float32)
            return GlobalRepr(
                user=zeros,
                item=zeros,
                has_global=False,
                attention_weights={},
                top_rule=None,
            )

        # Multi-rule attention aggregation (Sec 3.2.3)
        final_e_ur, user_weights = self.user_attention(e_u_rules, mask)
        final_e_vr, item_weights = self.item_attention(e_v_rules, mask)

        # Build clean attention weights dictionary for explainability
        weights_dict: dict[str, float] = {}
        for r_idx, is_active in enumerate(mask):
            if is_active:
                rule_name = self.all_rules[r_idx]
                weights_dict[rule_name] = round(float(user_weights[r_idx].item()), 4)

        top_rule = max(weights_dict, key=weights_dict.get) if weights_dict else None

        return GlobalRepr(
            user=final_e_ur,
            item=final_e_vr,
            has_global=True,
            attention_weights=weights_dict,
            top_rule=top_rule,
        )


# ---------------------------------------------------------------------------
# Convenience Factory to Build Dev A Model from Real Project Files
# ---------------------------------------------------------------------------
def create_global_context_model(
    node_vectors: dict[str, list[float]] | None = None,
    rules: list[str] | None = None,
    emb_dim: int = EMB_DIM,
    lstm_hidden_dim: int = LSTM_HIDDEN_DIM,
) -> GlobalContextModel:
    """Builds and returns initialized GlobalContextModel ready for inference."""
    if node_vectors is None:
        node_vectors = load_node_vectors()
    if rules is None:
        rules = load_rules()

    embedding, id_to_index, _ = build_embedding_table(node_vectors, emb_dim=emb_dim)
    model = GlobalContextModel(
        embedding=embedding,
        id_to_index=id_to_index,
        all_rules=rules,
        emb_dim=emb_dim,
        lstm_hidden_dim=lstm_hidden_dim,
    )
    return model
