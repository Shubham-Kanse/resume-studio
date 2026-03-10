import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { isLikelyConfigurationError } from "@/lib/errors"
import { validationErrorResponse } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { generateResume, generateResumeSchema, GroqApiError } from "@/lib/services/resume-generation-service"

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate resume" },
      { status: 500 }
    )
  }
}
