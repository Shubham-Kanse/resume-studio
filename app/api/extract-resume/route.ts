import { NextRequest, NextResponse } from "next/server"

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
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
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
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    }

    const normalized = extractedText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join("\n")

    return NextResponse.json({ text: normalized })
  } catch (error) {
    console.error("Extraction error:", error)
    return NextResponse.json(
      { error: `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}
