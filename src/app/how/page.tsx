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
        <h2 className="font-heading text-2xl">Suggestions and scores</h2>
        <p>
          Anyone can suggest a movie at any time, and several can be waiting at once. Watch them in whatever order you
          can. There is no weekly slot and no turn to wait for.
        </p>
        <p>
          You do not score a movie you suggested. The ranking library rejects that on purpose: your own opinion is
          never used to defend your own film. If you missed a movie, just don&apos;t score it. Absences drop out of the
          comparisons by themselves.
        </p>
        <p>
          Scores are 1 to 10, including halves. Enjoyment is the night you had. Quality is whether the movie is
          actually good. Each member has one pair of scores per movie, and you can change yours whenever you want. A
          movie joins the ranking as soon as it has a score. Until then it stays under Unwatched / up next.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-heading text-2xl">What the Elo is doing</h2>
        <p>
          Reel Club does not average the scores and call that a rating. It hands the raw pairs to{" "}
          <span className="font-medium">movie_elo</span>, which treats each member&apos;s latest scored pick as their
          player. The new movie plays a match against every earlier pick still on the board. The judges are the people
          who scored both films. A judge who is higher on the board counts for more. Points move from the match loser
          to the match winner, and the club&apos;s total never drifts, so 1500 stays the middle.
        </p>
        <p>
          The ranking is replayed from the score log whenever it is shown. Movies are ordered by when they were first
          scored, so watching a later suggestion first is what the board remembers. Editing a score updates that movie
          in place and replays everything after it. It does not move the movie to the end.
        </p>
        <p>
          The first scored movie has nothing to play, so it changes no one. It starts defending the next one. Your
          rating can move on a movie you didn&apos;t suggest, because your last pick was challenged.
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
          is the name the ranking stores, and it does not change, because old movies remember it.
        </p>
        <p>
          The person who suggested a movie, or an admin, can remove it while it still has no scores. Once someone has
          scored it, the movie stays in the log. Change the numbers instead of deleting them.
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
