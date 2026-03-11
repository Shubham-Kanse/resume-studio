import { NextRequest, NextResponse } from "next/server"

import { z } from "zod"

import { deleteAccount } from "@/features/subscription/server/account-service"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import {
  errorResponse,
  serviceUnavailable,
  unauthorized,
  validationErrorResponse,
} from "@/lib/api-response"
import { APP_PERMISSION, authorizeRequest } from "@/lib/authorization"
import { verifyCsrfRequest } from "@/lib/csrf"
import { reportServerError } from "@/lib/error-monitoring"
import { isLikelyConfigurationError } from "@/lib/errors"

export const runtime = "nodejs"

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", {
    error: "Type DELETE to confirm account deletion.",
  }),
})

export async function DELETE(request: NextRequest) {
  const csrfError = verifyCsrfRequest(request)
  if (csrfError) return csrfError

  const rateLimitResponse = await enforceRateLimit(request, {
    key: "account-delete",
    limit: 3,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { context, response } = await authorizeRequest(request, {
      permission: APP_PERMISSION.MANAGE_ACCOUNT,
      unauthorizedMessage: "Sign in to manage your account.",
    })
    if (response) {
      return response
    }
    if (!context.user) {
      return unauthorized()
    }

    const body = await request.json().catch(() => ({}))
    const parsed = deleteAccountSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    try {
      const result = await deleteAccount(
        request.headers.get("authorization"),
        context.accessToken
      )
      if (!result) {
        return unauthorized()
      }

      return NextResponse.json(result)
    } catch (error) {
      if (isLikelyConfigurationError(error)) {
        return serviceUnavailable(
          "Account deletion requires SUPABASE_SERVICE_ROLE_KEY to be configured."
        )
      }

      throw error
    }
  } catch (error) {
    reportServerError(error, "account-delete")
    return errorResponse(error, "Failed to delete account")
  }
}
