"use client"

import { useActionState } from "react"
import { rateAction, type ActionState } from "@/app/actions"
import { ScorePicker } from "@/components/score-picker"
import { SubmitButton } from "@/components/submit-button"

export function RatingForm({
  movieId,
  experience,
  quality,
}: {
  movieId: number
  experience?: number
  quality?: number
}) {
  const [state, action] = useActionState(rateAction, null as ActionState)
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="movieId" value={movieId} />
      <ScorePicker
        name="experience"
        label="How much did you enjoy watching it?"
        hint="The night itself: the laughs, the slump, the company, the runtime."
        low="Rough night"
        high="Loved it"
        defaultValue={experience}
      />
      <ScorePicker
        name="quality"
        label="How good is the movie, actually?"
        hint="If a friend who wasn't there asked whether the film is good."
        low="Not really"
        high="Genuinely great"
        defaultValue={quality}
      />
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saved. You can change either score whenever you want.
        </p>
      ) : null}
      <SubmitButton pendingLabel="Saving scores…">
        {experience == null ? "Save my scores" : "Update my scores"}
      </SubmitButton>
    </form>
  )
}
