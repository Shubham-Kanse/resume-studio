import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { validationErrorResponse } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { atsScoreSchema, scoreResumeWithInsights } from "@/lib/services/ats-service"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ats-insights",
    limit: 12,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const parsed = atsScoreSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    return NextResponse.json(await scoreResumeWithInsights(parsed.data))
  } catch (error) {
    reportServerError(error, "ats-insights")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to score resume" },
      { status: 500 }
    )
  }
}
