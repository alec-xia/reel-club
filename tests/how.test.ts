import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

// The Next compiler rewrites JSX. This test runner leaves `React` free, so
// publish it before loading the page module.
globalThis.React = React
import { formatDelta, formatElo } from "../src/lib/format.ts"
import {
  EXAMPLE_MEMBERS,
  NIGHT_BUS,
  ROOFTOP,
  ROOFTOP_CAM_EDIT,
  ROOFTOP_EDITED_RESULT,
  ROOFTOP_RESULT,
  scoreOf,
  type ExampleMovie,
} from "../src/lib/how-example.ts"
import { computeLeague, type RatingInput } from "../src/lib/ranking.ts"

function ratingsOf(movie: ExampleMovie, editCam?: { enjoy: number; film: number }): Record<string, RatingInput> {
  return Object.fromEntries(
    movie.ratings.map((row) => {
      const score = editCam && row.name === "Cam" ? editCam : row
      return [row.name, { experience: score.enjoy, quality: score.film }]
    }),
  )
}

function exampleWeeks(editCam?: { enjoy: number; film: number }) {
  return [
    {
      week_id: "1",
      suggester: NIGHT_BUS.suggester,
      movie: NIGHT_BUS.movie,
      ratings: ratingsOf(NIGHT_BUS),
    },
    {
      week_id: "2",
      suggester: ROOFTOP.suggester,
      movie: ROOFTOP.movie,
      ratings: ratingsOf(ROOFTOP, editCam),
    },
  ]
}

test("the how-page example matches the ranking engine", () => {
  const league = computeLeague({ members: [...EXAMPLE_MEMBERS], weeks: exampleWeeks() })
  assert.equal(league.history[0].movie, "Night Bus")
  assert.equal(league.history[0].matches.length, 0)
  assert.equal(Object.keys(league.history[0].deltas).length, 0)

  const match = league.history[1]
  assert.equal(match.movie, "Rooftop")
  assert.equal(match.matches.length, 1)
  assert.equal(match.matches[0].opponent, "Alex")
  assert.deepEqual(
    match.matches[0].judges.map((judge) => judge.judge).sort(),
    ["Cam", "Dee"],
  )
  assert.equal(formatDelta(match.deltas.Bea ?? 0), ROOFTOP_RESULT.beaDelta)
  assert.equal(formatElo(match.elo_after.Bea), ROOFTOP_RESULT.beaAfter)
  assert.equal(formatElo(match.elo_after.Alex), ROOFTOP_RESULT.alexAfter)
  assert.equal(formatElo(match.elo_after.Cam), ROOFTOP_RESULT.camAfter)
  assert.equal(formatElo(match.elo_after.Dee), ROOFTOP_RESULT.deeAfter)
  assert.equal(match.deltas.Cam, undefined)
  assert.equal(match.deltas.Dee, undefined)
  assert.ok(Math.abs(league.total_elo - 1500 * EXAMPLE_MEMBERS.length) < 1e-6)

  const cam = scoreOf(ROOFTOP, "Cam")
  const edited = computeLeague({
    members: [...EXAMPLE_MEMBERS],
    weeks: exampleWeeks(ROOFTOP_CAM_EDIT),
  })
  assert.notEqual(ROOFTOP_CAM_EDIT.enjoy, cam.enjoy)
  const editedMatch = edited.history[1]
  assert.equal(formatDelta(editedMatch.deltas.Bea ?? 0), ROOFTOP_EDITED_RESULT.beaDelta)
  assert.equal(formatElo(editedMatch.elo_after.Bea), ROOFTOP_EDITED_RESULT.beaAfter)
  assert.equal(formatElo(editedMatch.elo_after.Alex), ROOFTOP_EDITED_RESULT.alexAfter)
  assert.equal(edited.history.map((event) => event.movie).join("|"), "Night Bus|Rooftop")
})

test("two members never produce a neutral judge", () => {
  const league = computeLeague({
    members: ["Alex", "Bea"],
    weeks: [
      {
        week_id: "1",
        suggester: "Alex",
        movie: "Night Bus",
        ratings: { Bea: { experience: 8, quality: 6 } },
      },
      {
        week_id: "2",
        suggester: "Bea",
        movie: "Rooftop",
        ratings: { Alex: { experience: 8, quality: 8 } },
      },
    ],
  })
  assert.equal(league.history[1].matches.length, 0)
  assert.equal(league.history[1].skipped.Alex, "no common judges")
  assert.equal(Object.keys(league.history[1].deltas).length, 0)
  assert.ok(Math.abs(league.total_elo - 3000) < 1e-6)
})

test("the how page is public and states the example the engine produced", async () => {
  const { default: HowPage } = await import("../src/app/how/page.tsx")
  const html = renderToStaticMarkup(createElement(HowPage))
  assert.match(html, /Two honest scores/)
  assert.match(html, /Night Bus/)
  assert.match(html, /Rooftop/)
  assert.match(html, /are not in your club/)
  assert.match(html, /1508\.3/)
  assert.match(html, /1491\.7/)
  assert.match(html, /\+8\.3/)
  assert.match(html, /-8\.3/)
  assert.match(html, /Does skipping a movie hurt me\?/)
  assert.match(html, /Can I game it\?/)
  assert.match(html, /first score/)
  assert.match(html, /does not move it to the end/)
  assert.match(html, /don&#x27;t score your own suggestion|don't score your own suggestion/)
  assert.doesNotMatch(html, /voter/)
  assert.equal(html.includes("redirect"), false)
})

test("how is linked from the member nav and the pages members already use", () => {
  const nav = fs.readFileSync(new URL("../src/components/main-nav.tsx", import.meta.url), "utf8")
  assert.match(nav, /href:\s*"\/how"/)
  assert.match(nav, /label:\s*"How"/)
  for (const file of [
    "../src/components/shell.tsx",
    "../src/app/page.tsx",
    "../src/app/leaderboard/page.tsx",
    "../src/app/movies/[id]/page.tsx",
    "../src/components/movie-board.tsx",
  ]) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8")
    assert.match(source, /href="\/how"/)
  }
})
