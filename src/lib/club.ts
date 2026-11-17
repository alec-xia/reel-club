import { listUsers, findUserById, type PublicUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { ClubError } from "@/lib/errors"
import {
  computeLeague,
  RankingError,
  type LeagueView,
  type RatingInput,
  type WeekInput,
} from "@/lib/ranking"

export type WeekRecord = {
  id: number
  weekId: string
  movie: string
  suggesterId: number
  suggesterName: string
  status: "open" | "closed"
  suggestedAt: string
  closedAt: string | null
  note: string | null
}

export type RatingView = {
  userId: number
  name: string
  experience: number
  quality: number
  updatedAt: string
}

type WeekRow = {
  id: number
  week_id: string
  movie: string
  suggester_id: number
  suggester_name: string
  status: "open" | "closed"
  suggested_at: string
  closed_at: string | null
  note: string | null
}

const WEEK_SELECT = `
  SELECT weeks.id, weeks.week_id, weeks.movie, weeks.suggester_id, weeks.status,
         weeks.suggested_at, weeks.closed_at, weeks.note, users.name AS suggester_name
  FROM weeks
  JOIN users ON users.id = weeks.suggester_id
`

function mapWeek(row: WeekRow): WeekRecord {
  return {
    id: row.id,
    weekId: row.week_id,
    movie: row.movie,
    suggesterId: row.suggester_id,
    suggesterName: row.suggester_name,
    status: row.status,
    suggestedAt: row.suggested_at,
    closedAt: row.closed_at,
    note: row.note,
  }
}

export function listWeeks(): WeekRecord[] {
  const rows = getDb()
    .prepare(`${WEEK_SELECT} ORDER BY weeks.id DESC`)
    .all() as WeekRow[]
  return rows.map(mapWeek)
}

export function getOpenWeek(): WeekRecord | null {
  const row = getDb()
    .prepare(`${WEEK_SELECT} WHERE weeks.status = 'open' ORDER BY weeks.id DESC LIMIT 1`)
    .get() as WeekRow | undefined
  return row ? mapWeek(row) : null
}

export function getWeekByPublicId(weekId: string): WeekRecord | null {
  const row = getDb()
    .prepare(`${WEEK_SELECT} WHERE weeks.week_id = ?`)
    .get(weekId) as WeekRow | undefined
  return row ? mapWeek(row) : null
}

export function getRatings(weekRowId: number): RatingView[] {
  const rows = getDb()
    .prepare(
      `SELECT ratings.user_id, users.name, ratings.experience, ratings.quality, ratings.updated_at
       FROM ratings
       JOIN users ON users.id = ratings.user_id
       WHERE ratings.week_row_id = ?
       ORDER BY users.name COLLATE NOCASE`,
    )
    .all(weekRowId) as {
    user_id: number
    name: string
    experience: number
    quality: number
    updated_at: string
  }[]
  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    experience: row.experience,
    quality: row.quality,
    updatedAt: row.updated_at,
  }))
}

function requireUser(userId: number): PublicUser {
  const row = findUserById(userId)
  if (!row) throw new ClubError("That account is no longer on the list.", "no_user")
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    isAdmin: row.is_admin === 1,
  }
}

function cleanMovie(raw: string): string {
  const movie = raw.trim().replace(/\s+/g, " ")
  if (movie.length < 1 || movie.length > 200) {
    throw new ClubError("Give the movie a title, up to 200 characters.", "bad_movie")
  }
  return movie
}

function cleanNote(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const note = raw.trim()
  if (!note) return null
  if (note.length > 280) {
    throw new ClubError("Keep the note under 280 characters.", "bad_note")
  }
  return note
}

export function parseScore(raw: unknown, label: string): number {
  const value = typeof raw === "number" ? raw : Number(String(raw ?? "").trim())
  if (!Number.isFinite(value)) {
    throw new ClubError(`Choose a ${label} score from 1 to 10.`, "bad_rating")
  }
  const doubled = Math.round(value * 2)
  if (Math.abs(value * 2 - doubled) > 1e-6 || doubled < 2 || doubled > 20) {
    throw new ClubError(
      `${label} scores run from 1 to 10, in half-point steps.`,
      "bad_rating",
    )
  }
  return doubled / 2
}

function nextWeekId(day: string): string {
  const db = getDb()
  let candidate = day
  let suffix = 2
  while (db.prepare("SELECT 1 FROM weeks WHERE week_id = ?").get(candidate)) {
    candidate = `${day}-${suffix}`
    suffix += 1
  }
  return candidate
}

export function suggestMovie(
  userId: number,
  movieRaw: string,
  noteRaw: string | null,
  opts?: { suggestedAt?: string },
): WeekRecord {
  const user = requireUser(userId)
  const movie = cleanMovie(movieRaw)
  const note = cleanNote(noteRaw)
  const suggestedAt = opts?.suggestedAt ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(suggestedAt))) {
    throw new ClubError("That suggestion date is not valid.", "bad_date")
  }
  const day = suggestedAt.slice(0, 10)
  const db = getDb()
  const insert = db.transaction(() => {
    const open = db.prepare("SELECT id FROM weeks WHERE status = 'open' LIMIT 1").get()
    if (open) {
      throw new ClubError(
        "There's already a movie open for scores. Lock it before suggesting the next one.",
        "week_open",
      )
    }
    const info = db
      .prepare(
        `INSERT INTO weeks (week_id, movie, suggester_id, status, suggested_at, note)
         VALUES (?, ?, ?, 'open', ?, ?)`,
      )
      .run(nextWeekId(day), movie, user.id, suggestedAt, note)
    return Number(info.lastInsertRowid)
  })
  const id = insert()
  const week = listWeeks().find((item) => item.id === id)
  if (!week) throw new ClubError("The suggestion didn't save.", "suggest_failed")
  return week
}

export function submitRating(userId: number, experienceRaw: unknown, qualityRaw: unknown): void {
  const user = requireUser(userId)
  const experience = parseScore(experienceRaw, "enjoyment")
  const quality = parseScore(qualityRaw, "quality")
  const week = getOpenWeek()
  if (!week) throw new ClubError("There's no movie open for scores right now.", "no_week")
  if (week.suggesterId === user.id) {
    throw new ClubError(
      "Pickers don't score their own movie. The ranking system rejects it, so your taste is never used to defend your own pick.",
      "suggester_rating",
    )
  }
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO ratings (week_row_id, user_id, experience, quality, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(week_row_id, user_id) DO UPDATE SET
         experience = excluded.experience,
         quality = excluded.quality,
         updated_at = excluded.updated_at`,
    )
    .run(week.id, user.id, experience, quality, now)
}

export function withdrawOpenWeek(userId: number): void {
  const user = requireUser(userId)
  const db = getDb()
  const remove = db.transaction(() => {
    const week = getOpenWeek()
    if (!week) throw new ClubError("There's no open pick to withdraw.", "no_week")
    if (week.suggesterId !== user.id && !user.isAdmin) {
      throw new ClubError("Only the picker or an admin can withdraw this movie.", "forbidden")
    }
    db.prepare("DELETE FROM weeks WHERE id = ? AND status = 'open'").run(week.id)
  })
  remove()
}

function ratingsToInput(ratings: RatingView[]): Record<string, RatingInput> {
  return Object.fromEntries(
    ratings.map((rating) => [
      rating.name,
      { experience: rating.experience, quality: rating.quality },
    ]),
  )
}

export function weekToInput(week: WeekRecord, ratings: RatingView[]): WeekInput {
  return {
    week_id: week.weekId,
    suggester: week.suggesterName,
    movie: week.movie,
    date: week.suggestedAt.slice(0, 10),
    ratings: ratingsToInput(ratings),
  }
}

export function closedWeekInputs(): WeekInput[] {
  const weeks = listWeeks()
    .filter((week) => week.status === "closed")
    .sort((a, b) => a.id - b.id)
  return weeks.map((week) => weekToInput(week, getRatings(week.id)))
}

export function memberNames(): string[] {
  return listUsers().map((user) => user.name)
}

export function loadLeague(preview = false): {
  league: LeagueView | null
  error: string | null
} {
  const members = memberNames()
  if (members.length === 0) return { league: null, error: null }
  const open = preview ? getOpenWeek() : null
  const previewInput =
    open && getRatings(open.id).length > 0 ? weekToInput(open, getRatings(open.id)) : null
  try {
    return {
      league: computeLeague({
        members,
        weeks: closedWeekInputs(),
        preview: previewInput,
      }),
      error: null,
    }
  } catch (error) {
    const message =
      error instanceof RankingError || error instanceof Error
        ? error.message
        : "The ranking engine failed."
    return { league: null, error: message }
  }
}

export function closeWeek(userId: number, opts?: { closedAt?: string }): WeekRecord {
  const user = requireUser(userId)
  const week = getOpenWeek()
  if (!week) throw new ClubError("There's no open movie to lock.", "no_week")
  if (week.suggesterId !== user.id && !user.isAdmin) {
    throw new ClubError("The picker, or an admin, locks the week.", "forbidden")
  }
  const ratings = getRatings(week.id)
  if (ratings.length === 0) {
    throw new ClubError("At least one score is needed before the week can lock.", "no_ratings")
  }
  const members = memberNames()
  try {
    const preview = computeLeague({
      members,
      weeks: closedWeekInputs(),
      preview: weekToInput(week, ratings),
    })
    if (preview.preview_error || !preview.preview) {
      throw new ClubError(
        preview.preview_error?.error ?? "The ranking engine did not return a result for this week.",
        "ranking",
      )
    }
  } catch (error) {
    if (error instanceof ClubError) throw error
    const message = error instanceof Error ? error.message : "The ranking engine rejected this week."
    throw new ClubError(message, "ranking")
  }

  const closedAt = opts?.closedAt ?? new Date().toISOString()
  const db = getDb()
  const lock = db.transaction(() => {
    const current = db
      .prepare("SELECT status FROM weeks WHERE id = ?")
      .get(week.id) as { status: string } | undefined
    if (!current || current.status !== "open") {
      throw new ClubError("This week is already locked.", "closed")
    }
    db.prepare("UPDATE weeks SET status = 'closed', closed_at = ? WHERE id = ?").run(closedAt, week.id)
  })
  lock()
  const locked = getWeekByPublicId(week.weekId)
  if (!locked) throw new ClubError("The locked week could not be reloaded.", "close_failed")
  return locked
}

export function reopenLatest(userId: number): WeekRecord {
  const user = requireUser(userId)
  if (!user.isAdmin) throw new ClubError("Only an admin can reopen a locked week.", "forbidden")
  const db = getDb()
  const reopen = db.transaction(() => {
    if (db.prepare("SELECT id FROM weeks WHERE status = 'open' LIMIT 1").get()) {
      throw new ClubError("Lock or withdraw the open movie before reopening an older one.", "week_open")
    }
    const latest = db
      .prepare("SELECT id, status FROM weeks ORDER BY id DESC LIMIT 1")
      .get() as { id: number; status: string } | undefined
    if (!latest || latest.status !== "closed") {
      throw new ClubError("The most recent movie is not a locked week.", "no_week")
    }
    db.prepare("UPDATE weeks SET status = 'open', closed_at = NULL WHERE id = ?").run(latest.id)
    return latest.id
  })
  const id = reopen()
  const week = listWeeks().find((item) => item.id === id)
  if (!week) throw new ClubError("That week could not be reopened.", "reopen_failed")
  return week
}

export function eligibleRaters(members: PublicUser[], week: WeekRecord): PublicUser[] {
  return members.filter((member) => member.id !== week.suggesterId)
}
