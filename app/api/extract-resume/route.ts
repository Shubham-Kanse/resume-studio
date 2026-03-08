import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { reportServerError } from "@/lib/error-monitoring"
import { badRequest, validationErrorResponse } from "@/lib/api-response"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const extractResumeSchema = z.object({
  name: z.string().min(1, "A file is required."),
  type: z.string().max(200).optional().default(""),
  size: z.number().positive("Uploaded file is empty.").max(MAX_UPLOAD_BYTES, "Resume file is too large. Use a file under 10MB."),
})

async function extractFromPDF(buffer: ArrayBuffer): Promise<string> {
  const pdfParse = (await import("pdf-parse-fork")).default
  const data = await pdfParse(Buffer.from(buffer))
  return data.text
}

async function extractFromWord(buffer: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
  return result.value
}

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

    const buffer = await file.arrayBuffer()
    const fileName = file.name.toLowerCase()
    const fileType = file.type

    let extractedText = ""

    if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
      extractedText = await extractFromPDF(buffer)
    } else if (
      fileName.endsWith(".docx") ||
      fileName.endsWith(".doc") ||
      fileType.includes("wordprocessingml") ||
      fileType === "application/msword"
    ) {
      extractedText = await extractFromWord(buffer)
    } else if (fileType.startsWith("text/")) {
      extractedText = await file.text()
    } else {
      return badRequest("Unsupported file type")
    }

    const normalized = extractedText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join("\n")

    return NextResponse.json({ text: normalized })
  } catch (error) {
    reportServerError(error, "extract-resume")
    return NextResponse.json(
      { error: `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}
