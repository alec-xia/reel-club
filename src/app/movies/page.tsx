import Link from "next/link"
import { redirect } from "next/navigation"
import { Delta } from "@/components/delta"
import { Badge } from "@/components/ui/badge"
import { getRatings, listWeeks, loadLeague } from "@/lib/club"
import { formatScore, formatWhen } from "@/lib/format"

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
import { getCurrentUser } from "@/lib/session"

export const metadata = { title: "Films" }

export default async function MoviesPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const weeks = listWeeks()
  const { league } = loadLeague(false)
  const byId = new Map(league?.history.map((week) => [week.week_id, week]) ?? [])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">The archive</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">What we&apos;ve watched</h1>
      </div>
      {weeks.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm ring-1 ring-foreground/10">
          Nothing on the list yet. The first suggestion shows up here, even before anyone scores it.
        </p>
      ) : (
        <ul className="space-y-3">
          {weeks.map((week) => {
            const ratings = getRatings(week.id)
            const result = byId.get(week.weekId)
            const enjoyed =
              ratings.length > 0
                ? ratings.reduce((sum, rating) => sum + rating.experience, 0) / ratings.length
                : null
            const quality =
              ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating.quality, 0) / ratings.length : null
            return (
              <li key={week.id}>
                <Link
                  href={`/movies/${week.weekId}`}
                  className="block rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={week.status === "open" ? "default" : "secondary"}>
                      {week.status === "open" ? "Scoring" : "Locked"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{formatWhen(week.suggestedAt)}</span>
                  </div>
                  <h2 className="mt-2 font-heading text-2xl leading-tight">{week.movie}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Picked by {week.suggesterName}</p>
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {week.status === "closed" && enjoyed != null && quality != null ? (
                      <>
                        <span>Avg enjoyed {formatScore(round1(enjoyed))}</span>
                        <span>Avg film {formatScore(round1(quality))}</span>
                      </>
                    ) : (
                      <span>{ratings.length} scored so far</span>
                    )}
                    {result ? (
                      <span>
                        {week.suggesterName} <Delta value={result.deltas[week.suggesterName] ?? 0} />
                      </span>
                    ) : null}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
