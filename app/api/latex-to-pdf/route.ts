import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { reportServerError } from "@/lib/error-monitoring"
import { compileLatexDocument } from "@/lib/latex-compiler"
import { validationErrorResponse } from "@/lib/api-response"

export const runtime = "nodejs"
export const maxDuration = 30

const latexToPdfSchema = z.object({
  latex: z
    .string()
    .trim()
    .min(1, "No LaTeX content provided.")
    .max(150000, "LaTeX document is too large."),
  preview: z.boolean().optional().default(false),
})

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

    const { latex, preview } = parsed.data

    const result = await compileLatexDocument(latex)

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "LaTeX compilation failed.",
          details: result.details.slice(0, 2000),
          provider: result.provider,
        },
        { status: 400 }
      )
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

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to compile LaTeX",
      },
      { status: 500 }
    )
  }
}
