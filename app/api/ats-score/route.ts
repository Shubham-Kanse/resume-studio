import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { filterUnsupportedFeedback } from "@/lib/ats-feedback"
import { buildEvidenceSummary } from "@/lib/ats-evidence"
import { reportServerError } from "@/lib/error-monitoring"
import { scoreResumeDeterministically } from "@/lib/local-ats-scorer"
import type { ATSScoreResponse } from "@/lib/ats-types"
import { validationErrorResponse } from "@/lib/api-response"

export const runtime = "nodejs"
export const maxDuration = 60

const atsScoreSchema = z.object({
  jobDescription: z.string().trim().max(30000, "Job description is too long.").optional().default(""),
  resumeContent: z
    .string()
    .trim()
    .min(1, "Resume content is required.")
    .max(60000, "Resume content is too long."),
})

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ats-score",
    limit: 20,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const parsed = atsScoreSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const { jobDescription, resumeContent } = parsed.data

    const deterministic = scoreResumeDeterministically({
      resumeContent,
      jobDescription,
    })

    const { evidence: _evidence, ...publicResult } = deterministic
    const publicResponse: ATSScoreResponse = {
      ...publicResult,
      evidenceSummary: buildEvidenceSummary(deterministic),
    }

    const sanitized = filterUnsupportedFeedback(publicResponse, resumeContent)
    return NextResponse.json(sanitized)
  } catch (error) {
    reportServerError(error, "ats-score")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to score resume" },
      { status: 500 }
    )
  }
}
