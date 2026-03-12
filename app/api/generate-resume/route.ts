import { NextRequest, NextResponse } from "next/server"

import {
  getFeatureUpgradeMessage,
  PREMIUM_FEATURE,
} from "@/features/subscription/types"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import {
  customError,
  errorResponse,
  serverError,
  validationErrorResponse,
} from "@/lib/api-response"
import { APP_PERMISSION, authorizeRequest } from "@/lib/authorization"
import { verifyCsrfRequest } from "@/lib/csrf"
import { reportServerError } from "@/lib/error-monitoring"
import { isLikelyConfigurationError } from "@/lib/errors"
import {
  generateResume,
  generateResumeSchema,
  GroqApiError,
} from "@/lib/services/resume-generation-service"

export const runtime = "nodejs"
export const maxDuration = 60

function hasBlockingLatexValidationIssue(
  issues:
    | Array<{
        type?: string
        severity?: string
      }>
    | undefined
) {
  return Boolean(
    issues?.some(
      (issue) => issue?.severity === "high" && issue?.type === "latex_error"
    )
  )
}

export async function POST(request: NextRequest) {
  const csrfError = verifyCsrfRequest(request)
  if (csrfError) return csrfError

  const rateLimitResponse = await enforceRateLimit(request, {
    key: "generate-resume",
    limit: 10,
    windowMs: 60_000,
    requireRemoteInProduction: true,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { context, response } = await authorizeRequest(request, {
      permission: APP_PERMISSION.USE_AI_GENERATOR,
      unauthorizedMessage: "Sign in to access Pro features.",
      forbiddenMessage: getFeatureUpgradeMessage(PREMIUM_FEATURE.AI_GENERATOR),
    })
    if (response) {
      return response
    }
    if (!context.user || !context.accessToken) {
      return serverError("Authorization context was incomplete.")
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
    if (hasBlockingLatexValidationIssue(data.validation.issues)) {
      return customError(
        data.validation.summary || "Generated LaTeX did not pass validation.",
        {
          status: 422,
          code: "VALIDATION_ERROR",
          retryable: false,
          details: data.validation.summary,
        }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof GroqApiError) {
      console.error("Groq error:", error.details)
      return customError(error.message, {
        status: error.status,
        code: error.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST",
        retryable: error.status >= 500,
      })
    }

    if (isLikelyConfigurationError(error)) {
      return serverError("Groq API key not configured.")
    }

    reportServerError(error, "generate-resume")
    return errorResponse(error, "Failed to generate resume.")
  }
}
