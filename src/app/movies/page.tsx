import { redirect } from "next/navigation"
import { MovieBoard } from "@/components/movie-board"
import { getCurrentUser } from "@/lib/session"

export const metadata = { title: "Movies" }

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const query = await searchParams
  return <MovieBoard user={user} notice={query.error} />
}
