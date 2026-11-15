"""
Together: Representation Aggregation (Paper Sec 3.4.1).
Paper: Wu et al., Information Sciences 595 (2022).

Implements:
1. Combination of Gamma = {e_ur, e_ul, e_vr, e_vl}.
2. Three aggregator methods chosen by AGGREGATOR setting:
   - Sum: sigmoid(W @ sum(e) + b)
   - Max-pooling: sigmoid(W @ max(e_ur, e_ul, e_vr, e_vl) + b)
   - Concat: sigmoid(W @ [e_ur || e_ul || e_vr || e_vl] + b)
3. Fallback handling:
   - If has_global or has_local is false, falls back cleanly to the available side.
   - Never feeds unflagged zero vectors into sum or concat operations.
   - Both false -> returns zero representations and score 0.0.
4. Outputs aggregated user vector, aggregated item vector, and match score in [0.0, 1.0].
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import torch
import torch.nn as nn

from part2_config import AGGREGATOR, LSTM_HIDDEN_DIM
from part2_data import GlobalRepr, LocalRepr


AggregatorType = Literal["sum", "maxpool", "concat"]


@dataclass
class AggregatedOutput:
    """Output of representation aggregation and scoring."""
    user: torch.Tensor
    item: torch.Tensor
    score: float
    has_global: bool
    has_local: bool


class ContextAggregator(nn.Module):
    """
    Representation Aggregator (Paper Sec 3.4.1, Eqs 19-21).
    Combines global (Dev A) and local (Dev B) representations.
    """

    def __init__(
        self,
        dim: int = 4 * LSTM_HIDDEN_DIM,
        aggregator_type: AggregatorType = AGGREGATOR,
    ) -> None:
        super().__init__()
        self.dim = dim
        self.aggregator_type = aggregator_type.lower()

        # 1. Sum aggregator parameters (Eq 19)
        self.w_sum = nn.Linear(dim, 1)

        # 2. Max-pooling aggregator parameters (Eq 20)
        self.w_pool = nn.Linear(dim, 1)

        # 3. Concat aggregator parameters (Eq 21)
        # Full 4-vector concatenation: [e_ur || e_ul || e_vr || e_vl]
        self.w_concat_full = nn.Linear(4 * dim, 1)
        # Fallback 2-vector concatenation when only one context is available
        self.w_concat_half = nn.Linear(2 * dim, 1)

        # Projection layers to produce standardized aggregated user and item vectors
        self.proj_user_full = nn.Linear(2 * dim, dim)
        self.proj_item_full = nn.Linear(2 * dim, dim)
        self.proj_user_single = nn.Linear(dim, dim)
        self.proj_item_single = nn.Linear(dim, dim)

    def forward(
        self,
        global_repr: GlobalRepr,
        local_repr: LocalRepr,
        override_aggregator: AggregatorType | None = None,
    ) -> AggregatedOutput:
        """
        Aggregates global and local representations into a final score.

        Args:
            global_repr: GlobalRepr from Dev A (e_ur, e_vr, has_global)
            local_repr: LocalRepr from Dev B (e_ul, e_vl, has_local)
            override_aggregator: Optional override for 'sum', 'maxpool', or 'concat'
        Returns:
            AggregatedOutput with aggregated user/item tensors and prediction score.
        """
        mode = (override_aggregator or self.aggregator_type).lower()
        has_g = global_repr.has_global
        has_l = local_repr.has_local

        # Case 0: Neither context is available (total cold start)
        if not has_g and not has_l:
            zeros = torch.zeros(self.dim, dtype=torch.float32)
            return AggregatedOutput(
                user=zeros,
                item=zeros,
                score=0.0,
                has_global=False,
                has_local=False,
            )

        e_ur = global_repr.user
        e_vr = global_repr.item
        e_ul = local_repr.user
        e_vl = local_repr.item

        # Case 1: Both Global and Local are available (Full Gamma = {e_ur, e_ul, e_vr, e_vl})
        if has_g and has_l:
            u_agg = torch.sigmoid(self.proj_user_full(torch.cat([e_ur, e_ul], dim=-1)))
            v_agg = torch.sigmoid(self.proj_item_full(torch.cat([e_vr, e_vl], dim=-1)))

            if mode == "sum":
                # Eq 19: sigmoid(W @ sum(e) + b)
                sum_vec = e_ur + e_ul + e_vr + e_vl
                score_tensor = torch.sigmoid(self.w_sum(sum_vec))
            elif mode == "maxpool":
                # Eq 20: sigmoid(W @ max(e_ur, e_ul, e_vr, e_vl) + b)
                stacked = torch.stack([e_ur, e_ul, e_vr, e_vl], dim=0)
                max_vec, _ = torch.max(stacked, dim=0)
                score_tensor = torch.sigmoid(self.w_pool(max_vec))
            else:
                # Eq 21: sigmoid(W @ [e_ur || e_ul || e_vr || e_vl] + b)
                concat_vec = torch.cat([e_ur, e_ul, e_vr, e_vl], dim=-1)
                score_tensor = torch.sigmoid(self.w_concat_full(concat_vec))

            score = float(score_tensor.squeeze().item())
            return AggregatedOutput(
                user=u_agg,
                item=v_agg,
                score=round(score, 4),
                has_global=True,
                has_local=True,
            )

        # Case 2: Only Global is available (fallback)
        if has_g and not has_l:
            u_agg = torch.sigmoid(self.proj_user_single(e_ur))
            v_agg = torch.sigmoid(self.proj_item_single(e_vr))

            if mode == "sum":
                sum_vec = e_ur + e_vr
                score_tensor = torch.sigmoid(self.w_sum(sum_vec))
            elif mode == "maxpool":
                stacked = torch.stack([e_ur, e_vr], dim=0)
                max_vec, _ = torch.max(stacked, dim=0)
                score_tensor = torch.sigmoid(self.w_pool(max_vec))
            else:
                concat_vec = torch.cat([e_ur, e_vr], dim=-1)
                score_tensor = torch.sigmoid(self.w_concat_half(concat_vec))

            score = float(score_tensor.squeeze().item())
            return AggregatedOutput(
                user=u_agg,
                item=v_agg,
                score=round(score, 4),
                has_global=True,
                has_local=False,
            )

        # Case 3: Only Local is available (fallback)
        u_agg = torch.sigmoid(self.proj_user_single(e_ul))
        v_agg = torch.sigmoid(self.proj_item_single(e_vl))

        if mode == "sum":
            sum_vec = e_ul + e_vl
            score_tensor = torch.sigmoid(self.w_sum(sum_vec))
        elif mode == "maxpool":
            stacked = torch.stack([e_ul, e_vl], dim=0)
            max_vec, _ = torch.max(stacked, dim=0)
            score_tensor = torch.sigmoid(self.w_pool(max_vec))
        else:
            concat_vec = torch.cat([e_ul, e_vl], dim=-1)
            score_tensor = torch.sigmoid(self.w_concat_half(concat_vec))

        score = float(score_tensor.squeeze().item())
        return AggregatedOutput(
            user=u_agg,
            item=v_agg,
            score=round(score, 4),
            has_global=False,
            has_local=True,
        )
