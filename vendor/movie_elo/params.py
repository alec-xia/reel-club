"""Tunable parameters of the rating system."""
from __future__ import annotations

from dataclasses import asdict, dataclass, fields
from typing import Any, Mapping, Optional

from .errors import ValidationError


@dataclass(frozen=True)
class Params:
    """All tunable constants. Every field has a sensible default.

    Core parameters
    ---------------
    k:      Maximum Elo moved by a single match.
    d:      Score gap (in rating-scale units) that maps to a ~91% result.
            With the default 1-10 scale, ``d=2`` makes a 1-point gap ~76%.
    w:      A judge's weight doubles for every ``w`` Elo points.
    alpha:  Weight of "viewing experience" vs "movie quality" in [0, 1].
    start:  Initial Elo for every member; also the permanent group mean.
    scale_min, scale_max: Allowed range for each raw rating.

    Optional extensions (all off by default)
    ----------------------------------------
    voter_share:        Fraction of the suggester's weekly delta that is split
                        equally among members who voted for the chosen movie.
    provisional_picks:  A member's first N picks are played with
                        ``k_provisional`` instead of ``k``. 0 disables.
    k_provisional:      K used for provisional matches (defaults to ``k``).
    max_pick_age:       A pick stops defending after this many recorded weeks.
                        ``None`` means picks defend until replaced.
    """

    k: float = 32.0
    d: float = 2.0
    w: float = 400.0
    alpha: float = 0.5
    start: float = 1500.0
    scale_min: float = 1.0
    scale_max: float = 10.0
    voter_share: float = 0.0
    provisional_picks: int = 0
    k_provisional: Optional[float] = None
    max_pick_age: Optional[int] = None

    def __post_init__(self) -> None:
        if self.k <= 0:
            raise ValidationError("k must be positive")
        if self.d <= 0:
            raise ValidationError("d must be positive")
        if self.w <= 0:
            raise ValidationError("w must be positive")
        if not 0.0 <= self.alpha <= 1.0:
            raise ValidationError("alpha must be within [0, 1]")
        if self.scale_min >= self.scale_max:
            raise ValidationError("scale_min must be less than scale_max")
        if not 0.0 <= self.voter_share < 1.0:
            raise ValidationError("voter_share must be within [0, 1)")
        if self.provisional_picks < 0:
            raise ValidationError("provisional_picks must be >= 0")
        if self.k_provisional is not None and self.k_provisional <= 0:
            raise ValidationError("k_provisional must be positive")
        if self.max_pick_age is not None and self.max_pick_age < 1:
            raise ValidationError("max_pick_age must be >= 1")

    @property
    def effective_k_provisional(self) -> float:
        return self.k if self.k_provisional is None else self.k_provisional

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "Params":
        known = {f.name for f in fields(cls)}
        unknown = sorted(set(data) - known)
        if unknown:
            raise ValidationError(f"unknown Params fields: {', '.join(unknown)}")
        return cls(**data)
