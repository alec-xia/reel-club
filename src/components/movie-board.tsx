import Link from "next/link"
import { Delta } from "@/components/delta"
import { SuggestForm } from "@/components/suggest-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listUsers, type PublicUser } from "@/lib/auth"
import { loadLeague, ratedMovies, unwatchedMovies, type MovieRecord } from "@/lib/club"
import { formatScore, formatWhen } from "@/lib/format"

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export async function MovieBoard({ user, notice }: { user: PublicUser; notice?: string }) {
  const members = listUsers()
  const waiting = unwatchedMovies()
  const rated = ratedMovies()
  const { league, error } = members.length > 0 ? loadLeague() : { league: null, error: null }
  const byId = new Map(league?.history.map((event) => [event.week_id, event]) ?? [])

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">The list</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">Movies</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Suggest a movie whenever you want. Rate any of them after you watch it, in whatever order the group gets to
          them.{" "}
          <Link href="/how" className="text-primary underline-offset-4 hover:underline">
            How the scores move the board
          </Link>
        </p>
      </div>

      {notice ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {members.length < 3 ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm leading-relaxed">
          The ranking engine wants at least three members, so someone can judge a match without being one of the
          pickers. Add friends from the invite link or the members page.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Suggest a movie</CardTitle>
          <CardDescription className="text-base">
            Several can sit on the list at once. Yours waits until someone scores it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuggestForm />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-2xl">Unwatched / up next</h2>
          <p className="text-sm text-muted-foreground">Newest suggestions first. Nobody has scored these yet.</p>
        </div>
        {waiting.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-6 text-sm ring-1 ring-foreground/10">
            Nothing is waiting. Every suggestion so far has at least one score.
          </p>
        ) : (
          <ul className="space-y-3">
            {waiting.map((movie) => (
              <MovieRow
                key={movie.id}
                movie={movie}
                memberCount={members.length}
                youSuggested={movie.suggesterId === user.id}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-2xl">Rated</h2>
          <p className="text-sm text-muted-foreground">
            Most recently scored first. The count is how many members have rated it.
          </p>
        </div>
        {rated.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-6 text-sm ring-1 ring-foreground/10">
            No scores yet. Open a suggestion after you watch it and leave a pair of scores.
          </p>
        ) : (
          <ul className="space-y-3">
            {rated.map((movie) => (
              <MovieRow
                key={movie.id}
                movie={movie}
                memberCount={members.length}
                youSuggested={movie.suggesterId === user.id}
                delta={byId.get(String(movie.id))?.deltas[movie.suggesterName]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MovieRow({
  movie,
  memberCount,
  youSuggested,
  delta,
}: {
  movie: MovieRecord
  memberCount: number
  youSuggested: boolean
  delta?: number
}) {
  const eligible = Math.max(0, memberCount - 1)
  const watched = movie.ratingCount > 0
  return (
    <li>
      <Link href={`/movies/${movie.id}`} className="block rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={watched ? "secondary" : "default"}>{watched ? "Rated" : "Up next"}</Badge>
          <span className="text-sm text-muted-foreground">
            Suggested {formatWhen(movie.suggestedAt)}
            {movie.rankedAt ? ` · First scored ${formatWhen(movie.rankedAt)}` : ""}
          </span>
        </div>
        <h3 className="mt-2 font-heading text-2xl leading-tight">{movie.movie}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Suggested by {movie.suggesterName}
          {youSuggested ? " (you)" : ""}
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            {movie.ratingCount} of {eligible} rated
          </span>
          {watched && movie.avgExperience != null && movie.avgQuality != null ? (
            <>
              <span>Avg enjoyed {formatScore(round1(movie.avgExperience))}</span>
              <span>Avg film {formatScore(round1(movie.avgQuality))}</span>
            </>
          ) : null}
          {delta != null ? (
            <span>
              {movie.suggesterName} <Delta value={delta} />
            </span>
          ) : null}
        </p>
      </Link>
    </li>
  )
}
