"""JSON helpers for the week log and for league snapshots.

The recommended persistence model: store ``members``, ``params`` and the list
of weeks; rebuild standings with ``replay``. ``save_league``/``load_league``
exist for applications that prefer to persist a snapshot.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, List, Mapping, Optional, Sequence, Union

from .errors import ValidationError
from .league import League, replay
from .models import Week
from .params import Params

PathLike = Union[str, Path]
LOG_VERSION = 1


def log_to_dict(members: Sequence[str], weeks: Iterable[Week], params: Optional[Params] = None) -> dict:
    return {
        "version": LOG_VERSION,
        "members": list(members),
        "params": (params if params is not None else Params()).to_dict(),
        "weeks": [w.to_dict() for w in weeks],
    }


def log_from_dict(data: Mapping[str, Any]) -> "tuple[List[str], List[Week], Params]":
    if data.get("version") != LOG_VERSION:
        raise ValidationError(f"unsupported log version {data.get('version')!r}")
    members = [str(m) for m in data.get("members", [])]
    weeks = [Week.from_dict(w) for w in data.get("weeks", [])]
    params = Params.from_dict(data.get("params", {}))
    return members, weeks, params


def save_log(path: PathLike, members: Sequence[str], weeks: Iterable[Week], params: Optional[Params] = None) -> None:
    Path(path).write_text(json.dumps(log_to_dict(members, weeks, params), indent=2), encoding="utf-8")


def load_log(path: PathLike) -> "tuple[List[str], List[Week], Params]":
    return log_from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


def replay_log(path: PathLike, params: Optional[Params] = None) -> League:
    """Load a log file and rebuild the league. ``params`` overrides the stored ones."""
    members, weeks, stored = load_log(path)
    return replay(members, weeks, params if params is not None else stored)


def save_league(path: PathLike, league: League) -> None:
    Path(path).write_text(json.dumps(league.to_dict(), indent=2), encoding="utf-8")


def load_league(path: PathLike) -> League:
    return League.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))
