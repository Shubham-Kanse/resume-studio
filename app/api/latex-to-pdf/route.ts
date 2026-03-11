import { NextRequest, NextResponse } from "next/server"

import { enforceRateLimit } from "@/lib/api-rate-limit"
import {
  customError,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import {
  compileLatexPdf,
  latexToPdfSchema,
} from "@/lib/services/document-service"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "latex-to-pdf",
    limit: 10,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const parsed = latexToPdfSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const { preview } = parsed.data

    const result = await compileLatexPdf(parsed.data)

    if (!result.ok) {
      return customError("LaTeX compilation failed.", {
        status: 400,
        code: "BAD_REQUEST",
        details: result.details.slice(0, 2000),
        retryable: false,
      })
    }

    return new NextResponse(result.pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": preview
          ? 'inline; filename="resume.pdf"'
          : 'attachment; filename="resume.pdf"',
      },
    })
  } catch (error) {
    reportServerError(error, "latex-to-pdf")
    return errorResponse(error, "Failed to compile LaTeX")
  }
}
