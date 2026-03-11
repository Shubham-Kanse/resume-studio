import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security-constants"

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null
  }

  const cookies = document.cookie.split(";")
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split("=")
    if (rawName !== name) continue
    return decodeURIComponent(rest.join("="))
  }

  return null
}

export function getCsrfHeaders(headers?: HeadersInit) {
  const csrfToken = readCookie(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    return headers
  }

  return {
    ...(headers || {}),
    [CSRF_HEADER_NAME]: csrfToken,
  }
}
