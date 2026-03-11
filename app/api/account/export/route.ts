import { NextRequest, NextResponse } from "next/server"

import { exportAccountData } from "@/features/subscription/server/account-service"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { errorResponse, unauthorized } from "@/lib/api-response"
import { APP_PERMISSION, authorizeRequest } from "@/lib/authorization"
import { verifyCsrfRequest } from "@/lib/csrf"
import { reportServerError } from "@/lib/error-monitoring"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const csrfError = verifyCsrfRequest(request)
  if (csrfError) return csrfError

  const rateLimitResponse = await enforceRateLimit(request, {
    key: "account-export",
    limit: 5,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { context, response } = await authorizeRequest(request, {
      permission: APP_PERMISSION.MANAGE_ACCOUNT,
      unauthorizedMessage: "Sign in to export your account data.",
    })
    if (response) {
      return response
    }
    if (!context.user) {
      return unauthorized()
    }

    const payload = await exportAccountData(
      request.headers.get("authorization"),
      context.accessToken
    )
    if (!payload) {
      return unauthorized()
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="resume-studio-export.json"',
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    reportServerError(error, "account-export")
    return errorResponse(error, "Failed to export account data")
  }
}
