import assert from "node:assert/strict"
import fs from "node:fs"
import { after, test } from "node:test"
import { authenticate, ensureBootstrapAdmin, findUserByUsername } from "../src/lib/auth"
import { resetBootstrapForTests } from "../src/lib/bootstrap"
import { productionConfigError } from "../src/lib/config"
import { closeDb, dbPath } from "../src/lib/db"
import { healthStatus } from "../src/lib/health"
import { prepareTestDb, setNodeEnv } from "./helpers.ts"

const dir = prepareTestDb()

after(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

test("DATA_DIR chooses the sqlite file and production defaults to /data", () => {
  const previousPath = process.env.CLUB_DB_PATH
  const previousData = process.env.DATA_DIR
  const previousEnv = process.env.NODE_ENV
  delete process.env.CLUB_DB_PATH
  process.env.DATA_DIR = "/tmp/reel-volume"
  try {
    assert.equal(dbPath(), "/tmp/reel-volume/club.db")
    delete process.env.DATA_DIR
    setNodeEnv("production")
    assert.equal(dbPath(), "/data/club.db")
  } finally {
    process.env.CLUB_DB_PATH = previousPath
    if (previousData === undefined) delete process.env.DATA_DIR
    else process.env.DATA_DIR = previousData
    setNodeEnv(previousEnv)
  }
})

test("ADMIN_USERNAME creates an admin once and does not reset the password", () => {
  process.env.ADMIN_USERNAME = "ada"
  process.env.ADMIN_NAME = "Ada"
  process.env.ADMIN_PASSWORD = "correct-horse"
  ensureBootstrapAdmin()
  assert.equal(findUserByUsername("ada")?.is_admin, 1)
  assert.equal(authenticate("ada", "correct-horse").name, "Ada")
  process.env.ADMIN_PASSWORD = "different-password"
  ensureBootstrapAdmin()
  assert.equal(authenticate("ada", "correct-horse").name, "Ada")
  assert.throws(() => authenticate("ada", "different-password"), /don't match/)
  delete process.env.ADMIN_USERNAME
  delete process.env.ADMIN_PASSWORD
  delete process.env.ADMIN_NAME
})

test("production refuses to start without INVITE_CODE and SESSION_SECRET", () => {
  const previousEnv = process.env.NODE_ENV
  const previousInvite = process.env.INVITE_CODE
  const previousSecret = process.env.SESSION_SECRET
  setNodeEnv("production")
  delete process.env.INVITE_CODE
  delete process.env.SESSION_SECRET
  resetBootstrapForTests()
  try {
    assert.match(productionConfigError() ?? "", /INVITE_CODE/)
    const blocked = healthStatus()
    assert.equal(blocked.status, 503)
    assert.match(blocked.error ?? "", /INVITE_CODE/)

    process.env.INVITE_CODE = "private-invite"
    process.env.SESSION_SECRET = "this-is-a-long-session-secret"
    resetBootstrapForTests()
    assert.equal(productionConfigError(), null)
    const healthy = healthStatus()
    assert.equal(healthy.status, 200)
    assert.equal(healthy.ok, true)
  } finally {
    setNodeEnv(previousEnv)
    process.env.INVITE_CODE = previousInvite
    if (previousSecret === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = previousSecret
    resetBootstrapForTests()
  }
})
