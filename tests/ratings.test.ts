import assert from "node:assert/strict"
import fs from "node:fs"
import { after, describe, test } from "node:test"
import { createMember, findUserByUsername } from "../src/lib/auth"
import {
  closeWeek,
  getOpenWeek,
  getRatings,
  listWeeks,
  loadLeague,
  reopenLatest,
  submitRating,
  suggestMovie,
  withdrawOpenWeek,
} from "../src/lib/club"
import { closeDb } from "../src/lib/db"
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
  test("scores are editable until lock, then movie_elo replays the log", () => {
    const ada = createMember({ username: "ada", name: "Ada", password: "correct-horse", isAdmin: false })
    const bea = createMember({ username: "bea", name: "Bea", password: "correct-horse", isAdmin: false })
    const cy = createMember({ username: "cyo", name: "Cy", password: "correct-horse", isAdmin: true })

    const first = suggestMovie(ada.id, "  The Third Man  ", "A rainy one.")
    assert.equal(first.movie, "The Third Man")
    assert.equal(first.note, "A rainy one.")
    assert.equal(first.status, "open")
    assert.throws(() => suggestMovie(bea.id, "Another Film", null), /already a movie open/)
    assert.throws(() => closeWeek(ada.id), /at least one score/i)

    assert.throws(() => submitRating(ada.id, 8, 8), /don't score their own/)
    assert.throws(() => submitRating(bea.id, 0, 8), /1 to 10/)
    assert.throws(() => submitRating(bea.id, 11, 8), /1 to 10/)
    assert.throws(() => submitRating(bea.id, 7.25, 8), /half-point/)

    submitRating(bea.id, 8, 7)
    submitRating(bea.id, 8.5, 6.5)
    submitRating(cy.id, "9", "8")
    const beaScore = getRatings(first.id).find((rating) => rating.name === "Bea")
    assert.equal(beaScore?.experience, 8.5)
    assert.equal(beaScore?.quality, 6.5)

    assert.throws(() => closeWeek(bea.id), /locks the week/)
    const locked = closeWeek(ada.id)
    assert.equal(locked.status, "closed")
    assert.throws(() => submitRating(bea.id, 9, 9), /no movie open/)

    const afterFirst = loadLeague(false)
    assert.equal(afterFirst.error, null)
    assert.equal(afterFirst.league?.week_count, 1)
    assert.equal(afterFirst.league?.total_elo, 4500)
    assert.equal(afterFirst.league?.history[0].matches.length, 0)
    for (const standing of afterFirst.league?.standings ?? []) assert.equal(standing.elo, 1500)

    suggestMovie(bea.id, "Heat", null)
    submitRating(ada.id, 9, 8)
    submitRating(cy.id, 6, 5)
    closeWeek(cy.id)

    const afterSecond = loadLeague(false)
    assert.equal(afterSecond.error, null)
    const league = afterSecond.league
    assert.ok(league)
    assert.ok(Math.abs(league.total_elo - 4500) < 1e-6)
    assert.ok(league.standings.some((row) => Math.abs(row.elo - 1500) > 0.1))
    const week = league.history[1]
    const deltaSum = Object.values(week.deltas).reduce((total, delta) => total + delta, 0)
    assert.ok(Math.abs(deltaSum) < 1e-6)
    assert.equal(week.suggester, "Bea")
    assert.ok(!week.matches.some((match) => match.judges.some((judge) => judge.judge === "Bea" || judge.judge === "Ada")))
    const matchDelta = week.matches.reduce((total, match) => total + match.delta, 0)
    assert.ok(Math.abs((week.deltas.Bea ?? 0) - matchDelta) < 1e-6)

    assert.throws(() => reopenLatest(ada.id), /admin/)
    const reopened = reopenLatest(cy.id)
    assert.equal(reopened.status, "open")
    submitRating(cy.id, 9, 9)
    closeWeek(bea.id)
    const rewritten = loadLeague(false).league
    assert.ok(rewritten)
    assert.notEqual(rewritten.history[1].deltas.Bea, week.deltas.Bea)
    assert.ok(Math.abs(rewritten.total_elo - 4500) < 1e-6)
  })

  test("withdrawing an open pick removes its scores", () => {
    assert.equal(getOpenWeek(), null)
    const before = listWeeks().length
    const week = suggestMovie(idOf("ada"), "Withdrawn", null)
    submitRating(idOf("bea"), 7, 7)
    assert.equal(getRatings(week.id).length, 1)
    assert.throws(() => withdrawOpenWeek(idOf("bea")), /picker or an admin/)
    withdrawOpenWeek(idOf("ada"))
    assert.equal(getOpenWeek(), null)
    assert.equal(listWeeks().length, before)
  })
})
