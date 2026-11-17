"""Plain-text renderers for standings and weekly results (handy for chat bots)."""
from __future__ import annotations

from typing import Sequence

from .league import League
from .models import Standing, WeekResult


def format_standings(league_or_rows: "League | Sequence[Standing]", precision: int = 0) -> str:
    rows = league_or_rows.standings() if isinstance(league_or_rows, League) else list(league_or_rows)
    if not rows:
        return "(no members)"
    name_w = max(len("Member"), *(len(r.member) for r in rows))
    movie_w = max(len("Current pick"), *(len(r.current_movie or "-") for r in rows))
    header = f"{'#':>2}  {'Member':<{name_w}}  {'Elo':>7}  {'Picks':>5}  {'Current pick':<{movie_w}}"
    lines = [header, "-" * len(header)]
    for r in rows:
        lines.append(
            f"{r.rank:>2}  {r.member:<{name_w}}  {r.elo:>7.{precision}f}  {r.pick_count:>5}  "
            f"{(r.current_movie or '-'):<{movie_w}}"
        )
    return "\n".join(lines)


def format_week_report(result: WeekResult, precision: int = 1) -> str:
    p = precision
    lines = [f"Week {result.week_id}: {result.suggester} picked \"{result.movie}\""]
    if not result.matches and not result.skipped:
        lines.append("  No opponents yet; nothing changes this week.")
    for m in result.matches:
        judges = ", ".join(f"{v.judge}({v.weight:.2f}: {v.gap:+.{p}f})" for v in m.judges)
        lines.append(
            f"  vs {m.opponent} (\"{m.opponent_movie}\"): gap {m.gap:+.2f}  "
            f"S {m.actual:.3f}  E {m.expected:.3f}  K {m.k:g}  Δ {m.delta:+.{p}f}"
        )
        lines.append(f"      judges: {judges}")
    for opponent, reason in result.skipped.items():
        lines.append(f"  vs {opponent}: skipped ({reason})")
    if result.voter_credit:
        credit = ", ".join(f"{v} {d:+.{p}f}" for v, d in result.voter_credit.items())
        lines.append(f"  voter credit: {credit}")
    if result.deltas:
        lines.append("  changes:")
        for member in sorted(result.deltas, key=lambda m: -result.deltas[m]):
            d = result.deltas[member]
            lines.append(
                f"    {member:<12} {d:+.{p}f}  "
                f"({result.elo_before[member]:.0f} -> {result.elo_after[member]:.0f})"
            )
    return "\n".join(lines)
