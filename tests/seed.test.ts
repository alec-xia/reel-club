import assert from "node:assert/strict"
import fs from "node:fs"
import { after, test } from "node:test"
import { authenticate } from "../src/lib/auth"
import { getOpenWeek, getRatings, loadLeague } from "../src/lib/club"
import { closeDb } from "../src/lib/db"
import { seedDemo } from "../src/lib/seed"
import { prepareTestDb } from "./helpers.ts"

const dir = prepareTestDb()

after(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

test("the demo club replays into a conserved leaderboard", () => {
  seedDemo()
  assert.equal(authenticate("mira", "reel-night").isAdmin, true)
  assert.equal(authenticate("sam", "reel-night").name, "Sam")
  const open = getOpenWeek()
  assert.equal(open?.movie, "Portrait of a Lady on Fire")
  assert.equal(open?.suggesterName, "Jules")
  assert.equal(getRatings(open?.id ?? 0).length, 2)
  const { league, error } = loadLeague(true)
  assert.equal(error, null)
  assert.ok(league)
  assert.equal(league.history.length, 6)
  assert.ok(Math.abs(league.total_elo - 7500) < 1e-6)
  const elos = league.standings.map((row) => row.elo)
  assert.ok(Math.max(...elos) - Math.min(...elos) > 10)
  assert.ok(league.preview)
  assert.equal(league.preview.suggester, "Jules")
})
