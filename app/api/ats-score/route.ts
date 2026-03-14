import { NextRequest, NextResponse } from "next/server"

import { enforceRateLimit } from "@/lib/api-rate-limit"
import { errorResponse, validationErrorResponse } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { atsScoreSchema, scoreResume } from "@/lib/services/ats-service"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ats-score",
    limit: 20,
    windowMs: 60_000,
    requireRemoteInProduction: true,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const parsed = atsScoreSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    return NextResponse.json(await scoreResume(parsed.data))
  } catch (error) {
    reportServerError(error, "ats-score")
    return errorResponse(error, "Failed to score resume")
  }
}
