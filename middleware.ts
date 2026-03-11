import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { createCsrfToken, getCsrfCookieOptions } from "@/lib/csrf"
import { CSRF_COOKIE_NAME } from "@/lib/security-constants"

function shouldEnforceHttps(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return false
  }

  const host = request.headers.get("host") ?? request.nextUrl.hostname
  if (
    host.includes("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  ) {
    return false
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")
  return forwardedProto === "http"
}

export function middleware(request: NextRequest) {
  if (shouldEnforceHttps(request)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.protocol = "https:"
    return NextResponse.redirect(redirectUrl, 308)
  }

  const response = NextResponse.next()

  if (!request.cookies.get(CSRF_COOKIE_NAME)?.value) {
    response.cookies.set(
      CSRF_COOKIE_NAME,
      createCsrfToken(),
      getCsrfCookieOptions()
    )
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
