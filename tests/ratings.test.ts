import assert from "node:assert/strict"
import fs from "node:fs"
import { after, before, describe, test } from "node:test"
import { createMember, findUserByUsername } from "../src/lib/auth"
import {
  getMovie,
  getRatings,
  listMovies,
  loadLeague,
  rankedMovieInputs,
  removeSuggestion,
  submitRating,
  suggestMovie,
} from "../src/lib/club"
import { closeDb, getDb } from "../src/lib/db"
import { prepareTestDb } from "./helpers.ts"

const dir = prepareTestDb()

after(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

function idOf(username: string): number {
  const user = findUserByUsername(username)
  if (!user) throw new Error(`missing ${username}`)
  return user.id
}

describe("ratings and ranking", { concurrency: 1 }, () => {
  before(() => {
    createMember({ username: "ada", name: "Ada", password: "correct-horse", isAdmin: false })
    createMember({ username: "bea", name: "Bea", password: "correct-horse", isAdmin: false })
    createMember({ username: "cyo", name: "Cy", password: "correct-horse", isAdmin: true })
  })

  test("several suggestions can be rated out of order and replay by first-score time", () => {
    assert.equal(getDb().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'weeks'").get(), undefined)

    const early = suggestMovie(idOf("ada"), "  The Third Man  ", "A rainy one.", {
      suggestedAt: "2026-01-01T18:00:00.000Z",
    })
    const later = suggestMovie(idOf("bea"), "Heat", null, { suggestedAt: "2026-02-01T18:00:00.000Z" })
    const waiting = suggestMovie(idOf("cyo"), "Also Waiting", null, { suggestedAt: "2026-03-01T18:00:00.000Z" })
    const secondFromAda = suggestMovie(idOf("ada"), "Another from Ada", null, {
      suggestedAt: "2026-03-02T18:00:00.000Z",
    })

    assert.equal(early.movie, "The Third Man")
    assert.equal(early.note, "A rainy one.")
    assert.equal(early.rankedAt, null)
    assert.equal(early.ratingCount, 0)
    assert.notEqual(early.id, secondFromAda.id)
    assert.equal(loadLeague().league?.history.length, 0)

    assert.throws(() => submitRating(idOf("ada"), early.id, 8, 8), /don't score their own/)
    assert.throws(() => submitRating(idOf("bea"), later.id, 8, 8), /don't score their own/)
    assert.throws(() => submitRating(idOf("bea"), early.id, 0, 8), /1 to 10/)
    assert.throws(() => submitRating(idOf("bea"), early.id, 11, 8), /1 to 10/)
    assert.throws(() => submitRating(idOf("bea"), early.id, 7.25, 8), /half-point/)

    // Watch the later suggestion first.
    submitRating(idOf("ada"), later.id, 9, 8, { at: "2026-04-02T00:00:00.000Z" })
    submitRating(idOf("cyo"), later.id, 7, 6, { at: "2026-04-03T00:00:00.000Z" })
    submitRating(idOf("cyo"), later.id, 7.5, 6.5, { at: "2026-04-04T00:00:00.000Z" })
    const cyOnLater = getRatings(later.id).find((rating) => rating.name === "Cy")
    assert.equal(cyOnLater?.experience, 7.5)
    assert.equal(cyOnLater?.quality, 6.5)
    assert.equal(cyOnLater?.createdAt, "2026-04-03T00:00:00.000Z")
    assert.equal(getMovie(later.id)?.rankedAt, "2026-04-02T00:00:00.000Z")

    // Then score the suggestion that was added first.
    submitRating(idOf("bea"), early.id, 8, 8, { at: "2026-05-01T00:00:00.000Z" })
    submitRating(idOf("cyo"), early.id, 4, 5, { at: "2026-05-02T00:00:00.000Z" })

    const loaded = loadLeague()
    assert.equal(loaded.error, null)
    const league = loaded.league
    assert.ok(league)
    const titles = league.history.map((event) => event.movie)
    assert.deepEqual(titles, ["Heat", "The Third Man"])
    assert.equal(titles.includes("Also Waiting"), false)
    assert.equal(titles.includes("Another from Ada"), false)
    assert.equal(league.history[0].matches.length, 0)
    assert.equal(league.history[0].suggester, "Bea")
    assert.equal(league.history[1].suggester, "Ada")
    assert.equal(league.history[1].matches.length, 1)
    assert.equal(league.history[1].matches[0].opponent, "Bea")
    assert.ok(league.history[1].matches[0].judges.every((judge) => judge.judge === "Cy"))
    assert.ok(Math.abs(league.total_elo - 4500) < 1e-6)
    const deltaSum = Object.values(league.history[1].deltas).reduce((total, delta) => total + delta, 0)
    assert.ok(Math.abs(deltaSum) < 1e-6)
    assert.deepEqual(
      rankedMovieInputs().map((input) => input.movie),
      ["Heat", "The Third Man"],
    )

    const again = loadLeague().league
    assert.deepEqual(
      again?.standings.map((row) => [row.member, row.elo]),
      league.standings.map((row) => [row.member, row.elo]),
    )
    assert.deepEqual(
      again?.history.map((event) => event.week_id),
      league.history.map((event) => event.week_id),
    )

    const beforeAda = league.history[1].deltas.Ada
    submitRating(idOf("cyo"), later.id, 9, 9, { at: "2026-06-01T00:00:00.000Z" })
    const edited = loadLeague().league
    assert.ok(edited)
    assert.deepEqual(
      edited.history.map((event) => event.movie),
      ["Heat", "The Third Man"],
    )
    assert.equal(getMovie(later.id)?.rankedAt, "2026-04-02T00:00:00.000Z")
    assert.notEqual(edited.history[1].deltas.Ada, beforeAda)
    assert.ok(Math.abs(edited.total_elo - 4500) < 1e-6)
    assert.equal(getRatings(later.id).length, 2)
    assert.equal(waiting.movie, "Also Waiting")
  })

  test("unscored suggestions can be removed and scored ones stay", () => {
    const before = listMovies().length
    const extra = suggestMovie(idOf("ada"), "Never watched", null)
    suggestMovie(idOf("bea"), "Also never", null)
    assert.equal(listMovies().filter((movie) => movie.ratingCount === 0).length >= 2, true)
    assert.throws(() => removeSuggestion(idOf("bea"), extra.id), /suggested this/)
    removeSuggestion(idOf("ada"), extra.id)
    assert.equal(getMovie(extra.id), null)

    const pulled = suggestMovie(idOf("ada"), "Admin pulls it", null)
    removeSuggestion(idOf("cyo"), pulled.id)
    assert.equal(getMovie(pulled.id), null)

    const scored = suggestMovie(idOf("cyo"), "Already scored", null, { suggestedAt: "2026-07-01T00:00:00.000Z" })
    submitRating(idOf("ada"), scored.id, 7, 7, { at: "2026-07-02T00:00:00.000Z" })
    assert.throws(() => removeSuggestion(idOf("cyo"), scored.id), /stays in the ranking/)
    assert.equal(getMovie(scored.id)?.ratingCount, 1)

    const history = loadLeague().league?.history.map((event) => event.movie) ?? []
    assert.equal(history.at(-1), "Already scored")
    assert.ok(history.indexOf("Heat") < history.indexOf("The Third Man"))
    assert.ok(history.indexOf("The Third Man") < history.indexOf("Already scored"))

    closeDb()
    assert.equal(listMovies().length, before + 2)
    assert.equal(getDb().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'weeks'").get(), undefined)
  })
})
