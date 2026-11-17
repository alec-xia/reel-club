"""The JSON bridge must return the same numbers as calling movie_elo directly."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

from movie_elo import Week, format_standings, format_week_report, replay

ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "scripts" / "elo_bridge.py"


def run_bridge(payload):
    completed = subprocess.run(
        [sys.executable, str(BRIDGE)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
        cwd=ROOT,
    )
    assert completed.stdout, completed.stderr
    return json.loads(completed.stdout)


class BridgeTests(unittest.TestCase):
    def test_replay_matches_the_library(self):
        payload = {
            "members": ["Ada", "Bea", "Cy"],
            "weeks": [
                {
                    "week_id": "2026-01-02",
                    "suggester": "Ada",
                    "movie": "Opening",
                    "ratings": {
                        "Bea": {"experience": 8, "quality": 6},
                        "Cy": {"experience": 7, "quality": 7},
                    },
                    "date": "2026-01-02",
                },
                {
                    "week_id": "2026-01-09",
                    "suggester": "Bea",
                    "movie": "Follow-up",
                    "ratings": {
                        "Ada": {"experience": 9, "quality": 8},
                        "Cy": {"experience": 4, "quality": 5},
                    },
                },
            ],
        }
        output = run_bridge(payload)
        self.assertTrue(output["ok"])
        league = replay(
            payload["members"],
            [Week.from_dict(week) for week in payload["weeks"]],
        )
        self.assertEqual(output["standings"], [row.to_dict() for row in league.standings()])
        self.assertAlmostEqual(output["total_elo"], league.total_elo())
        self.assertEqual(output["standings_report"], format_standings(league, precision=1))
        self.assertEqual(len(output["history"]), len(league.history))
        for raw, result in zip(output["history"], league.history):
            report = raw.pop("report")
            self.assertEqual(report, format_week_report(result))
            self.assertEqual(raw, result.to_dict())
        self.assertAlmostEqual(sum(output["standings"][i]["elo"] for i in range(3)), 4500.0)

    def test_suggester_rating_is_rejected_by_the_library(self):
        output = run_bridge(
            {
                "members": ["Ada", "Bea", "Cy"],
                "weeks": [
                    {
                        "week_id": "2026-01-16",
                        "suggester": "Ada",
                        "movie": "Self scored",
                        "ratings": {
                            "Ada": {"experience": 10, "quality": 10},
                            "Bea": {"experience": 5, "quality": 5},
                        },
                    }
                ],
            }
        )
        self.assertFalse(output["ok"])
        self.assertIn("suggester must not rate", output["error"])
        self.assertEqual(output["type"], "ValidationError")

        preview = run_bridge(
            {
                "members": ["Ada", "Bea", "Cy"],
                "weeks": [],
                "preview": {
                    "week_id": "2026-01-16",
                    "suggester": "Ada",
                    "movie": "Self scored",
                    "ratings": {
                        "Ada": {"experience": 10, "quality": 10},
                        "Bea": {"experience": 5, "quality": 5},
                    },
                },
            }
        )
        self.assertTrue(preview["ok"])
        self.assertIn("suggester must not rate", preview["preview_error"]["error"])

    def test_input_order_is_kept_when_ranked_at_is_absent(self):
        output = run_bridge(
            {
                "members": ["Ada", "Bea", "Cy"],
                "weeks": [
                    {
                        "week_id": "2026-02-01",
                        "suggester": "Bea",
                        "movie": "Later id",
                        "ratings": {
                            "Ada": {"experience": 8, "quality": 8},
                            "Cy": {"experience": 6, "quality": 6},
                        },
                    },
                    {
                        "week_id": "2026-01-01",
                        "suggester": "Ada",
                        "movie": "Earlier id",
                        "ratings": {
                            "Bea": {"experience": 9, "quality": 7},
                            "Cy": {"experience": 5, "quality": 5},
                        },
                    },
                ],
            }
        )
        self.assertTrue(output["ok"])
        self.assertEqual([week["movie"] for week in output["history"]], ["Later id", "Earlier id"])

    def test_ranked_at_orders_replay_and_is_deterministic(self):
        def payload(reverse: bool):
            weeks = [
                {
                    "week_id": "2",
                    "suggester": "Bea",
                    "movie": "Second suggested",
                    "ranked_at": "2026-02-01T00:00:00.000Z",
                    "ratings": {
                        "Ada": {"experience": 8, "quality": 8},
                        "Cy": {"experience": 6, "quality": 6},
                    },
                },
                {
                    "week_id": "10",
                    "suggester": "Ada",
                    "movie": "First suggested",
                    "ranked_at": "2026-03-01T00:00:00.000Z",
                    "ratings": {
                        "Bea": {"experience": 9, "quality": 7},
                        "Cy": {"experience": 5, "quality": 5},
                    },
                },
            ]
            if reverse:
                weeks.reverse()
            return {"members": ["Ada", "Bea", "Cy"], "weeks": weeks}

        first = run_bridge(payload(False))
        second = run_bridge(payload(True))
        self.assertTrue(first["ok"])
        self.assertTrue(second["ok"])
        self.assertEqual([week["movie"] for week in first["history"]], ["Second suggested", "First suggested"])
        self.assertEqual([week["week_id"] for week in second["history"]], ["2", "10"])
        self.assertEqual(
            [row["elo"] for row in first["standings"]],
            [row["elo"] for row in second["standings"]],
        )
        self.assertAlmostEqual(first["total_elo"], 4500.0)


if __name__ == "__main__":
    unittest.main()
