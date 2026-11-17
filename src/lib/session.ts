import { cookies } from "next/headers"
import { destroySession, SESSION_COOKIE, userFromToken, type PublicUser } from "@/lib/auth"

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies()
  return userFromToken(jar.get(SESSION_COOKIE)?.value)
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  destroySession(token)
  jar.delete(SESSION_COOKIE)
}
