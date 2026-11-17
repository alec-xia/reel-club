import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { reopenAction } from "@/app/actions"
import { Delta } from "@/components/delta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getOpenWeek, getRatings, getWeekByPublicId, listWeeks, loadLeague } from "@/lib/club"
import { formatElo, formatScore, formatWhen } from "@/lib/format"
import { getCurrentUser } from "@/lib/session"

export async function generateMetadata({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const week = getWeekByPublicId(weekId)
  return { title: week?.movie ?? "Film" }
}

export default async function MoviePage({ params }: { params: Promise<{ weekId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const { weekId } = await params
  const week = getWeekByPublicId(weekId)
  if (!week) notFound()
  const ratings = getRatings(week.id)
  const { league, error } = loadLeague(false)
  const result = league?.history.find((item) => item.week_id === week.weekId) ?? null
  const latest = listWeeks()[0]
  const canReopen = Boolean(
    user.isAdmin && week.status === "closed" && latest?.id === week.id && !getOpenWeek(),
  )

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm">
        <Link href="/movies" className="text-primary underline-offset-4 hover:underline">
          All films
        </Link>
      </p>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={week.status === "open" ? "default" : "secondary"}>
            {week.status === "open" ? "Scoring" : "Locked"}
          </Badge>
          <span className="text-sm text-muted-foreground">{formatWhen(week.suggestedAt)}</span>
        </div>
        <h1 className="font-heading text-4xl tracking-tight">{week.movie}</h1>
        <p className="text-muted-foreground">Picked by {week.suggesterName}</p>
        {week.note ? <p className="max-w-xl whitespace-pre-wrap text-sm leading-relaxed">{week.note}</p> : null}
      </header>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Scores</h2>
        {week.status === "open" ? (
          <p className="text-sm text-muted-foreground">
            Numbers stay hidden until the week locks, so later scores aren&apos;t anchored to earlier ones.{" "}
            {ratings.length} {ratings.length === 1 ? "person has" : "people have"} scored.
          </p>
        ) : ratings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scores were saved on this one.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/10">
            {ratings.map((rating) => (
              <li key={rating.userId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium">{rating.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  Enjoyed {formatScore(rating.experience)} · Film {formatScore(rating.quality)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result ? (
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">What the ranking did</h2>
          {result.matches.length === 0 && Object.keys(result.skipped).length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              No earlier pick was on the board, so this week changed nothing. {week.suggesterName}&apos;s movie starts
              defending next time.
            </p>
          ) : (
            <ul className="space-y-3">
              {result.matches.map((match) => (
                <li key={match.opponent} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      vs {match.opponent}
                      <span className="font-normal text-muted-foreground"> · {match.opponent_movie}</span>
                    </p>
                    <Delta value={match.delta} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Gap {match.gap.toFixed(2)} · result {match.actual.toFixed(3)} · expected {match.expected.toFixed(3)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Judges:{" "}
                    {match.judges
                      .map((judge) => `${judge.judge} ${(judge.weight * 100).toFixed(0)}%`)
                      .join(", ")}
                  </p>
                </li>
              ))}
              {Object.entries(result.skipped).map(([opponent, reason]) => (
                <li key={opponent} className="rounded-2xl bg-muted px-4 py-3 text-sm">
                  vs {opponent}: skipped ({reason})
                </li>
              ))}
            </ul>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.keys(result.elo_after)
              .sort((a, b) => a.localeCompare(b))
              .map((name) => (
                <li key={name} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
                  <span>{name}</span>
                  <span className="tabular-nums">
                    {formatElo(result.elo_before[name])} → {formatElo(result.elo_after[name])}{" "}
                    <Delta value={result.deltas[name] ?? 0} />
                  </span>
                </li>
              ))}
          </ul>
          <details className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <summary className="cursor-pointer text-sm font-medium">Week report from movie_elo</summary>
            <pre className="mt-3 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap">{result.report}</pre>
          </details>
        </section>
      ) : null}

      {canReopen ? (
        <form action={reopenAction}>
          <Button type="submit" variant="outline" className="h-11">
            Reopen this week
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Admin only. Scores become editable again and drop out of the ranking until you lock them.
          </p>
        </form>
      ) : null}
    </article>
  )
}
