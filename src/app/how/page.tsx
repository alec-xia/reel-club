import Link from "next/link"

export const metadata = { title: "How it works" }

export default function HowPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">The rules we actually use</p>
        <h1 className="font-heading text-4xl tracking-tight">Two scores, then the board moves</h1>
      </header>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">The week</h2>
        <p>
          One member suggests one movie. That suggestion stays open until the picker, or an admin, locks it. While it
          is open you can change your scores. After it locks, the numbers are part of the ranking log.
        </p>
        <p>
          You do not score a movie you picked. The ranking library rejects that on purpose: your own opinion is never
          used to defend your own film. If you were out the night everyone watched, just don&apos;t score. Absences
          drop out of the comparisons by themselves.
        </p>
        <p>
          Scores are 1 to 10, including halves. Enjoyment is the night you had. Quality is whether the movie is
          actually good. Other people&apos;s numbers stay hidden until the lock, so the last person isn&apos;t grading
          on a curve they can see.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">What the Elo is doing</h2>
        <p>
          Reel Club does not average the scores and call that a rating. It hands the raw pairs to{" "}
          <span className="font-medium">movie_elo</span>, which treats each member&apos;s latest pick as their player.
          The new movie plays a match against every earlier pick still on the board. The judges are the people who
          scored both films. A judge who is higher on the board counts for more. Points move from the match loser to
          the match winner, and the club&apos;s total never drifts, so 1500 stays the middle.
        </p>
        <p>
          The first locked movie has nothing to play, so it changes no one. It starts defending the following week.
          Your rating can move on a week you didn&apos;t pick, because your last movie was challenged.
        </p>
        <p>
          Defaults from the library: each match can move at most 32 points, a two-point gap in the blended score is a
          lopsided win, and enjoyment and quality count equally. Those knobs are not in the app. The raw scores are
          kept, so the group could replay the log with different settings later.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">Accounts</h2>
        <p>
          Join with the invite code, or ask an admin to make the account. Passwords are hashed. The name on the board
          is the name the ranking stores, and it does not change, because old weeks remember it.
        </p>
        <p>
          An admin can reopen only the latest locked week, and only when no other movie is open. Withdrawing an open
          pick throws away scores that were never ranked.
        </p>
      </section>

      <p className="text-sm">
        <Link href="/leaderboard" className="text-primary underline-offset-4 hover:underline">
          See the board
        </Link>
      </p>
    </article>
  )
}
