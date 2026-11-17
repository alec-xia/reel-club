#!/usr/bin/env python3
"""Stdin/stdout adapter around the vendored movie_elo package.

Reel Club stores members and one rating pair per member per movie. This
process replays that log with movie_elo.replay and returns standings plus
each WeekResult. Replay order is the order of ``weeks`` unless a week carries
``ranked_at``, in which case events are ordered by that timestamp (then by
numeric week id) so a movie scored out of suggestion order still ranks in
watch order. An optional ``preview`` week is scored with League.preview_week
and is not applied. Nothing in this file implements rating math.
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

VENDOR = Path(__file__).resolve().parents[1] / "vendor"
sys.path.insert(0, str(VENDOR))

from movie_elo import Params, ValidationError, Week, format_standings, format_week_report, replay


def fail(message: str, error_type: str) -> int:
    json.dump({"ok": False, "error": message, "type": error_type}, sys.stdout)
    return 0


def with_report(result) -> dict:
    data = result.to_dict()
    data["report"] = format_week_report(result)
    return data


def _tie(week_id: str) -> tuple:
    if week_id.isdigit():
        return (0, int(week_id))
    return (1, week_id)


def replay_order(raw_weeks: list) -> list:
    """Order scored movies by ranked_at when the caller provides it.

    Without ranked_at, the given order is the replay order. Week ids are not
    a sort key: they used to be calendar weeks, and a later suggestion can be
    watched first.
    """
    weeks = list(raw_weeks or [])
    if not any(isinstance(week, dict) and week.get("ranked_at") for week in weeks):
        return weeks

    def key(week: object) -> tuple:
        if not isinstance(week, dict):
            return ("", 1, "")
        stamp = str(week.get("ranked_at") or "")
        return (stamp, *_tie(str(week.get("week_id") or "")))

    return sorted(weeks, key=key)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        return fail(f"invalid JSON: {exc}", "JSONDecodeError")

    try:
        raw_params = payload.get("params")
        params = Params.from_dict(raw_params) if raw_params else Params()
        members = [str(name) for name in payload.get("members", [])]
        weeks = [Week.from_dict(week) for week in replay_order(payload.get("weeks", []))]
        league = replay(members, weeks, params)

        preview = None
        preview_error = None
        preview_payload = payload.get("preview")
        if preview_payload:
            try:
                preview = with_report(league.preview_week(Week.from_dict(preview_payload)))
            except ValidationError as exc:
                preview_error = {"error": str(exc), "type": type(exc).__name__}

        json.dump(
            {
                "ok": True,
                "standings": [row.to_dict() for row in league.standings()],
                "history": [with_report(result) for result in league.history],
                "total_elo": league.total_elo(),
                "week_count": league.week_count,
                "members": list(league.members),
                "standings_report": format_standings(league, precision=1),
                "preview": preview,
                "preview_error": preview_error,
                "params": params.to_dict(),
            },
            sys.stdout,
        )
        return 0
    except ValidationError as exc:
        return fail(str(exc), type(exc).__name__)
    except Exception as exc:  # surface adapter failures as JSON; math errors propagate here too
        traceback.print_exc(file=sys.stderr)
        return fail(str(exc), type(exc).__name__)


if __name__ == "__main__":
    raise SystemExit(main())
