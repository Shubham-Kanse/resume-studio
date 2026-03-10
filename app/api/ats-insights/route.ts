import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { errorResponse, forbidden, unauthorized, validationErrorResponse } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { atsScoreSchema, scoreResumeWithInsights } from "@/lib/services/ats-service"
import { resolvePlanSnapshotForUser } from "@/lib/services/subscription-service"
import { getAuthenticatedUserFromRequest } from "@/lib/supabase-server"
import { canAccessFeature, getFeatureUpgradeMessage, PREMIUM_FEATURE } from "@/lib/subscription"

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
    const auth = await getAuthenticatedUserFromRequest(request.headers.get("authorization"))
    if (!auth) {
      return unauthorized("Sign in to access Pro features.")
    }

    const planSnapshot = await resolvePlanSnapshotForUser(auth.user, auth.accessToken)
    if (!canAccessFeature(planSnapshot, PREMIUM_FEATURE.AI_ATS_INSIGHTS)) {
      return forbidden(getFeatureUpgradeMessage(PREMIUM_FEATURE.AI_ATS_INSIGHTS))
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
