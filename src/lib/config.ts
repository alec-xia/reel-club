import { createHmac, randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { dbPath } from "@/lib/db"

export function isNextBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build"
}

export function productionConfigError(): string | null {
  if (process.env.NODE_ENV !== "production" || isNextBuild()) return null
  if (!process.env.INVITE_CODE?.trim()) return "INVITE_CODE is required in production"
  const secret = process.env.SESSION_SECRET?.trim() ?? ""
  if (secret.length < 16) return "SESSION_SECRET is required in production and must be at least 16 characters"
  return null
}

export function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim()
  if (fromEnv) {
    if (fromEnv.length < 16) {
      throw new Error("SESSION_SECRET must be at least 16 characters")
    }
    return fromEnv
  }
  const problem = productionConfigError()
  if (problem) throw new Error(problem)
  const file = path.join(path.dirname(dbPath()), ".session-secret")
  if (fs.existsSync(file)) {
    const stored = fs.readFileSync(file, "utf8").trim()
    if (stored.length >= 16) return stored
  }
  const generated = randomBytes(32).toString("base64url")
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, generated, { mode: 0o600 })
  return generated
}

export function hashSessionToken(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex")
}
