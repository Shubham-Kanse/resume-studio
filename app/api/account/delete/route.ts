import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { isLikelyConfigurationError } from "@/lib/errors"
import { reportServerError } from "@/lib/error-monitoring"
import { serviceUnavailable, unauthorized, validationErrorResponse } from "@/lib/api-response"
import { deleteAccount } from "@/lib/services/account-service"

export const runtime = "nodejs"

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", {
    error: "Type DELETE to confirm account deletion.",
  }),
})

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "account-delete",
    limit: 3,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = deleteAccountSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    try {
      const result = await deleteAccount(request.headers.get("authorization"))
      if (!result) {
        return unauthorized()
      }

      return NextResponse.json(result)
    } catch (error) {
      if (isLikelyConfigurationError(error)) {
        return serviceUnavailable("Account deletion requires SUPABASE_SERVICE_ROLE_KEY to be configured.")
      }

      throw error
    }
  } catch (error) {
    reportServerError(error, "account-delete")
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete account",
      },
      { status: 500 }
    )
  }
}
