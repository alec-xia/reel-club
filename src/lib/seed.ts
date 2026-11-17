import { hashPassword } from "@/lib/auth"
import {
  closeWeek,
  getOpenWeek,
  submitRating,
  suggestMovie,
} from "@/lib/club"
import { getDb } from "@/lib/db"
import { findUserByUsername } from "@/lib/auth"

export const DEMO_PASSWORD = "reel-night"

const PEOPLE = [
  { username: "mira", name: "Mira", isAdmin: true },
  { username: "jules", name: "Jules", isAdmin: false },
  { username: "theo", name: "Theo", isAdmin: false },
  { username: "noor", name: "Noor", isAdmin: false },
  { username: "sam", name: "Sam", isAdmin: false },
] as const

type ScoreMap = Record<string, [number, number]>

const WEEKS: {
  suggester: string
  movie: string
  note: string
  at: string
  ratings: ScoreMap
  close: boolean
}[] = [
  {
    suggester: "mira",
    movie: "The Grand Budapest Hotel",
    note: "Wes at his most pastry-shop. Mira has wanted this on the list since the club started.",
    at: "2026-10-02T18:00:00.000Z",
    ratings: { jules: [8, 8], theo: [7, 8], noor: [9, 9], sam: [6, 7] },
    close: true,
  },
  {
    suggester: "jules",
    movie: "Parasite",
    note: "Jules has been campaigning for this since 2019 and refused to summarize the plot.",
    at: "2026-10-09T18:00:00.000Z",
    ratings: { mira: [9, 10], theo: [8, 9], noor: [9, 9], sam: [8, 8] },
    close: true,
  },
  {
    suggester: "theo",
    movie: "Before Sunrise",
    note: "Talky, on purpose. Theo said to treat the walking as the plot.",
    at: "2026-10-16T18:00:00.000Z",
    ratings: { mira: [8, 6], jules: [7, 6], noor: [9, 7], sam: [5, 5] },
    close: true,
  },
  {
    suggester: "noor",
    movie: "Spirited Away",
    note: "Noor's comfort pick, defended in the group chat as canon rather than nostalgia.",
    at: "2026-10-23T18:00:00.000Z",
    ratings: { mira: [9, 9], jules: [8, 9], theo: [10, 9], sam: [8, 8] },
    close: true,
  },
  {
    suggester: "sam",
    movie: "The Nice Guys",
    note: "Sam promised it was fun and not homework. There was popcorn. There were arguments.",
    at: "2026-10-30T18:00:00.000Z",
    ratings: { mira: [7, 6], jules: [8, 6], theo: [6, 5], noor: [7, 6] },
    close: true,
  },
  {
    suggester: "mira",
    movie: "Paddington 2",
    note: "Mira says this is a perfect film and is willing to be ranked on it.",
    at: "2026-11-06T18:00:00.000Z",
    ratings: { jules: [9, 8], theo: [8, 8], noor: [9, 8], sam: [8, 7] },
    close: true,
  },
  {
    suggester: "jules",
    movie: "Portrait of a Lady on Fire",
    note: "Jules again, two weeks later. Bring tissues, apparently. Scores are still open.",
    at: "2026-11-13T18:00:00.000Z",
    ratings: { theo: [9, 9], noor: [8, 9] },
    close: false,
  },
]

function userId(username: string): number {
  const user = findUserByUsername(username)
  if (!user) throw new Error(`Missing demo user ${username}`)
  return user.id
}

export function seedDemo(): void {
  const db = getDb()
  const existing = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  if (existing.c > 0) {
    throw new Error("Refusing to seed a database that already has members.")
  }
  const passwordHash = hashPassword(DEMO_PASSWORD)
  const insert = db.prepare(
    `INSERT INTO users (username, name, password_hash, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const createdAt = "2026-09-20T16:00:00.000Z"
  const addMembers = db.transaction(() => {
    for (const person of PEOPLE) {
      insert.run(person.username, person.name, passwordHash, person.isAdmin ? 1 : 0, createdAt)
    }
  })
  addMembers()

  for (const week of WEEKS) {
    suggestMovie(userId(week.suggester), week.movie, week.note, { suggestedAt: week.at })
    for (const [username, scores] of Object.entries(week.ratings)) {
      submitRating(userId(username), scores[0], scores[1])
    }
    if (week.close) {
      closeWeek(userId(week.suggester), { closedAt: week.at.slice(0, 10) + "T23:30:00.000Z" })
    }
  }
}

export function seedDemoIfEmpty(): boolean {
  const existing = getDb().prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  if (existing.c > 0) return false
  seedDemo()
  return true
}

export function demoClubIsSeeded(): boolean {
  return findUserByUsername("mira") !== null && getOpenWeek()?.movie === "Portrait of a Lady on Fire"
}
