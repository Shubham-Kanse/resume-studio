import { NextRequest, NextResponse } from "next/server"

import { errorResponse, unauthorized } from "@/lib/api-response"
import {
  APP_SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from "@/lib/auth-session"
import { verifyCsrfRequest } from "@/lib/csrf"
import { reportServerError } from "@/lib/error-monitoring"
import { getAuthenticatedUserFromRequest } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const csrfError = verifyCsrfRequest(request)
  if (csrfError) return csrfError

  try {
    const auth = await getAuthenticatedUserFromRequest(
      request.headers.get("authorization")
    )
    if (!auth) {
      return unauthorized("Sign in to continue.")
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(
      APP_SESSION_COOKIE_NAME,
      auth.accessToken,
      getSessionCookieOptions()
    )
    return response
  } catch (error) {
    reportServerError(error, "auth-session-post")
    return errorResponse(error, "Failed to establish session.")
  }
}

export async function DELETE(request: NextRequest) {
  const csrfError = verifyCsrfRequest(request)
  if (csrfError) return csrfError

  const response = NextResponse.json({ success: true })
  response.cookies.set(APP_SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  })
  return response
}
