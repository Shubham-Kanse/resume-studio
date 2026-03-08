import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { reportServerError } from "@/lib/error-monitoring"
import { serviceUnavailable, unauthorized, validationErrorResponse } from "@/lib/api-response"
import { createSupabaseAdminClient, getAuthenticatedUserFromRequest } from "@/lib/supabase-server"

export const runtime = "nodejs"

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", {
    errorMap: () => ({ message: 'Type DELETE to confirm account deletion.' }),
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
    const auth = await getAuthenticatedUserFromRequest(request.headers.get("authorization"))
    if (!auth) {
      return unauthorized()
    }

    const body = await request.json().catch(() => ({}))
    const parsed = deleteAccountSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    let adminClient
    try {
      adminClient = createSupabaseAdminClient()
    } catch {
      return serviceUnavailable("Account deletion requires SUPABASE_SERVICE_ROLE_KEY to be configured.")
    }

    const { error } = await adminClient.auth.admin.deleteUser(auth.user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
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
