import unittest

from movie_elo import (
    DuplicateWeekError,
    League,
    Params,
    UnknownMemberError,
    ValidationError,
    Week,
    replay,
)

from helpers import E_WEEK, MEMBERS, ROTATION, mid_season_league


class WorkedExampleTests(unittest.TestCase):
    def test_reproduces_readme_numbers(self):
        league = mid_season_league()
        result = league.play_week(E_WEEK)
        rounded = {m: round(d, 1) for m, d in result.deltas.items()}
        self.assertEqual(rounded, {"E": 44.9, "A": -14.4, "B": -20.0, "C": 4.2, "D": -14.8})
        by_opp = {m.opponent: m for m in result.matches}
        self.assertAlmostEqual(by_opp["A"].gap, 0.237, places=3)
        self.assertAlmostEqual(by_opp["A"].actual, 0.568, places=3)
        self.assertAlmostEqual(by_opp["A"].expected, 0.118, places=3)
        self.assertAlmostEqual(league.total_elo(), 7500.0)
        self.assertEqual([s.member for s in league.standings()], ["A", "B", "C", "E", "D"])

    def test_judges_exclude_both_suggesters_and_weights_sum_to_one(self):
        result = mid_season_league().preview_week(E_WEEK)
        for match in result.matches:
            judges = {v.judge for v in match.judges}
            self.assertNotIn("E", judges)
            self.assertNotIn(match.opponent, judges)
            self.assertEqual(len(judges), 3)
            self.assertAlmostEqual(sum(v.weight for v in match.judges), 1.0)

    def test_higher_elo_judge_has_more_weight(self):
        result = mid_season_league().preview_week(E_WEEK)
        match = next(m for m in result.matches if m.opponent == "A")  # judges B(1550) C(1500) D(1400)
        w = {v.judge: v.weight for v in match.judges}
        self.assertGreater(w["B"], w["C"])
        self.assertGreater(w["C"], w["D"])
        self.assertAlmostEqual(w["B"] / w["D"], 2 ** (150 / 400), places=9)

    def test_result_is_independent_of_opponent_processing_order(self):
        a = mid_season_league(pick_order=("A", "B", "C", "D")).preview_week(E_WEEK)
        b = mid_season_league(pick_order=("D", "C", "B", "A")).preview_week(E_WEEK)
        for m in MEMBERS:
            self.assertAlmostEqual(a.deltas.get(m, 0.0), b.deltas.get(m, 0.0))


class LifecycleTests(unittest.TestCase):
    def test_week_one_moves_nothing(self):
        league = League(MEMBERS)
        result = league.play_week(ROTATION[0])
        self.assertEqual(result.matches, ())
        self.assertEqual(result.deltas, {})
        self.assertEqual(league.elo, {m: 1500.0 for m in MEMBERS})
        self.assertEqual(league.picks["A"].movie, "M1")

    def test_conservation_and_match_counts_over_a_rotation(self):
        league = League(MEMBERS)
        for i, week in enumerate(ROTATION):
            result = league.play_week(week)
            self.assertEqual(len(result.matches), i)  # i opponents have picks so far
            self.assertAlmostEqual(league.total_elo(), 7500.0, places=9)
        self.assertEqual(league.week_count, 5)
        self.assertEqual(league.processed_weeks, tuple(w.week_id for w in ROTATION))

    def test_replay_matches_incremental_play_and_is_deterministic(self):
        incremental = League(MEMBERS)
        for week in ROTATION:
            incremental.play_week(week)
        self.assertEqual(replay(MEMBERS, ROTATION).elo, incremental.elo)
        self.assertEqual(replay(MEMBERS, ROTATION).elo, replay(MEMBERS, ROTATION).elo)

    def test_preview_does_not_mutate(self):
        league = mid_season_league()
        before = (league.elo, league.picks, league.week_count, league.history)
        league.preview_week(E_WEEK)
        self.assertEqual((league.elo, league.picks, league.week_count, league.history), before)

    def test_absent_rater_is_not_a_judge_and_empty_match_is_skipped(self):
        league = League(MEMBERS)
        league.play_week(Week("w1", "A", "M1", {"B": (7, 7)}))           # only B saw A's pick
        league.play_week(Week("w2", "C", "M2", {"A": (6, 6), "D": (6, 6)}))  # B did not see C's pick
        result = league.history[-1]
        self.assertEqual(result.matches, ())
        self.assertEqual(result.skipped, {"A": "no common judges"})
        result = league.play_week(Week("w3", "D", "M3", {"A": (8, 8), "B": (5, 5), "C": (7, 7)}))
        by_opp = {m.opponent: m for m in result.matches}
        self.assertEqual([v.judge for v in by_opp["A"].judges], ["B"])      # only B rated both
        self.assertEqual([v.judge for v in by_opp["C"].judges], ["A"])      # only A rated both

    def test_history_records_before_and_after(self):
        league = mid_season_league()
        result = league.play_week(E_WEEK)
        self.assertEqual(result.elo_before["E"], 1350.0)
        self.assertAlmostEqual(result.elo_after["E"], league.rating("E"))
        self.assertEqual(league.history[-1], result)


class ValidationTests(unittest.TestCase):
    def test_duplicate_week_rejected(self):
        league = League(MEMBERS)
        league.play_week(ROTATION[0])
        with self.assertRaises(DuplicateWeekError):
            league.play_week(ROTATION[0])
        with self.assertRaises(DuplicateWeekError):
            league.preview_week(ROTATION[0])

    def test_unknown_members_rejected(self):
        league = League(MEMBERS)
        with self.assertRaises(UnknownMemberError):
            league.play_week(Week("w", "Zed", "M", {"A": (5, 5)}))
        with self.assertRaises(UnknownMemberError):
            league.play_week(Week("w", "A", "M", {"Zed": (5, 5)}))
        with self.assertRaises(UnknownMemberError):
            league.play_week(Week("w", "A", "M", {"B": (5, 5)}, votes={"Zed": "M"}))
        with self.assertRaises(UnknownMemberError):
            league.rating("Zed")

    def test_suggester_may_not_rate_or_vote(self):
        league = League(MEMBERS)
        with self.assertRaises(ValidationError):
            league.play_week(Week("w", "A", "M", {"A": (5, 5), "B": (5, 5)}))
        with self.assertRaises(ValidationError):
            league.play_week(Week("w", "A", "M", {"B": (5, 5)}, votes={"A": "M"}))

    def test_ratings_must_be_present_and_in_range(self):
        league = League(MEMBERS)
        with self.assertRaises(ValidationError):
            league.play_week(Week("w", "A", "M", {}))
        with self.assertRaises(ValidationError):
            league.play_week(Week("w", "A", "M", {"B": (0, 5)}))
        with self.assertRaises(ValidationError):
            league.play_week(Week("w", "A", "M", {"B": (5, 11)}))
        league5 = League(MEMBERS, Params(scale_min=1, scale_max=5, d=1.0))
        league5.play_week(Week("w", "A", "M", {"B": (5, 4.5)}))  # within the custom scale

    def test_failed_validation_leaves_state_untouched(self):
        league = mid_season_league()
        before = league.to_dict()
        with self.assertRaises(ValidationError):
            league.play_week(Week("w9", "E", "M", {"A": (8, 7), "Zed": (5, 5)}))
        self.assertEqual(league.to_dict(), before)


class MembershipTests(unittest.TestCase):
    def test_add_member_starts_at_group_mean_and_can_judge(self):
        league = replay(MEMBERS, ROTATION)
        league.add_member("F")
        self.assertEqual(league.rating("F"), 1500.0)
        result = league.play_week(Week("w6", "A", "M6", {"B": (7, 7), "C": (7, 7), "D": (7, 7), "E": (7, 7), "F": (9, 9)}))
        self.assertNotIn("F", [m.opponent for m in result.matches])  # F has no pick yet
        self.assertAlmostEqual(league.total_elo(), 1500.0 * 6)
        with self.assertRaises(ValidationError):
            league.add_member("F")

    def test_remove_member_recenters_without_changing_future_results(self):
        a = mid_season_league()
        b = mid_season_league()
        a.remove_member("B", recenter=True)
        b.remove_member("B", recenter=False)
        self.assertAlmostEqual(a.total_elo() / 4, 1500.0)
        self.assertNotAlmostEqual(b.total_elo() / 4, 1500.0)
        week_without_b = Week("w4", "E", "E's pick", {"A": (8, 7), "C": (9, 8), "D": (6, 7)})
        ra = a.preview_week(week_without_b)
        rb = b.preview_week(week_without_b)
        for m in ("A", "C", "D", "E"):
            self.assertAlmostEqual(ra.deltas.get(m, 0.0), rb.deltas.get(m, 0.0))
        self.assertNotIn("B", ra.elo_after)
        # B's old ratings remain inside other members' picks but B can no longer judge.
        for match in ra.matches:
            self.assertNotIn("B", [v.judge for v in match.judges])
        with self.assertRaises(UnknownMemberError):
            a.preview_week(E_WEEK)  # E_WEEK still contains a rating from the removed member
        with self.assertRaises(UnknownMemberError):
            a.remove_member("B")

    def test_standings_are_ranked_and_describe_picks(self):
        league = replay(MEMBERS, ROTATION)
        rows = league.standings()
        self.assertEqual([r.rank for r in rows], [1, 2, 3, 4, 5])
        self.assertEqual([r.elo for r in rows], sorted((r.elo for r in rows), reverse=True))
        self.assertTrue(all(r.pick_count == 1 for r in rows))
        self.assertEqual({r.member: r.current_movie for r in rows}["C"], "M3")


if __name__ == "__main__":
    unittest.main()
