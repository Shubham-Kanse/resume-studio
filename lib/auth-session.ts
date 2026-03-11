import { APP_SESSION_COOKIE_NAME } from "@/lib/security-constants"

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function getSessionCookieValue(
  cookie:
    | {
        value?: string | null
      }
    | null
    | undefined
) {
  const value = cookie?.value?.trim()
  return value ? value : null
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  }
}

export { APP_SESSION_COOKIE_NAME }
