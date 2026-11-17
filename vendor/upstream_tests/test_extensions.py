import unittest

from movie_elo import League, Params, ValidationError, Week, replay

from helpers import E_WEEK, MEMBERS, ROTATION, mid_season_league


class VoterCreditTests(unittest.TestCase):
    def _week(self):
        return Week(
            "w4", "E", "E's pick",
            {"A": (8, 7), "B": (7, 6), "C": (9, 8), "D": (6, 7)},
            candidates=("E's pick", "Other 1", "Other 2"),
            votes={"A": "E's pick", "C": "E's pick", "B": "Other 1", "D": "Other 2"},
        )

    def test_voters_share_the_suggesters_delta_and_total_is_conserved(self):
        base = mid_season_league().preview_week(E_WEEK)
        league = mid_season_league(Params(voter_share=0.2))
        result = league.play_week(self._week())
        self.assertAlmostEqual(result.match_total, base.match_total)      # matches are unchanged
        credit = 0.2 * result.match_total
        self.assertAlmostEqual(result.suggester_delta, result.match_total - credit)
        self.assertAlmostEqual(result.voter_credit["A"], credit / 2)
        self.assertAlmostEqual(result.voter_credit["C"], credit / 2)
        self.assertNotIn("B", result.voter_credit)
        # A is also an opponent: its final delta is match loss plus voter credit.
        self.assertAlmostEqual(result.deltas["A"], base.deltas["A"] + credit / 2)
        self.assertAlmostEqual(league.total_elo(), 7500.0)

    def test_no_votes_for_chosen_movie_means_suggester_keeps_everything(self):
        league = mid_season_league(Params(voter_share=0.2))
        result = league.play_week(E_WEEK)  # no votes recorded
        self.assertEqual(result.voter_credit, {})
        self.assertAlmostEqual(result.suggester_delta, result.match_total)

    def test_votes_must_be_for_candidates_and_movie_must_be_a_candidate(self):
        with self.assertRaises(ValidationError):
            Week("w", "A", "X", {"B": (5, 5)}, candidates=("Y", "Z"))
        with self.assertRaises(ValidationError):
            Week("w", "A", "X", {"B": (5, 5)}, candidates=("X", "Y"), votes={"B": "Q"})


class ProvisionalKTests(unittest.TestCase):
    def test_first_picks_use_k_provisional(self):
        params = Params(provisional_picks=1, k_provisional=48.0)
        league = replay(MEMBERS, ROTATION, params)
        # During the first rotation everyone is on pick #1, so every match used 48.
        for result in league.history:
            for match in result.matches:
                self.assertEqual(match.k, 48.0)
        # Second rotation: A's pick #2 vs others' pick #1 -> still provisional (opponent).
        result = league.play_week(Week("w6", "A", "M6", {"B": (7, 7), "C": (6, 6), "D": (8, 8), "E": (8, 7)}))
        self.assertTrue(all(m.k == 48.0 for m in result.matches))
        for w in ROTATION[1:]:
            league.play_week(Week(w.week_id + "b", w.suggester, w.movie + "b", w.ratings))
        # Third rotation: everyone is on pick >= 2 -> regular K.
        result = league.play_week(Week("w11", "A", "M11", {"B": (7, 7), "C": (6, 6), "D": (8, 8), "E": (8, 7)}))
        self.assertTrue(all(m.k == 32.0 for m in result.matches))
        self.assertAlmostEqual(league.total_elo(), 7500.0)

    def test_k_provisional_defaults_to_k(self):
        self.assertEqual(Params(provisional_picks=2).effective_k_provisional, 32.0)


class StalenessTests(unittest.TestCase):
    def test_old_picks_stop_defending(self):
        league = replay(MEMBERS, ROTATION, Params(max_pick_age=3))
        # Week index is now 5. A's pick was made at index 0 (age 5), B at 1 (age 4), C at 2 (age 3).
        result = league.play_week(Week("w6", "A", "M6", {"B": (7, 7), "C": (6, 6), "D": (8, 8), "E": (8, 7)}))
        self.assertEqual(result.skipped, {"B": "stale pick"})
        self.assertEqual(sorted(m.opponent for m in result.matches), ["C", "D", "E"])

    def test_default_has_no_staleness(self):
        league = replay(MEMBERS, ROTATION)
        result = league.preview_week(Week("w6", "A", "M6", {"B": (7, 7), "C": (6, 6), "D": (8, 8), "E": (8, 7)}))
        self.assertEqual(result.skipped, {})
        self.assertEqual(len(result.matches), 4)


class AlphaAndScaleTests(unittest.TestCase):
    def test_alpha_selects_the_metric(self):
        exp_only = replay(MEMBERS, ROTATION, Params(alpha=1.0))
        qual_only = replay(MEMBERS, ROTATION, Params(alpha=0.0))
        blended = replay(MEMBERS, ROTATION)
        self.assertNotEqual(exp_only.elo, qual_only.elo)
        self.assertNotEqual(blended.elo, exp_only.elo)
        for league in (exp_only, qual_only, blended):
            self.assertAlmostEqual(league.total_elo(), 7500.0)

    def test_params_validation(self):
        for bad in (
            dict(k=0), dict(d=-1), dict(w=0), dict(alpha=1.5), dict(scale_min=10, scale_max=1),
            dict(voter_share=1.0), dict(provisional_picks=-1), dict(k_provisional=0), dict(max_pick_age=0),
        ):
            with self.assertRaises(ValidationError, msg=bad):
                Params(**bad)

    def test_shifting_all_elo_by_a_constant_changes_nothing(self):
        a = mid_season_league()
        b = mid_season_league()
        for m in MEMBERS:
            b._elo[m] += 250.0  # deliberately poke internals to simulate an off-centre league
        ra, rb = a.preview_week(E_WEEK), b.preview_week(E_WEEK)
        for m in MEMBERS:
            self.assertAlmostEqual(ra.deltas.get(m, 0.0), rb.deltas.get(m, 0.0))


if __name__ == "__main__":
    unittest.main()
