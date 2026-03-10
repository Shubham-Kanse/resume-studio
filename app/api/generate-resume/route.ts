import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { errorResponse, forbidden, unauthorized, validationErrorResponse } from "@/lib/api-response"
import { isLikelyConfigurationError } from "@/lib/errors"
import { reportServerError } from "@/lib/error-monitoring"
import { generateResume, generateResumeSchema, GroqApiError } from "@/lib/services/resume-generation-service"
import { resolvePlanSnapshotForUser } from "@/lib/services/subscription-service"
import { getAuthenticatedUserFromRequest } from "@/lib/supabase-server"
import { canAccessFeature, getFeatureUpgradeMessage, PREMIUM_FEATURE } from "@/lib/subscription"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "generate-resume",
    limit: 10,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await getAuthenticatedUserFromRequest(request.headers.get("authorization"))
    if (!auth) {
      return unauthorized("Sign in to access Pro features.")
    }

    const planSnapshot = await resolvePlanSnapshotForUser(auth.user, auth.accessToken)
    if (!canAccessFeature(planSnapshot, PREMIUM_FEATURE.AI_GENERATOR)) {
      return forbidden(getFeatureUpgradeMessage(PREMIUM_FEATURE.AI_GENERATOR))
    }

    const formData = await request.formData()
    const parsed = generateResumeSchema.safeParse({
      jobDescription: String(formData.get("jobDescription") || ""),
      resumeContent: String(formData.get("resumeContent") || ""),
      extraInstructions: String(formData.get("extraInstructions") || ""),
    })

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const data = await generateResume(parsed.data)
    if (!data.validation.pass) {
      return NextResponse.json(
        {
          error: data.validation.summary || "Generated LaTeX did not pass validation.",
          validation: data.validation,
        },
        { status: 422 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof GroqApiError) {
      console.error("Groq error:", error.details)
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (isLikelyConfigurationError(error)) {
      return NextResponse.json({ error: "Groq API key not configured." }, { status: 500 })
    }

    reportServerError(error, "generate-resume")
    return errorResponse(error, "Failed to generate resume.")
  }
}
