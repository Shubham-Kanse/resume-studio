import { NextRequest, NextResponse } from "next/server"

import {
  getFeatureUpgradeMessage,
  PREMIUM_FEATURE,
} from "@/features/subscription/types"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { errorResponse, validationErrorResponse } from "@/lib/api-response"
import { APP_PERMISSION, authorizeRequest } from "@/lib/authorization"
import { verifyCsrfRequest } from "@/lib/csrf"
import { reportServerError } from "@/lib/error-monitoring"
import {
  atsScoreSchema,
  scoreResumeWithInsights,
} from "@/lib/services/ats-service"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const csrfError = verifyCsrfRequest(request)
  if (csrfError) return csrfError

  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ats-insights",
    limit: 12,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { response } = await authorizeRequest(request, {
      permission: APP_PERMISSION.USE_AI_ATS_INSIGHTS,
      unauthorizedMessage: "Sign in to access Pro features.",
      forbiddenMessage: getFeatureUpgradeMessage(
        PREMIUM_FEATURE.AI_ATS_INSIGHTS
      ),
    })
    if (response) {
      return response
    }

    const body = await request.json()
    const parsed = atsScoreSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    return NextResponse.json(await scoreResumeWithInsights(parsed.data))
  } catch (error) {
    reportServerError(error, "ats-insights")
    return errorResponse(error, "Failed to load AI ATS insights.")
  }
}
