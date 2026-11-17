import Link from "next/link"

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-10">
      <h1 className="font-heading text-4xl">That one isn&apos;t on the list</h1>
      <p className="text-sm text-muted-foreground">The film, or the page, isn&apos;t part of this club.</p>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back home
      </Link>
    </div>
  )
}
