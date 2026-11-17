import json
import tempfile
import unittest
from pathlib import Path

from movie_elo import (
    League,
    Params,
    Rating,
    ValidationError,
    Week,
    format_standings,
    format_week_report,
    load_league,
    load_log,
    log_from_dict,
    log_to_dict,
    replay,
    replay_log,
    save_league,
    save_log,
)

from helpers import E_WEEK, MEMBERS, ROTATION, mid_season_league


class WeekSerializationTests(unittest.TestCase):
    def test_ratings_are_coerced_from_pairs_and_mappings(self):
        w = Week("w", "A", "M", {"B": (7, 8), "C": {"experience": 6, "quality": 5}, "D": Rating(9, 9)})
        self.assertEqual(w.ratings["B"], Rating(7.0, 8.0))
        self.assertEqual(w.ratings["C"], Rating(6.0, 5.0))
        self.assertEqual(w.raters, ("B", "C", "D"))
        with self.assertRaises(ValidationError):
            Week("w", "A", "M", {"B": (7,)})
        with self.assertRaises(ValidationError):
            Week("w", "A", "M", {"B": "seven"})

    def test_round_trip_through_dict_and_json(self):
        w = Week(
            "2026-11-14", "Eve", "Example", {"Alex": (8, 7), "Bea": (7, 6)},
            candidates=("Example", "Other"), votes={"Alex": "Example", "Bea": "Other"}, date="2026-11-14",
        )
        again = Week.from_dict(json.loads(json.dumps(w.to_dict())))
        self.assertEqual(again, w)
        minimal = Week.from_dict({"week_id": "w", "suggester": "A", "movie": "M", "ratings": {"B": {"experience": 5, "quality": 5}}})
        self.assertEqual(minimal.candidates, ())
        self.assertEqual(minimal.votes, {})
        with self.assertRaises(ValidationError):
            Week.from_dict({"week_id": "w", "suggester": "A"})


class ParamsSerializationTests(unittest.TestCase):
    def test_round_trip_and_unknown_fields(self):
        p = Params(k=24, voter_share=0.1, max_pick_age=8)
        self.assertEqual(Params.from_dict(json.loads(json.dumps(p.to_dict()))), p)
        with self.assertRaises(ValidationError):
            Params.from_dict({"kay": 1})


class LeagueSnapshotTests(unittest.TestCase):
    def test_snapshot_round_trip_preserves_state_and_future_behaviour(self):
        league = replay(MEMBERS, ROTATION, Params(voter_share=0.1))
        data = json.loads(json.dumps(league.to_dict()))
        restored = League.from_dict(data)
        self.assertEqual(restored.elo, league.elo)
        self.assertEqual(restored.picks, league.picks)
        self.assertEqual(restored.pick_counts, league.pick_counts)
        self.assertEqual(restored.processed_weeks, league.processed_weeks)
        self.assertEqual(restored.week_count, league.week_count)
        self.assertEqual(restored.history, league.history)
        self.assertEqual(restored.params, league.params)
        nxt = Week("w6", "A", "M6", {"B": (7, 7), "C": (6, 6), "D": (8, 8), "E": (8, 7)})
        self.assertEqual(restored.play_week(nxt), league.play_week(nxt))

    def test_bad_snapshot_versions_rejected(self):
        with self.assertRaises(ValidationError):
            League.from_dict({"version": 99, "params": {}, "elo": {}})

    def test_mid_season_fixture_builds_through_public_api(self):
        league = mid_season_league()
        self.assertEqual(league.members, tuple(MEMBERS))
        self.assertEqual(league.week_count, 4)
        self.assertEqual(sorted(league.picks), ["A", "B", "C", "D"])


class StorageTests(unittest.TestCase):
    def test_log_round_trip_and_replay_log(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "log.json"
            save_log(path, MEMBERS, ROTATION, Params(k=24))
            members, weeks, params = load_log(path)
            self.assertEqual(members, MEMBERS)
            self.assertEqual(weeks, ROTATION)
            self.assertEqual(params, Params(k=24))
            self.assertEqual(replay_log(path).elo, replay(MEMBERS, ROTATION, Params(k=24)).elo)
            # Override params on replay without touching the file.
            self.assertEqual(replay_log(path, Params(k=48)).elo, replay(MEMBERS, ROTATION, Params(k=48)).elo)

    def test_log_dict_version_check(self):
        with self.assertRaises(ValidationError):
            log_from_dict({"version": 2, "members": [], "weeks": []})
        members, weeks, params = log_from_dict(log_to_dict(MEMBERS, ROTATION))
        self.assertEqual((members, weeks, params), (MEMBERS, ROTATION, Params()))

    def test_league_snapshot_file_round_trip(self):
        league = replay(MEMBERS, ROTATION)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "league.json"
            save_league(path, league)
            self.assertEqual(load_league(path).to_dict(), league.to_dict())


class ReportTests(unittest.TestCase):
    def test_reports_render_key_facts(self):
        league = mid_season_league()
        result = league.play_week(E_WEEK)
        text = format_week_report(result)
        self.assertIn("vs A", text)
        self.assertIn("Δ +14.4", text)
        self.assertIn("E            +44.9", text)
        table = format_standings(league)
        self.assertIn("A", table.splitlines()[2])  # A leads after the header rows
        self.assertEqual(format_standings(League()), "(no members)")
        empty = League(MEMBERS).play_week(ROTATION[0])
        self.assertIn("nothing changes", format_week_report(empty))


if __name__ == "__main__":
    unittest.main()
