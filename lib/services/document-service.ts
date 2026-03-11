import { z } from "zod"

import {
  documentArtifactsSchema,
  type DocumentArtifacts,
  type DocumentBlock,
} from "@/lib/document-artifacts"
import { AppError } from "@/lib/errors"
import { compileLatexDocument } from "@/lib/latex-compiler"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const latexToPdfSchema = z.object({
  latex: z
    .string()
    .trim()
    .min(1, "No LaTeX content provided.")
    .max(150000, "LaTeX document is too large."),
  preview: z.boolean().optional().default(false),
})

export const extractResumeSchema = z.object({
  name: z.string().min(1, "A file is required."),
  type: z.string().max(200).optional().default(""),
  size: z
    .number()
    .positive("Uploaded file is empty.")
    .max(MAX_UPLOAD_BYTES, "Resume file is too large. Use a file under 10MB."),
})

function normalizeExtractedText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
}

function classifyBlockKind(text: string): DocumentBlock["kind"] {
  if (/@|linkedin\.com|github\.com|https?:\/\//i.test(text)) return "contact"
  if (/^\s*[-*•]\s+/.test(text)) return "bullet"
  if (/\|.+\|/.test(text) || /\t/.test(text)) return "tableish"
  if (text.length <= 80 && /^[A-Z0-9][A-Za-z0-9 &/(),.+-]+:?$/.test(text))
    return "heading"
  if (text.length >= 25) return "paragraph"
  return "other"
}

async function extractFromPDF(buffer: ArrayBuffer): Promise<DocumentArtifacts> {
  const pdfParse = (await import("pdf-parse-fork")).default
  const parsed = await pdfParse(Buffer.from(buffer))
  const lines = splitLines(parsed.text || "")
  const blocks: DocumentBlock[] = lines.slice(0, 250).map((line) => ({
    page: 1,
    text: line,
    kind: classifyBlockKind(line),
  }))

  const extractedText = normalizeExtractedText(parsed.text || "")
  const artifacts = {
    sourceType: "pdf" as const,
    extractedText,
    layout: {
      pageCount: parsed.numpages || 1,
      hasTableEvidence: lines.some(
        (line) => (line.match(/\|/g) || []).length >= 2 || /\t/.test(line)
      ),
      hasHeaderFooterEvidence: lines.some((line) =>
        /page\s+\d+|@|linkedin\.com|github\.com|https?:\/\//i.test(line)
      ),
      hasMultiColumnEvidence: false,
      readingOrderRisk: 0,
      averageBlocksPerPage: Number(
        (blocks.length / Math.max(1, parsed.numpages || 1)).toFixed(1)
      ),
    },
    blocks,
  }

  return documentArtifactsSchema.parse(artifacts)
}

async function extractFromWord(
  buffer: ArrayBuffer,
  sourceType: "docx" | "doc"
): Promise<DocumentArtifacts> {
  const mammoth = (await import("mammoth")).default
  const [rawText, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer: Buffer.from(buffer) }),
    mammoth.convertToHtml({ buffer: Buffer.from(buffer) }),
  ])

  const html = htmlResult.value || ""
  const blockMatches = [
    ...html.matchAll(/<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi),
  ]
  const blocks: DocumentBlock[] = blockMatches
    .map((match) => {
      const tag = (match[1] || "").toLowerCase()
      const text = (match[2] || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
      if (!text) return null

      return {
        page: 1,
        text,
        kind:
          tag === "li"
            ? "bullet"
            : tag.startsWith("h")
              ? "heading"
              : classifyBlockKind(text),
      } satisfies DocumentBlock
    })
    .filter((block): block is DocumentBlock => Boolean(block))

  const extractedText = normalizeExtractedText(
    rawText.value || blocks.map((block) => block.text).join("\n")
  )
  const artifacts = {
    sourceType,
    extractedText,
    layout: {
      pageCount: 1,
      hasTableEvidence: /<table|<tr|<td/i.test(html),
      hasHeaderFooterEvidence: /header|footer/i.test(
        htmlResult.messages.map((message) => message.message).join(" ")
      ),
      hasMultiColumnEvidence: false,
      readingOrderRisk: 0,
      averageBlocksPerPage: blocks.length,
    },
    blocks: blocks.slice(0, 250),
  }

  return documentArtifactsSchema.parse(artifacts)
}

export async function compileLatexPdf(input: z.infer<typeof latexToPdfSchema>) {
  return compileLatexDocument(input.latex)
}

export async function extractResumeDocument(
  file: File
): Promise<DocumentArtifacts> {
  const buffer = await file.arrayBuffer()
  const fileName = file.name.toLowerCase()
  const fileType = file.type

  if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
    return extractFromPDF(buffer)
  }

  if (
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc") ||
    fileType.includes("wordprocessingml") ||
    fileType === "application/msword"
  ) {
    return extractFromWord(buffer, fileName.endsWith(".doc") ? "doc" : "docx")
  }

  if (fileType.startsWith("text/")) {
    const text = normalizeExtractedText(await file.text())
    return documentArtifactsSchema.parse({
      sourceType: "text",
      extractedText: text,
      layout: {
        pageCount: 1,
        hasTableEvidence: false,
        hasHeaderFooterEvidence: false,
        hasMultiColumnEvidence: false,
        readingOrderRisk: 0,
        averageBlocksPerPage: splitLines(text).length,
      },
      blocks: splitLines(text)
        .slice(0, 250)
        .map((line) => ({
          page: 1,
          text: line,
          kind: classifyBlockKind(line),
        })),
    })
  }

  throw new AppError("Unsupported file type", {
    code: "BAD_REQUEST",
    status: 400,
    userMessage: "Unsupported file type",
    retryable: false,
  })
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function extractResumeText(file: File) {
  const document = await extractResumeDocument(file)
  return document.extractedText
}
