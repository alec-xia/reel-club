"""The pure math of the rating system. Every function here is stateless."""
from __future__ import annotations

from typing import Dict, Mapping

from .models import Rating


def combined_score(rating: Rating, alpha: float) -> float:
    """Blend the two metrics into one score: ``alpha*experience + (1-alpha)*quality``."""
    return alpha * rating.experience + (1.0 - alpha) * rating.quality


def judge_weight(elo: float, start: float, w: float) -> float:
    """Raw judge weight: doubles for every ``w`` Elo points above ``start``.

    Weights are always normalised per match, so the ``start`` offset only
    affects readability of the raw number.
    """
    return 2.0 ** ((elo - start) / w)


def normalize(weights: Mapping[str, float]) -> Dict[str, float]:
    """Scale weights so they sum to 1."""
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("weights must sum to a positive number")
    return {key: value / total for key, value in weights.items()}


def actual_score(gap: float, d: float) -> float:
    """Soft match result in (0, 1) from the weighted gap (new minus old).

    ``gap=0`` is a draw (0.5). A gap of ``d`` is ~0.91; a gap of ``d/2`` is ~0.76.
    """
    return 1.0 / (1.0 + 10.0 ** (-gap / d))


def expected_score(elo_a: float, elo_b: float) -> float:
    """Standard Elo expectation: probability that ``a`` beats ``b``."""
    return 1.0 / (1.0 + 10.0 ** ((elo_b - elo_a) / 400.0))
