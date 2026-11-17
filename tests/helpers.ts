import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export function prepareTestDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-club-"))
  process.env.CLUB_DB_PATH = path.join(dir, "club.db")
  process.env.BCRYPT_ROUNDS = "4"
  process.env.INVITE_CODE = "test-invite"
  process.env.SEED_DEMO = "0"
  setNodeEnv("test")
  return dir
}

export function setNodeEnv(value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>
  if (value === undefined) delete env.NODE_ENV
  else env.NODE_ENV = value
}
