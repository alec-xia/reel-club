"use client"

import { useActionState } from "react"
import { suggestAction, type ActionState } from "@/app/actions"
import { SubmitButton } from "@/components/submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SuggestForm() {
  const [state, action] = useActionState(suggestAction, null as ActionState)
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="movie">Movie</Label>
        <Input
          id="movie"
          name="movie"
          required
          maxLength={200}
          placeholder="What are we watching?"
          className="h-11 text-base md:text-base"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Why this one</Label>
        <textarea
          id="note"
          name="note"
          maxLength={280}
          rows={3}
          placeholder="Optional. A sentence for the group chat, not a review."
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Posting…">Suggest it</SubmitButton>
    </form>
  )
}
