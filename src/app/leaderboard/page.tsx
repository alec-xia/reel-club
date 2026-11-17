import Link from "next/link"
import { redirect } from "next/navigation"
import { Delta } from "@/components/delta"
import { EloChart } from "@/components/elo-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatElo } from "@/lib/format"
import { loadLeague, memberNames } from "@/lib/club"
import { getCurrentUser } from "@/lib/session"

export const metadata = { title: "Leaderboard" }

export default async function LeaderboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const names = memberNames()
  const { league, error } = loadLeague()
  const start = league?.params.start ?? 1500

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">The board</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">Who&apos;s picking well</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {start.toFixed(0)} stays the middle of the club. Points move from one member to another, so a great pick is
          also someone else&apos;s movie losing a match. Your latest scored film keeps defending until you suggest
          again and that new one is scored.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {league && league.history.length === 0 ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm leading-relaxed">
          Nobody has scored a movie yet, so everyone is still at {start.toFixed(0)}. The first scored pick only takes
          the field. Ranks move once a later movie is compared with it.
        </p>
      ) : null}

      {league && league.history.length > 0 && league.history.every((week) => week.matches.length === 0) ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm leading-relaxed">
          The movies scored so far had nothing earlier to play against, so the board hasn&apos;t moved. The next scored
          movie is the first real match.
        </p>
      ) : null}

      <ol className="space-y-2">
        {(league?.standings ?? names.map((name, index) => ({
          rank: index + 1,
          member: name,
          elo: start,
          pick_count: 0,
          current_movie: null as string | null,
        }))).map((row) => (
          <li key={row.member} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-3 ring-1 ring-foreground/10">
            <span className="w-8 text-center font-heading text-2xl tabular-nums text-primary">{row.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-xl leading-tight">{row.member}</p>
              <p className="truncate text-sm text-muted-foreground">
                {row.current_movie ? `Defending ${row.current_movie}` : "No pick on the board yet"}
                {" · "}
                {row.pick_count} {row.pick_count === 1 ? "pick" : "picks"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-heading text-2xl tabular-nums">{formatElo(row.elo)}</p>
              <Delta value={row.elo - start} className="text-sm" />
            </div>
          </li>
        ))}
      </ol>

      {league ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Since the club started</CardTitle>
          </CardHeader>
          <CardContent>
            <EloChart members={league.members} history={league.history} start={start} />
          </CardContent>
        </Card>
      ) : null}

      {league && league.history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">How the picks moved</h2>
          <ul className="space-y-2">
            {[...league.history].reverse().map((week) => (
              <li key={week.week_id}>
                <Link
                  href={`/movies/${week.week_id}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
                >
                  <span>
                    <span className="font-medium">{week.movie}</span>
                    <span className="text-muted-foreground"> · {week.suggester}</span>
                  </span>
                  <Delta value={week.deltas[week.suggester] ?? 0} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {league?.standings_report ? (
        <details className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <summary className="cursor-pointer text-sm font-medium">Standings printed by movie_elo</summary>
          <pre className="mt-3 overflow-x-auto text-xs leading-relaxed">{league.standings_report}</pre>
        </details>
      ) : null}
    </div>
  )
}
