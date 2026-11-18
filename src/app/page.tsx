import Link from "next/link"
import { redirect } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/session"
import { cn } from "cn"

export default async function HomePage() {
  const user = await getCurrentUser()
  if (user) redirect("/movies")
  return <Landing />
}

function Landing() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="space-y-4">
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Movie club</p>
        <h1 className="font-heading text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          One movie. Two honest scores. A board that remembers who picks well.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-foreground/80">
          Reel Club is the private notebook for a group that watches together. Suggest a movie whenever you think of
          one, and score it whenever you actually watch it. Those numbers feed an Elo that ranks the members, not the
          films.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/login" className={cn(buttonVariants(), "h-11 px-4 text-base")}>
            Log in
          </Link>
          <Link href="/join" className={cn(buttonVariants({ variant: "outline" }), "h-11 bg-card px-4 text-base")}>
            Join with an invite
          </Link>
          <Link href="/how" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            How the ranking works
          </Link>
        </div>
      </section>
      <ol className="grid gap-4 sm:grid-cols-3">
        {[
          ["Suggest any time", "Add a movie whenever you want. Several can be waiting at once."],
          ["Score when you watch it", "Enjoyment and quality, from 1 to 10, in any order. The suggester sits this part out."],
          ["The pick defends", "Once a movie has scores, it joins the ranking and keeps playing against the next ones."],
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
