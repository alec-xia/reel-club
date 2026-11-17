"""movie_elo: an Elo-style rating system for a movie club.

Each member's most recent pick plays a match against every other member's
current pick. Matches are judged by the members who rated both movies, with
judge weight growing with Elo. Points move from loser to winner, so the
league total is conserved.

Quick start::

    from movie_elo import League, Week

    league = League(["Alex", "Bea", "Chris", "Dana", "Eve"])
    result = league.play_week(Week(
        week_id="2026-11-14", suggester="Eve", movie="Example",
        ratings={"Alex": (8, 7), "Bea": (7, 6), "Chris": (9, 8), "Dana": (6, 7)},
    ))
    for row in league.standings():
        print(row.rank, row.member, round(row.elo))

See README.md for the full guide and API reference.
"""
from .errors import DuplicateWeekError, MovieEloError, UnknownMemberError, ValidationError
from .formulas import actual_score, combined_score, expected_score, judge_weight, normalize
from .league import League, replay
from .models import JudgeVerdict, MatchResult, Pick, Rating, Standing, Week, WeekResult
from .params import Params
from .report import format_standings, format_week_report
from .storage import (
    load_league,
    load_log,
    log_from_dict,
    log_to_dict,
    replay_log,
    save_league,
    save_log,
)

__version__ = "1.0.0"

__all__ = [
    "__version__",
    # core
    "League",
    "Params",
    "Week",
    "Rating",
    "replay",
    # results and state
    "WeekResult",
    "MatchResult",
    "JudgeVerdict",
    "Pick",
    "Standing",
    # formulas
    "combined_score",
    "judge_weight",
    "normalize",
    "actual_score",
    "expected_score",
    # reporting
    "format_standings",
    "format_week_report",
    # storage
    "log_to_dict",
    "log_from_dict",
    "save_log",
    "load_log",
    "replay_log",
    "save_league",
    "load_league",
    # errors
    "MovieEloError",
    "ValidationError",
    "UnknownMemberError",
    "DuplicateWeekError",
]
