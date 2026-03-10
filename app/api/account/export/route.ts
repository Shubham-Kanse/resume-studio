import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { unauthorized } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { exportAccountData } from "@/lib/services/account-service"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "account-export",
    limit: 5,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const payload = await exportAccountData(request.headers.get("authorization"))
    if (!payload) {
      return unauthorized()
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="resume-studio-export.json"',
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    reportServerError(error, "account-export")
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to export account data",
      },
      { status: 500 }
    )
  }
}
