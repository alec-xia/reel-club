import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { computeLeague, RankingError } from "../src/lib/ranking.ts"

describe("movie_elo bridge", () => {
  test("replay conserves Elo and refuses a suggester rating", () => {
    const league = computeLeague({
      members: ["Ada", "Bea", "Cy"],
      weeks: [
        {
          week_id: "2026-01-02",
          suggester: "Ada",
          movie: "Opening",
          ratings: {
            Bea: { experience: 8, quality: 6 },
            Cy: { experience: 7, quality: 7 },
          },
        },
        {
          week_id: "2026-01-09",
          suggester: "Bea",
          movie: "Follow-up",
          ratings: {
            Ada: { experience: 9, quality: 8 },
            Cy: { experience: 4, quality: 5 },
          },
        },
      ],
    })

    assert.equal(league.week_count, 2)
    assert.ok(Math.abs(league.total_elo - 4500) < 1e-6)
    assert.equal(league.history[0].matches.length, 0)
    assert.equal(league.history[0].report.includes("nothing changes"), true)
    assert.equal(league.history[1].matches.length, 1)
    assert.equal(league.history[1].matches[0].opponent, "Ada")
    assert.equal(league.standings_report.includes("Ada"), true)

    const again = computeLeague({
      members: ["Ada", "Bea", "Cy"],
      weeks: [
        {
          week_id: "2026-01-02",
          suggester: "Ada",
          movie: "Opening",
          ratings: {
            Bea: { experience: 8, quality: 6 },
            Cy: { experience: 7, quality: 7 },
          },
        },
        {
          week_id: "2026-01-09",
          suggester: "Bea",
          movie: "Follow-up",
          ratings: {
            Ada: { experience: 9, quality: 8 },
            Cy: { experience: 4, quality: 5 },
          },
        },
      ],
    })
    assert.deepEqual(again.standings, league.standings)
    assert.deepEqual(again.history[1].deltas, league.history[1].deltas)

    assert.throws(
      () =>
        computeLeague({
          members: ["Ada", "Bea", "Cy"],
          weeks: [
            {
              week_id: "2026-01-16",
              suggester: "Ada",
              movie: "Self scored",
              ratings: {
                Ada: { experience: 10, quality: 10 },
                Bea: { experience: 5, quality: 5 },
              },
            },
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof RankingError)
        assert.match(error.message, /suggester must not rate/)
        return true
      },
    )

    const preview = computeLeague({
      members: ["Ada", "Bea", "Cy"],
      weeks: [],
      preview: {
        week_id: "2026-01-16",
        suggester: "Ada",
        movie: "Self scored",
        ratings: { Ada: { experience: 10, quality: 10 }, Bea: { experience: 5, quality: 5 } },
      },
    })
    assert.match(preview.preview_error?.error ?? "", /suggester must not rate/)
    assert.equal(preview.standings.length, 3)
  })
})
