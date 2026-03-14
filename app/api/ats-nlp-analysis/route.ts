import { NextRequest, NextResponse } from "next/server"

import { z } from "zod"

import { enforceRateLimit } from "@/lib/api-rate-limit"
import { validationErrorResponse } from "@/lib/api-response"
import { buildATSNLPAnalysis } from "@/lib/ats-nlp-analysis"

const atsNlpAnalysisSchema = z.object({
  resumeContent: z
    .string()
    .trim()
    .max(60000, "Resume content is too long.")
    .optional()
    .default(""),
  jobDescription: z
    .string()
    .trim()
    .max(30000, "Job description is too long.")
    .optional()
    .default(""),
})

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ats-nlp-analysis",
    limit: 20,
    windowMs: 60_000,
    requireRemoteInProduction: true,
  })
  if (rateLimitResponse) return rateLimitResponse

  const parsed = atsNlpAnalysisSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return validationErrorResponse(parsed.error)
  }

  return NextResponse.json(
    buildATSNLPAnalysis({
      resumeContent: parsed.data.resumeContent,
      jobDescription: parsed.data.jobDescription,
    })
  )
}
