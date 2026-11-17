import unittest

from movie_elo import Rating, actual_score, combined_score, expected_score, judge_weight, normalize


class FormulaTests(unittest.TestCase):
    def test_expected_score_is_symmetric_and_centered(self):
        self.assertAlmostEqual(expected_score(1500, 1500), 0.5)
        self.assertAlmostEqual(expected_score(1700, 1500) + expected_score(1500, 1700), 1.0)
        self.assertAlmostEqual(expected_score(1900, 1500), 10 / 11, places=9)  # +400 -> 10:1

    def test_actual_score_scale(self):
        self.assertAlmostEqual(actual_score(0.0, 2.0), 0.5)
        self.assertAlmostEqual(actual_score(2.0, 2.0), 10 / 11, places=9)
        self.assertAlmostEqual(actual_score(1.0, 2.0), 1 / (1 + 10 ** -0.5), places=9)
        self.assertAlmostEqual(actual_score(-1.5, 2.0) + actual_score(1.5, 2.0), 1.0)

    def test_judge_weight_doubles_every_w(self):
        self.assertAlmostEqual(judge_weight(1500, 1500, 400), 1.0)
        self.assertAlmostEqual(judge_weight(1900, 1500, 400), 2.0)
        self.assertAlmostEqual(judge_weight(1100, 1500, 400), 0.5)
        self.assertAlmostEqual(judge_weight(1700, 1500, 200), 2.0)

    def test_normalize(self):
        n = normalize({"a": 1.0, "b": 3.0})
        self.assertAlmostEqual(sum(n.values()), 1.0)
        self.assertAlmostEqual(n["b"], 0.75)
        with self.assertRaises(ValueError):
            normalize({"a": 0.0})

    def test_combined_score(self):
        r = Rating(8, 6)
        self.assertAlmostEqual(combined_score(r, 0.5), 7.0)
        self.assertAlmostEqual(combined_score(r, 1.0), 8.0)
        self.assertAlmostEqual(combined_score(r, 0.0), 6.0)


if __name__ == "__main__":
    unittest.main()
