"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { ActionState } from "@/app/actions"
import { BeliBridgeError } from "@/lib/beli-bridge"
import {
  answerBeliRanking,
  BeliError,
  cancelBeliRanking,
  removeBeliRanking,
  startBeliRanking,
  submitBeliMovie,
} from "@/lib/beli"
import { getCurrentUser } from "@/lib/session"

function refresh() {
  revalidatePath("/beli", "layout")
}

function message(error: unknown): string {
  if (error instanceof BeliError || error instanceof BeliBridgeError) return error.message
  throw error
}

export async function beliSubmitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) return { error: "You need to log in again." }
  try {
    submitBeliMovie(user.id, String(formData.get("title") ?? ""))
  } catch (error) {
    return { error: message(error) }
  }
  refresh()
  redirect("/beli")
}

// The rank page is plain forms: errors travel back in the query string, like
// removeSuggestionAction does for /movies.
function backToRank(movieId: string, error: unknown): never {
  redirect(`/beli/rank/${movieId}?error=${encodeURIComponent(message(error))}`)
}

export async function beliStartAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const movieId = String(formData.get("movieId") ?? "")
  let done = false
  try {
    done = startBeliRanking(user.id, movieId, formData.get("bucket")).done
  } catch (error) {
    backToRank(movieId, error)
  }
  refresh()
  redirect(done ? `/beli/movies/${movieId}` : `/beli/rank/${movieId}`)
}

export async function beliAnswerAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const movieId = String(formData.get("movieId") ?? "")
  let done = false
  try {
    done = answerBeliRanking(user.id, movieId, formData.get("answer")).done
  } catch (error) {
    backToRank(movieId, error)
  }
  refresh()
  redirect(done ? `/beli/movies/${movieId}` : `/beli/rank/${movieId}`)
}

export async function beliCancelAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  cancelBeliRanking(user.id)
  refresh()
  redirect(`/beli/rank/${String(formData.get("movieId") ?? "")}`)
}

export async function beliRemoveAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const movieId = String(formData.get("movieId") ?? "")
  try {
    removeBeliRanking(user.id, movieId)
  } catch (error) {
    redirect(`/beli/movies/${movieId}?error=${encodeURIComponent(message(error))}`)
  }
  refresh()
  redirect(`/beli/movies/${movieId}`)
}
