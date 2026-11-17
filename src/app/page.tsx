import Link from "next/link"
import { NowShowing } from "@/components/now-showing"
import { buttonVariants } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/session"
import { cn } from "cn"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) return <Landing />
  const query = await searchParams
  return <NowShowing user={user} notice={query.error} />
}

function Landing() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="space-y-4">
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Friday movie club</p>
        <h1 className="font-heading text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          One movie. Two honest scores. A board that remembers who picks well.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-foreground/80">
          Reel Club is the private notebook for a group that watches together. You score the night you had, and you
          score the movie itself. Those numbers feed an Elo that ranks the members, not the films.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/login" className={cn(buttonVariants(), "h-11 px-4 text-base")}>
            Log in
          </Link>
          <Link href="/join" className={cn(buttonVariants({ variant: "outline" }), "h-11 bg-card px-4 text-base")}>
            Join with an invite
          </Link>
        </div>
      </section>
      <ol className="grid gap-4 sm:grid-cols-3">
        {[
          ["Someone picks", "One movie at a time, tied to the person who suggested it."],
          ["Everyone else scores", "Enjoyment and quality, from 1 to 10. The picker sits this part out."],
          ["The pick defends", "Until you choose again, your last movie keeps playing against the new ones."],
        ].map(([title, body], index) => (
          <li key={title} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="font-heading text-3xl text-primary">{index + 1}</p>
            <h2 className="mt-2 font-heading text-xl">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
