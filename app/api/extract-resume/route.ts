import { NextRequest, NextResponse } from "next/server"

import { enforceRateLimit } from "@/lib/api-rate-limit"
import {
  badRequest,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import {
  extractResumeDocument,
  extractResumeSchema,
} from "@/lib/services/document-service"

export async function POST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, {
    key: "extract-resume",
    limit: 20,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return badRequest("No file provided")
    }

    const parsed = extractResumeSchema.safeParse({
      name: file.name,
      type: file.type,
      size: file.size,
    })

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    try {
      const document = await extractResumeDocument(file)
      return NextResponse.json({
        text: document.extractedText,
        artifacts: document,
      })
    } catch (error) {
      if (error instanceof Error && error.message === "Unsupported file type") {
        return badRequest(error.message)
      }
      throw error
    }
  } catch (error) {
    reportServerError(error, "extract-resume")
    return errorResponse(error, "Extraction failed")
  }
}
