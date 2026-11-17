"""Data types: inputs (``Rating``, ``Week``), state (``Pick``) and results."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .errors import ValidationError


# --------------------------------------------------------------------------- inputs


@dataclass(frozen=True)
class Rating:
    """One rater's two scores for one movie."""

    experience: float
    quality: float

    @classmethod
    def coerce(cls, value: Any) -> "Rating":
        """Accept a ``Rating``, an ``(experience, quality)`` pair, or a mapping."""
        if isinstance(value, Rating):
            return value
        if isinstance(value, Mapping):
            try:
                return cls(float(value["experience"]), float(value["quality"]))
            except (KeyError, TypeError, ValueError) as exc:
                raise ValidationError(f"invalid rating mapping: {value!r}") from exc
        if isinstance(value, (tuple, list)) and len(value) == 2:
            try:
                return cls(float(value[0]), float(value[1]))
            except (TypeError, ValueError) as exc:
                raise ValidationError(f"invalid rating pair: {value!r}") from exc
        raise ValidationError(
            f"rating must be a Rating, an (experience, quality) pair, or a mapping; got {value!r}"
        )

    def to_dict(self) -> dict:
        return {"experience": self.experience, "quality": self.quality}


@dataclass(frozen=True)
class Week:
    """Everything recorded about one movie night.

    ``ratings`` maps rater -> ``Rating`` (pairs and mappings are coerced).
    ``candidates`` and ``votes`` are optional; the core algorithm ignores them,
    the voter-credit extension uses ``votes``.
    """

    week_id: str
    suggester: str
    movie: str
    ratings: Mapping[str, Rating]
    candidates: Tuple[str, ...] = ()
    votes: Mapping[str, str] = field(default_factory=dict)
    date: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.week_id:
            raise ValidationError("week_id must be a non-empty string")
        if not self.suggester:
            raise ValidationError("suggester must be a non-empty string")
        if not self.movie:
            raise ValidationError("movie must be a non-empty string")
        ratings = {str(r): Rating.coerce(v) for r, v in dict(self.ratings).items()}
        candidates = tuple(str(c) for c in self.candidates)
        votes = {str(v): str(t) for v, t in dict(self.votes).items()}
        if candidates:
            if self.movie not in candidates:
                raise ValidationError(f"movie {self.movie!r} is not one of the candidates")
            bad = sorted({t for t in votes.values() if t not in candidates})
            if bad:
                raise ValidationError(f"votes for non-candidates: {', '.join(bad)}")
        object.__setattr__(self, "ratings", ratings)
        object.__setattr__(self, "candidates", candidates)
        object.__setattr__(self, "votes", votes)

    @property
    def raters(self) -> Tuple[str, ...]:
        return tuple(self.ratings)

    def voters_for_movie(self) -> Tuple[str, ...]:
        """Members whose recorded vote was for the movie that was watched."""
        return tuple(v for v, t in self.votes.items() if t == self.movie)

    def to_dict(self) -> dict:
        data: Dict[str, Any] = {
            "week_id": self.week_id,
            "suggester": self.suggester,
            "movie": self.movie,
            "ratings": {r: rating.to_dict() for r, rating in self.ratings.items()},
        }
        if self.candidates:
            data["candidates"] = list(self.candidates)
        if self.votes:
            data["votes"] = dict(self.votes)
        if self.date is not None:
            data["date"] = self.date
        return data

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "Week":
        try:
            return cls(
                week_id=str(data["week_id"]),
                suggester=str(data["suggester"]),
                movie=str(data["movie"]),
                ratings=data.get("ratings", {}),
                candidates=tuple(data.get("candidates", ())),
                votes=data.get("votes", {}),
                date=data.get("date"),
            )
        except KeyError as exc:
            raise ValidationError(f"week is missing required field {exc.args[0]!r}") from exc


# --------------------------------------------------------------------------- state


@dataclass(frozen=True)
class Pick:
    """A member's current pick: the movie that defends their rating.

    ``number`` is the 1-based ordinal of this pick among the member's picks.
    ``made_at`` is the league week index when it was recorded; the pick's age
    in a later week is ``current_index - made_at``.
    """

    member: str
    movie: str
    week_id: str
    ratings: Mapping[str, Rating]
    number: int
    made_at: int

    def __post_init__(self) -> None:
        ratings = {str(r): Rating.coerce(v) for r, v in dict(self.ratings).items()}
        object.__setattr__(self, "ratings", ratings)

    def to_dict(self) -> dict:
        return {
            "member": self.member,
            "movie": self.movie,
            "week_id": self.week_id,
            "ratings": {r: rating.to_dict() for r, rating in self.ratings.items()},
            "number": self.number,
            "made_at": self.made_at,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "Pick":
        return cls(
            member=str(data["member"]),
            movie=str(data["movie"]),
            week_id=str(data["week_id"]),
            ratings=data["ratings"],
            number=int(data["number"]),
            made_at=int(data["made_at"]),
        )


# --------------------------------------------------------------------------- results


@dataclass(frozen=True)
class JudgeVerdict:
    """One judge's contribution to one match."""

    judge: str
    weight: float  # normalised within the match; all verdicts of a match sum to 1
    new_score: float  # judge's combined score for the new movie
    old_score: float  # judge's combined score for the opponent's pick

    @property
    def gap(self) -> float:
        return self.new_score - self.old_score

    def to_dict(self) -> dict:
        return {
            "judge": self.judge,
            "weight": self.weight,
            "new_score": self.new_score,
            "old_score": self.old_score,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "JudgeVerdict":
        return cls(str(data["judge"]), float(data["weight"]), float(data["new_score"]), float(data["old_score"]))


@dataclass(frozen=True)
class MatchResult:
    """The new movie versus one opponent's current pick."""

    opponent: str
    opponent_movie: str
    judges: Tuple[JudgeVerdict, ...]
    gap: float  # weighted mean of per-judge gaps
    actual: float  # S
    expected: float  # E
    k: float  # K used for this match
    delta: float  # added to the suggester, subtracted from the opponent

    def to_dict(self) -> dict:
        return {
            "opponent": self.opponent,
            "opponent_movie": self.opponent_movie,
            "judges": [j.to_dict() for j in self.judges],
            "gap": self.gap,
            "actual": self.actual,
            "expected": self.expected,
            "k": self.k,
            "delta": self.delta,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "MatchResult":
        return cls(
            opponent=str(data["opponent"]),
            opponent_movie=str(data["opponent_movie"]),
            judges=tuple(JudgeVerdict.from_dict(j) for j in data["judges"]),
            gap=float(data["gap"]),
            actual=float(data["actual"]),
            expected=float(data["expected"]),
            k=float(data["k"]),
            delta=float(data["delta"]),
        )


@dataclass(frozen=True)
class WeekResult:
    """Full, auditable outcome of processing one week.

    ``deltas`` are the final applied changes (including voter credit).
    ``skipped`` maps opponents that did not get a match to the reason.
    """

    week_id: str
    suggester: str
    movie: str
    matches: Tuple[MatchResult, ...]
    skipped: Mapping[str, str]
    voter_credit: Mapping[str, float]
    deltas: Mapping[str, float]
    elo_before: Mapping[str, float]
    elo_after: Mapping[str, float]

    @property
    def match_total(self) -> float:
        """Suggester's delta from matches alone, before voter credit."""
        return sum(m.delta for m in self.matches)

    @property
    def suggester_delta(self) -> float:
        return self.deltas.get(self.suggester, 0.0)

    def to_dict(self) -> dict:
        return {
            "week_id": self.week_id,
            "suggester": self.suggester,
            "movie": self.movie,
            "matches": [m.to_dict() for m in self.matches],
            "skipped": dict(self.skipped),
            "voter_credit": dict(self.voter_credit),
            "deltas": dict(self.deltas),
            "elo_before": dict(self.elo_before),
            "elo_after": dict(self.elo_after),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "WeekResult":
        return cls(
            week_id=str(data["week_id"]),
            suggester=str(data["suggester"]),
            movie=str(data["movie"]),
            matches=tuple(MatchResult.from_dict(m) for m in data["matches"]),
            skipped={str(k): str(v) for k, v in data.get("skipped", {}).items()},
            voter_credit={str(k): float(v) for k, v in data.get("voter_credit", {}).items()},
            deltas={str(k): float(v) for k, v in data["deltas"].items()},
            elo_before={str(k): float(v) for k, v in data["elo_before"].items()},
            elo_after={str(k): float(v) for k, v in data["elo_after"].items()},
        )


@dataclass(frozen=True)
class Standing:
    """One row of the leaderboard."""

    rank: int
    member: str
    elo: float
    pick_count: int
    current_movie: Optional[str]

    def to_dict(self) -> dict:
        return {
            "rank": self.rank,
            "member": self.member,
            "elo": self.elo,
            "pick_count": self.pick_count,
            "current_movie": self.current_movie,
        }


def standings_from(
    elo: Mapping[str, float], pick_counts: Mapping[str, int], picks: Mapping[str, Pick]
) -> Sequence[Standing]:
    """Sort members by Elo (ties broken by name) and number the ranks."""
    ordered = sorted(elo.items(), key=lambda kv: (-kv[1], kv[0]))
    return [
        Standing(
            rank=i + 1,
            member=m,
            elo=r,
            pick_count=pick_counts.get(m, 0),
            current_movie=picks[m].movie if m in picks else None,
        )
        for i, (m, r) in enumerate(ordered)
    ]
