"""Shared fixtures for the test suite."""
from movie_elo import League, Params, Week

MEMBERS = ["A", "B", "C", "D", "E"]

# Mid-season state used by the worked example in README.md.
MID_SEASON_ELO = {"A": 1700.0, "B": 1550.0, "C": 1500.0, "D": 1400.0, "E": 1350.0}
MID_SEASON_PICKS = {
    "A": {"B": 7.0, "C": 6.0, "D": 8.0, "E": 7.5},
    "B": {"A": 5.5, "C": 6.5, "D": 6.0, "E": 7.0},
    "C": {"A": 8.5, "B": 8.0, "D": 8.5, "E": 7.5},
    "D": {"A": 5.5, "B": 6.0, "C": 5.5, "E": 6.5},
}
E_WEEK = Week("w4", "E", "E's pick", {"A": (8, 7), "B": (7, 6), "C": (9, 8), "D": (6, 7)})


def mid_season_league(params=None, pick_order=("A", "B", "C", "D")) -> League:
    """Build the README worked-example state through the public snapshot API."""
    params = params or Params()
    picks = {}
    for i, m in enumerate(pick_order):
        scores = MID_SEASON_PICKS[m]
        picks[m] = {
            "member": m,
            "movie": f"{m}'s pick",
            "week_id": f"w{i}",
            # experience == quality so the combined score equals the table value for any alpha
            "ratings": {r: {"experience": s, "quality": s} for r, s in scores.items()},
            "number": 1,
            "made_at": i,
        }
    return League.from_dict(
        {
            "version": 1,
            "params": params.to_dict(),
            "members": MEMBERS,
            "elo": dict(MID_SEASON_ELO),
            "picks": picks,
            "pick_counts": {m: 1 for m in pick_order},
            "processed_weeks": [f"w{i}" for i in range(len(pick_order))],
            "week_index": len(pick_order),
            "history": [],
        }
    )


# A short, fully-rated first rotation for replay-style tests.
ROTATION = [
    Week("w1", "A", "M1", {"B": (7, 7), "C": (6, 6), "D": (8, 8), "E": (8, 7)}),
    Week("w2", "B", "M2", {"A": (6, 5), "C": (7, 6), "D": (6, 6), "E": (7, 7)}),
    Week("w3", "C", "M3", {"A": (9, 8), "B": (8, 8), "D": (8, 9), "E": (7, 8)}),
    Week("w4", "D", "M4", {"A": (5, 6), "B": (6, 6), "C": (6, 5), "E": (7, 6)}),
    Week("w5", "E", "M5", {"A": (8, 7), "B": (7, 6), "C": (9, 8), "D": (6, 7)}),
]
