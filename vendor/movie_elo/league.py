"""The ``League``: holds state, validates weeks, runs matches, applies deltas."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from .errors import DuplicateWeekError, UnknownMemberError, ValidationError
from .formulas import actual_score, combined_score, expected_score, judge_weight, normalize
from .models import JudgeVerdict, MatchResult, Pick, Standing, Week, WeekResult, standings_from
from .params import Params

SNAPSHOT_VERSION = 1


class League:
    """A group of members, their Elo, their current picks, and the processing history.

    Typical use::

        league = League(["Alex", "Bea", "Chris", "Dana", "Eve"])
        result = league.play_week(week)      # mutates, returns a WeekResult
        preview = league.preview_week(week)  # same computation, no mutation
        league.standings()

    All matches in a week are computed from a snapshot of Elo taken at the
    start of the week and applied together, so the result never depends on
    the order in which opponents are processed. The total Elo of the league
    is conserved by every ``play_week`` call.
    """

    def __init__(self, members: Iterable[str] = (), params: Optional[Params] = None):
        self._params: Params = params if params is not None else Params()
        self._elo: Dict[str, float] = {}
        self._picks: Dict[str, Pick] = {}
        self._pick_counts: Dict[str, int] = {}
        self._processed: Dict[str, None] = {}  # ordered set of week ids
        self._week_index: int = 0
        self._history: List[WeekResult] = []
        for member in members:
            self.add_member(member)

    # ------------------------------------------------------------------ read-only views

    @property
    def params(self) -> Params:
        return self._params

    @property
    def members(self) -> Tuple[str, ...]:
        return tuple(self._elo)

    @property
    def elo(self) -> Dict[str, float]:
        return dict(self._elo)

    @property
    def picks(self) -> Dict[str, Pick]:
        return dict(self._picks)

    @property
    def pick_counts(self) -> Dict[str, int]:
        return {m: self._pick_counts.get(m, 0) for m in self._elo}

    @property
    def history(self) -> Tuple[WeekResult, ...]:
        return tuple(self._history)

    @property
    def processed_weeks(self) -> Tuple[str, ...]:
        return tuple(self._processed)

    @property
    def week_count(self) -> int:
        return self._week_index

    def rating(self, member: str) -> float:
        self._require_member(member, "member")
        return self._elo[member]

    def total_elo(self) -> float:
        return sum(self._elo.values())

    def standings(self) -> Sequence[Standing]:
        return standings_from(self._elo, self._pick_counts, self._picks)

    # ------------------------------------------------------------------ membership

    def add_member(self, name: str, elo: Optional[float] = None) -> None:
        """Add a member. New members start at ``params.start`` unless ``elo`` is given.

        Supplying a custom ``elo`` moves the group mean away from ``start``;
        use it only to seed a league from an existing state.
        """
        name = str(name)
        if not name:
            raise ValidationError("member name must be a non-empty string")
        if name in self._elo:
            raise ValidationError(f"{name!r} is already a member")
        self._elo[name] = float(self._params.start if elo is None else elo)

    def remove_member(self, name: str, recenter: bool = True) -> None:
        """Remove a member and their current pick.

        With ``recenter=True`` every remaining member is shifted by the same
        constant so the group mean returns to ``params.start``. The shift has
        no effect on any future computation (expected results depend only on
        Elo differences and judge weights are normalised per match).
        """
        self._require_member(name, "member")
        del self._elo[name]
        self._picks.pop(name, None)
        self._pick_counts.pop(name, None)
        if recenter and self._elo:
            shift = self._params.start - self.total_elo() / len(self._elo)
            for member in self._elo:
                self._elo[member] += shift

    # ------------------------------------------------------------------ play

    def preview_week(self, week: Week) -> WeekResult:
        """Compute a week's result without changing the league ("what if")."""
        return self._compute(week)

    def play_week(self, week: Week) -> WeekResult:
        """Validate, compute, and apply one week. Returns the auditable result."""
        result = self._compute(week)
        self._apply(week, result)
        return result

    # ------------------------------------------------------------------ internals

    def _require_member(self, name: str, role: str) -> None:
        if name not in self._elo:
            raise UnknownMemberError(f"{role} {name!r} is not a member of the league")

    def _validate(self, week: Week) -> None:
        p = self._params
        if week.week_id in self._processed:
            raise DuplicateWeekError(f"week {week.week_id!r} was already processed")
        self._require_member(week.suggester, "suggester")
        if week.suggester in week.ratings:
            raise ValidationError("the suggester must not rate their own pick")
        if not week.ratings:
            raise ValidationError("a week needs at least one rating")
        for rater, rating in week.ratings.items():
            self._require_member(rater, "rater")
            for label, value in (("experience", rating.experience), ("quality", rating.quality)):
                if not p.scale_min <= value <= p.scale_max:
                    raise ValidationError(
                        f"{label} rating {value} from {rater!r} is outside "
                        f"[{p.scale_min}, {p.scale_max}]"
                    )
        for voter in week.votes:
            self._require_member(voter, "voter")
            if voter == week.suggester:
                raise ValidationError("the suggester must not vote")

    def _k_for(self, suggester_pick_number: int, opponent_pick_number: int) -> float:
        p = self._params
        if p.provisional_picks > 0 and (
            suggester_pick_number <= p.provisional_picks or opponent_pick_number <= p.provisional_picks
        ):
            return p.effective_k_provisional
        return p.k

    def _compute(self, week: Week) -> WeekResult:
        self._validate(week)
        p = self._params
        suggester = week.suggester
        elo0 = dict(self._elo)  # start-of-week snapshot used by every match
        new_scores = {j: combined_score(r, p.alpha) for j, r in week.ratings.items()}
        suggester_pick_number = self._pick_counts.get(suggester, 0) + 1

        matches: List[MatchResult] = []
        skipped: Dict[str, str] = {}
        deltas: Dict[str, float] = defaultdict(float)

        for opponent, pick in self._picks.items():
            if opponent == suggester:
                continue
            if p.max_pick_age is not None and (self._week_index - pick.made_at) > p.max_pick_age:
                skipped[opponent] = "stale pick"
                continue
            old_scores = {j: combined_score(r, p.alpha) for j, r in pick.ratings.items()}
            # Judges rated both movies, which excludes both suggesters and anyone absent.
            judges = [j for j in new_scores if j in old_scores]
            if not judges:
                skipped[opponent] = "no common judges"
                continue
            weights = normalize({j: judge_weight(elo0[j], p.start, p.w) for j in judges})
            verdicts = tuple(
                JudgeVerdict(judge=j, weight=weights[j], new_score=new_scores[j], old_score=old_scores[j])
                for j in judges
            )
            gap = sum(v.weight * v.gap for v in verdicts)
            actual = actual_score(gap, p.d)
            expected = expected_score(elo0[suggester], elo0[opponent])
            k = self._k_for(suggester_pick_number, pick.number)
            delta = k * (actual - expected)
            matches.append(
                MatchResult(
                    opponent=opponent,
                    opponent_movie=pick.movie,
                    judges=verdicts,
                    gap=gap,
                    actual=actual,
                    expected=expected,
                    k=k,
                    delta=delta,
                )
            )
            deltas[suggester] += delta
            deltas[opponent] -= delta

        voter_credit: Dict[str, float] = {}
        if p.voter_share > 0 and matches:
            voters = week.voters_for_movie()
            if voters:
                credit = p.voter_share * deltas[suggester]
                share = credit / len(voters)
                for voter in voters:
                    voter_credit[voter] = share
                    deltas[voter] += share
                deltas[suggester] -= credit

        final_deltas = {m: d for m, d in deltas.items() if d != 0.0}
        elo_after = {m: elo0[m] + final_deltas.get(m, 0.0) for m in elo0}
        return WeekResult(
            week_id=week.week_id,
            suggester=suggester,
            movie=week.movie,
            matches=tuple(matches),
            skipped=skipped,
            voter_credit=voter_credit,
            deltas=final_deltas,
            elo_before=elo0,
            elo_after=elo_after,
        )

    def _apply(self, week: Week, result: WeekResult) -> None:
        for member, delta in result.deltas.items():
            self._elo[member] += delta
        number = self._pick_counts.get(week.suggester, 0) + 1
        self._pick_counts[week.suggester] = number
        self._picks[week.suggester] = Pick(
            member=week.suggester,
            movie=week.movie,
            week_id=week.week_id,
            ratings=week.ratings,
            number=number,
            made_at=self._week_index,
        )
        self._processed[week.week_id] = None
        self._week_index += 1
        self._history.append(result)

    # ------------------------------------------------------------------ serialization

    def to_dict(self) -> dict:
        """Snapshot of the full league state, JSON-serialisable."""
        return {
            "version": SNAPSHOT_VERSION,
            "params": self._params.to_dict(),
            "members": list(self._elo),
            "elo": dict(self._elo),
            "picks": {m: pick.to_dict() for m, pick in self._picks.items()},
            "pick_counts": dict(self._pick_counts),
            "processed_weeks": list(self._processed),
            "week_index": self._week_index,
            "history": [r.to_dict() for r in self._history],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "League":
        version = data.get("version")
        if version != SNAPSHOT_VERSION:
            raise ValidationError(f"unsupported snapshot version {version!r}")
        league = cls(params=Params.from_dict(data["params"]))
        elo = data["elo"]
        for member in data.get("members", list(elo)):
            league.add_member(member, elo=float(elo[member]))
        for member, pick in data.get("picks", {}).items():
            if member not in league._elo:
                raise ValidationError(f"pick for non-member {member!r}")
            league._picks[member] = Pick.from_dict(pick)
        league._pick_counts = {str(m): int(n) for m, n in data.get("pick_counts", {}).items()}
        league._processed = {str(w): None for w in data.get("processed_weeks", [])}
        league._week_index = int(data.get("week_index", len(league._processed)))
        league._history = [WeekResult.from_dict(r) for r in data.get("history", [])]
        return league


def replay(members: Iterable[str], weeks: Iterable[Week], params: Optional[Params] = None) -> League:
    """Build a league from scratch by playing every week in order.

    The week log is the source of truth; standings are derived from it. Use
    this to recompute after changing ``params``.
    """
    league = League(members, params)
    for week in weeks:
        league.play_week(week)
    return league
