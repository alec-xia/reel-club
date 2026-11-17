"use client"

import { useActionState, useState } from "react"
import { closeWeekAction, type ActionState } from "@/app/actions"
import { SubmitButton } from "@/components/submit-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function CloseWeekButton({
  movie,
  summary,
}: {
  movie: string
  summary: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState(closeWeekAction, null as ActionState)
  return (
    <>
      <Button type="button" className="h-11 px-4 text-base" onClick={() => setOpen(true)}>
        Lock scores
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock {movie}?</DialogTitle>
            <DialogDescription>
              Scores freeze and this week joins the ranking log. Only an admin can reopen the
              latest locked movie, and only while nothing else is open.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed">{summary}</p>
          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <form action={action}>
              <SubmitButton pendingLabel="Updating ranks…">Lock and update ranks</SubmitButton>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
