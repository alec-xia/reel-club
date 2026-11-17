import type { Metadata, Viewport } from "next"
import { Fraunces, Outfit } from "next/font/google"
import { Shell } from "@/components/shell"
import { bootstrap } from "@/lib/bootstrap"
import { getCurrentUser } from "@/lib/session"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
})

export const metadata: Metadata = {
  title: {
    default: "Reel Club",
    template: "%s · Reel Club",
  },
  description: "A private weekly movie club: one pick, two scores, and an Elo board for the people who choose.",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7a2e32",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  bootstrap()
  const user = await getCurrentUser()
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <Shell user={user}>{children}</Shell>
      </body>
    </html>
  )
}
