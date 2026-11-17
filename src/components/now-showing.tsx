import Link from "next/link"
import { withdrawAction } from "@/app/actions"
import { CloseWeekButton } from "@/components/close-week"
import { Delta } from "@/components/delta"
import { RatingForm } from "@/components/rating-form"
import { SubmitButton } from "@/components/submit-button"
import { SuggestForm } from "@/components/suggest-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listUsers, type PublicUser } from "@/lib/auth"
import {
  eligibleRaters,
  getOpenWeek,
  getRatings,
  listWeeks,
  loadLeague,
} from "@/lib/club"
import { formatScore, formatWhen } from "@/lib/format"

export async function NowShowing({ user, notice }: { user: PublicUser; notice?: string }) {
  const members = listUsers()
  const open = getOpenWeek()
  const latestClosed = listWeeks().find((week) => week.status === "closed") ?? null
  const ratings = open ? getRatings(open.id) : []
  const mine = ratings.find((rating) => rating.userId === user.id) ?? null
  const eligible = open ? eligibleRaters(members, open) : []
  const scored = eligible.filter((member) => ratings.some((rating) => rating.userId === member.id))
  const canManage = Boolean(open && (open.suggesterId === user.id || user.isAdmin))
  const canLock = Boolean(canManage && ratings.length > 0)
  const rosterFull = Boolean(open && scored.length === eligible.length && eligible.length > 0)

  const { league, error: rankingError } =
    latestClosed || canLock ? loadLeague(canLock) : { league: null, error: null }
  let previewSummary = "At least one score is in. Locking sends those scores to the ranking log."
  if (canLock) {
    if (rankingError) {
      previewSummary = rankingError
    } else if (league?.preview_error) {
      previewSummary = league.preview_error.error
    } else if (league?.preview && Object.keys(league.preview.deltas).length === 0) {
      previewSummary =
        "Locking won't move anyone yet. With no earlier pick on the board, this movie only starts defending."
    } else if (league?.preview) {
      const parts = members.map((member) => `${member.name} ${formatSigned(league.preview?.deltas[member.name] ?? 0)}`)
      previewSummary = `If you lock with the scores so far: ${parts.join(", ")}.`
    }
  }
  const lastResult = latestClosed ? league?.history.find((week) => week.week_id === latestClosed.weekId) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Now showing</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">This week&apos;s pick</h1>
      </div>

      {notice ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {notice}
        </p>
      ) : null}

      {rankingError && !canLock ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {rankingError}
        </p>
      ) : null}

      {members.length < 3 ? (
        <p className="rounded-xl bg-accent px-4 py-3 text-sm leading-relaxed">
          The ranking engine wants at least three members, so someone can judge a match without being one of the
          pickers. Add friends from the invite link or the members page.
        </p>
      ) : null}

      {open ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Open for scores</Badge>
              <span className="text-sm text-muted-foreground">{formatWhen(open.suggestedAt)}</span>
            </div>
            <CardTitle className="font-heading text-3xl leading-tight">{open.movie}</CardTitle>
            <CardDescription className="text-base text-foreground/80">
              Picked by {open.suggesterName}
              {open.suggesterId === user.id ? " (you)" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {open.note ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{open.note}</p> : null}
            <p className="text-sm text-muted-foreground">
              {scored.length} of {eligible.length} {eligible.length === 1 ? "person has" : "people have"} scored.
              {rosterFull ? " Everyone who can score is in." : ""} The picker doesn&apos;t score their own movie.
            </p>
            <ul className="space-y-2">
              {members.map((member) => {
                const isPicker = member.id === open.suggesterId
                const rating = ratings.find((item) => item.userId === member.id)
                const showNumbers = Boolean(rating && rating.userId === user.id)
                return (
                  <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {member.name}
                      {member.id === user.id ? " · you" : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {isPicker
                        ? "Picking"
                        : rating
                          ? showNumbers
                            ? `Enjoyed ${formatScore(rating.experience)} · Film ${formatScore(rating.quality)}`
                            : "Scored"
                          : "Waiting"}
                    </span>
                  </li>
                )
              })}
            </ul>

            {open.suggesterId === user.id ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed">
                You picked this one, so you don&apos;t score it. Your taste is never used to defend your own movie.
                Lock the week when the scores you want are in.
              </p>
            ) : (
              <RatingForm experience={mine?.experience} quality={mine?.quality} />
            )}

            {canLock ? (
              <div className="flex flex-wrap items-center gap-3">
                <CloseWeekButton movie={open.movie} summary={previewSummary} />
              </div>
            ) : null}

            {canManage ? (
              <form action={withdrawAction} className="space-y-2 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Withdrawing deletes this pick and any scores on it. Nothing has been ranked yet.
                </p>
                <SubmitButton variant="outline" pendingLabel="Withdrawing…">
                  Withdraw this pick
                </SubmitButton>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-3xl">The couch is open</CardTitle>
            <CardDescription className="text-base">
              One suggestion at a time. Yours stays up until you lock the scores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SuggestForm />
          </CardContent>
        </Card>
      )}

      {latestClosed ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Last locked film</CardTitle>
            <CardDescription>
              {latestClosed.movie}, picked by {latestClosed.suggesterName}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            {lastResult ? (
              <span>
                {latestClosed.suggesterName} <Delta value={lastResult.deltas[latestClosed.suggesterName] ?? 0} /> on the board
              </span>
            ) : (
              <span className="text-muted-foreground">Ranks update when a week locks.</span>
            )}
            <Link href={`/movies/${latestClosed.weekId}`} className="font-medium text-primary underline-offset-4 hover:underline">
              See the scores
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function formatSigned(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return "0.0"
  return rounded > 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1)
}
