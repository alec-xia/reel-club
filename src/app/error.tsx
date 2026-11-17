"use client"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-md space-y-3 py-10">
      <h1 className="font-heading text-4xl">Something went sideways</h1>
      <p className="text-sm text-muted-foreground">{error.message || "The page couldn't be loaded."}</p>
      <button type="button" onClick={reset} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Try again
      </button>
    </div>
  )
}
