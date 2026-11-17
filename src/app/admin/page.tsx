import { redirect } from "next/navigation"
import { reopenAction } from "@/app/actions"
import { MemberForm } from "@/components/member-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getInviteCode, listUsers } from "@/lib/auth"
import { getOpenWeek, listWeeks } from "@/lib/club"
import { getCurrentUser } from "@/lib/session"

export const metadata = { title: "Members" }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (!user.isAdmin) redirect("/")
  const query = await searchParams
  const members = listUsers()
  const invite = getInviteCode()
  const latest = listWeeks()[0]
  const canReopen = Boolean(latest && latest.status === "closed" && !getOpenWeek())

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Admin</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">Members</h1>
      </div>

      {query.added ? (
        <p role="status" className="rounded-xl bg-accent px-4 py-3 text-sm">
          {query.added} can log in.
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Who&apos;s in</CardTitle>
          <CardDescription>
            {invite
              ? `Friends can also join themselves with the invite code “${invite}”.`
              : "Invite codes are off. Add people from this page."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium">{member.name}</span>
                  <span className="text-muted-foreground"> · {member.username}</span>
                </span>
                {member.isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Add someone</CardTitle>
          <CardDescription>They show up at the club average until their picks start playing.</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Latest locked week</CardTitle>
          <CardDescription>
            Reopening is limited to the most recent locked movie, and only when nothing else is open. Older weeks stay
            in the log so the ranking can be replayed in order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {latest ? (
            <div className="space-y-3">
              <p className="text-sm">
                {latest.movie} · {latest.suggesterName} · {latest.status}
              </p>
              {canReopen ? (
                <form action={reopenAction}>
                  <Button type="submit" variant="outline" className="h-11">
                    Reopen {latest.movie}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to reopen right now.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No movies yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
