import assert from "node:assert/strict"
import fs from "node:fs"
import { after, describe, test } from "node:test"
import {
  authenticate,
  createMember,
  createSession,
  destroySession,
  getInviteCode,
  hashPassword,
  registerMember,
  userFromToken,
} from "../src/lib/auth"
import { closeDb, getDb } from "../src/lib/db"
import { prepareTestDb, setNodeEnv } from "./helpers.ts"

const dir = prepareTestDb()

after(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("auth", { concurrency: 1 }, () => {
  test("rejects a bad invite, a short password, and a duplicate username", () => {
    assert.throws(
      () =>
        registerMember({
          username: "mira",
          name: "Mira",
          password: "correct-horse",
          inviteCode: "nope",
        }),
      /invite code/i,
    )
    assert.throws(
      () =>
        registerMember({
          username: "mira",
          name: "Mira",
          password: "short",
          inviteCode: "test-invite",
        }),
      /8 characters/,
    )
    const user = registerMember({
      username: "Mira",
      name: "Mira",
      password: "correct-horse",
      inviteCode: "test-invite",
    })
    assert.equal(user.username, "mira")
    assert.equal(user.isAdmin, true)
    const later = registerMember({
      username: "noor",
      name: "Noor",
      password: "correct-horse",
      inviteCode: "test-invite",
    })
    assert.equal(later.isAdmin, false)
    assert.throws(
      () =>
        registerMember({
          username: "mira",
          name: "Someone Else",
          password: "correct-horse",
          inviteCode: "test-invite",
        }),
      /username is taken/i,
    )
  })

  test("stores a hash and opens a session that can expire", () => {
    const row = getDb().prepare("SELECT password_hash FROM users WHERE username = ?").get("mira") as {
      password_hash: string
    }
    assert.notEqual(row.password_hash, "correct-horse")
    assert.match(row.password_hash, /^\$2/)
    assert.equal(hashPassword("another-password").startsWith("$2"), true)

    assert.throws(() => authenticate("mira", "wrong-password"), /don't match/)
    assert.throws(() => authenticate("nobody", "correct-horse"), /don't match/)
    const user = authenticate("MIRA", "correct-horse")
    const token = createSession(user.id)
    assert.equal(userFromToken(token)?.username, "mira")
    destroySession(token)
    assert.equal(userFromToken(token), null)

    const expired = createSession(user.id)
    getDb().prepare("UPDATE sessions SET expires_at = ?").run("2000-01-01T00:00:00.000Z")
    assert.equal(userFromToken(expired), null)
  })

  test("admins can create members, and production refuses a missing invite", () => {
    const created = createMember({
      username: "jules",
      name: "Jules",
      password: "correct-horse",
      isAdmin: true,
    })
    assert.equal(created.isAdmin, true)
    assert.equal(authenticate("jules", "correct-horse").name, "Jules")

    const previous = process.env.INVITE_CODE
    const previousNodeEnv = process.env.NODE_ENV
    delete process.env.INVITE_CODE
    setNodeEnv("production")
    try {
      assert.equal(getInviteCode(), null)
      assert.throws(
        () =>
          registerMember({
            username: "theo",
            name: "Theo",
            password: "correct-horse",
            inviteCode: "test-invite",
          }),
        /turned off/,
      )
    } finally {
      process.env.INVITE_CODE = previous
      setNodeEnv(previousNodeEnv)
    }
  })
})
