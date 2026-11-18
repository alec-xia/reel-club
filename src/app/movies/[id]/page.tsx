import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { removeSuggestionAction } from "@/app/actions"
import { Delta } from "@/components/delta"
import { RatingForm } from "@/components/rating-form"
import { SubmitButton } from "@/components/submit-button"
import { Badge } from "@/components/ui/badge"
import { getMovie, getRatings, loadLeague } from "@/lib/club"
import { formatElo, formatScore, formatWhen } from "@/lib/format"
import { getCurrentUser } from "@/lib/session"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const movieId = Number(id)
  const movie = Number.isInteger(movieId) && movieId > 0 ? getMovie(movieId) : null
  return { title: movie?.movie ?? "Film" }
}

export default async function MoviePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id < 1) notFound()
  const movie = getMovie(id)
  if (!movie) notFound()
  const query = await searchParams
  const ratings = getRatings(movie.id)
  const mine = ratings.find((rating) => rating.userId === user.id) ?? null
  const { league, error } = loadLeague()
  const result = league?.history.find((item) => item.week_id === String(movie.id)) ?? null
  const canRemove = movie.ratingCount === 0 && (movie.suggesterId === user.id || user.isAdmin)

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm">
        <Link href="/movies" className="text-primary underline-offset-4 hover:underline">
          All movies
        </Link>
      </p>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={movie.ratingCount > 0 ? "secondary" : "default"}>
            {movie.ratingCount > 0 ? "Rated" : "Up next"}
          </Badge>
          <span className="text-sm text-muted-foreground">Suggested {formatWhen(movie.suggestedAt)}</span>
          {movie.rankedAt ? (
            <span className="text-sm text-muted-foreground">First scored {formatWhen(movie.rankedAt)}</span>
          ) : null}
        </div>
        <h1 className="font-heading text-4xl tracking-tight">{movie.movie}</h1>
        <p className="text-muted-foreground">
          Suggested by {movie.suggesterName}
          {movie.suggesterId === user.id ? " (you)" : ""}
        </p>
        {movie.note ? <p className="max-w-xl whitespace-pre-wrap text-sm leading-relaxed">{movie.note}</p> : null}
      </header>

      {query.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Scores</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scores yet. Anyone except {movie.suggesterName} can rate this whenever the group watches it.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/10">
            {ratings.map((rating) => (
              <li key={rating.userId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium">
                  {rating.name}
                  {rating.userId === user.id ? " · you" : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  Enjoyed {formatScore(rating.experience)} · Film {formatScore(rating.quality)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {movie.suggesterId === user.id ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed">
            You suggested this one, so you don&apos;t score it. Your taste is never used to defend your own movie.
          </p>
        ) : (
          <RatingForm movieId={movie.id} experience={mine?.experience} quality={mine?.quality} />
        )}
      </section>

      {result ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-2xl">What the ranking did</h2>
            <Link href="/how" className="text-sm text-primary underline-offset-4 hover:underline">
              How this works
            </Link>
          </div>
          {result.matches.length === 0 && Object.keys(result.skipped).length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              No earlier scored movie was on the board, so this one changed nothing. {movie.suggesterName}&apos;s pick
              starts defending the next movie that gets scores.
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
                    {match.judges.map((judge) => `${judge.judge} ${(judge.weight * 100).toFixed(0)}%`).join(", ")}
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
                <li
                  key={name}
                  className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10"
                >
                  <span>{name}</span>
                  <span className="tabular-nums">
                    {formatElo(result.elo_before[name])} → {formatElo(result.elo_after[name])}{" "}
                    <Delta value={result.deltas[name] ?? 0} />
                  </span>
                </li>
              ))}
          </ul>
          <details className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <summary className="cursor-pointer text-sm font-medium">Ranking report from movie_elo</summary>
            <pre className="mt-3 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap">{result.report}</pre>
          </details>
        </section>
      ) : movie.ratingCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          This stays off the board until someone scores it. Scoring it later still counts, in the order it was first
          scored.{" "}
          <Link href="/how" className="text-primary underline-offset-4 hover:underline">
            How this works
          </Link>
        </p>
      ) : null}

      {canRemove ? (
        <form action={removeSuggestionAction} className="space-y-2 border-t border-border pt-4">
          <input type="hidden" name="movieId" value={movie.id} />
          <p className="text-sm text-muted-foreground">
            Removing deletes this suggestion. It has no scores, so it was never ranked.
          </p>
          <SubmitButton variant="outline" pendingLabel="Removing…">
            Remove this suggestion
          </SubmitButton>
        </form>
      ) : null}
    </article>
  )
}
