import { NextRequest, NextResponse } from "next/server"

import { z } from "zod"

import { enforceRateLimit } from "@/lib/api-rate-limit"
import { errorResponse, serviceUnavailable } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { createSupabaseAdminClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const querySchema = z.object({
  email: z.email(),
})

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "auth-check-email",
    limit: 24,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const parsed = querySchema.safeParse({
      email: request.nextUrl.searchParams.get("email"),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { success: true, status: "invalid" as const },
        { status: 200 }
      )
    }

    let normalizedEmail = parsed.data.email.trim().toLowerCase()
    if (!normalizedEmail) {
      return NextResponse.json(
        { success: true, status: "invalid" as const },
        { status: 200 }
      )
    }

    const supabaseAdmin = createSupabaseAdminClient()
    let page = 1
    const perPage = 200
    let exists = false

    // Use Auth Admin API as source of truth so OAuth-created users are included.
    while (!exists && page <= 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })
      if (error) {
        throw error
      }

      const users = data?.users ?? []
      exists = users.some(
        (user) => (user.email ?? "").trim().toLowerCase() === normalizedEmail
      )
      if (users.length < perPage) break
      page += 1
    }

    return NextResponse.json(
      {
        success: true,
        status: exists ? ("registered" as const) : ("available" as const),
      },
      { status: 200 }
    )
  } catch (error) {
    reportServerError(error, "auth-check-email")
    if (
      error instanceof Error &&
      error.message.includes("SUPABASE_SERVICE_ROLE_KEY")
    ) {
      return serviceUnavailable(
        "Email availability check requires SUPABASE_SERVICE_ROLE_KEY."
      )
    }
    return errorResponse(error, "Failed to validate email")
  }
}
