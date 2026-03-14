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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function normalizeWordHtml(html: string) {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|tr|table|ul|ol)>/gi, "</$1>\n")
}

function parseTableRow(rowHtml: string) {
  const cells = [...rowHtml.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripHtml(match[2] || ""))
    .filter(Boolean)

  if (cells.length === 0) return stripHtml(rowHtml)
  return cells.join(" | ")
}

function splitWordRawTextIntoBlocks(rawText: string): DocumentBlock[] {
  return rawText
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((text) => ({
      page: 1,
      text: normalizeExtractedText(text),
      kind: classifyBlockKind(text),
    }))
    .filter((block) => block.text.length > 0)
}

export function extractWordBlocksFromHtml(html: string): DocumentBlock[] {
  const normalizedHtml = normalizeWordHtml(html)
  const blockMatches = [
    ...normalizedHtml.matchAll(
      /<(p|h1|h2|h3|h4|h5|h6|li|tr)[^>]*>([\s\S]*?)<\/\1>/gi
    ),
  ]

  return blockMatches
    .map((match) => {
      const tag = (match[1] || "").toLowerCase()
      const innerHtml = match[2] || ""
      const text =
        tag === "tr" ? parseTableRow(innerHtml) : stripHtml(innerHtml)

      if (!text) return null

      return {
        page: 1,
        text,
        kind:
          tag === "tr"
            ? "tableish"
            : tag === "li"
              ? "bullet"
              : tag.startsWith("h")
                ? "heading"
                : classifyBlockKind(text),
      } satisfies DocumentBlock
    })
    .filter((block): block is DocumentBlock => Boolean(block))
}

function dedupeBlocks(blocks: DocumentBlock[]) {
  const seen = new Set<string>()

  return blocks.filter((block) => {
    const key = `${block.kind}:${block.text.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function estimateWordReadingOrderRisk(blocks: DocumentBlock[], html: string) {
  let risk = 0

  const shortOtherBlocks = blocks.filter(
    (block) =>
      block.kind === "other" &&
      block.text.length >= 4 &&
      block.text.split(/\s+/).length <= 3
  ).length
  if (shortOtherBlocks >= 8) risk += 0.14
  if (/<table|<tr|<td|<th/i.test(html)) risk += 0.18
  if (/column-count|mso-column|w:cols|<v:textbox|<w:txbxcontent/i.test(html))
    risk += 0.22

  return Math.min(0.6, Number(risk.toFixed(2)))
}

export function buildWordArtifacts(params: {
  rawText: string
  html: string
  sourceType: "docx" | "doc"
  messages?: string[]
}): DocumentArtifacts {
  const htmlBlocks = extractWordBlocksFromHtml(params.html)
  const rawBlocks = splitWordRawTextIntoBlocks(params.rawText)
  const blocks = dedupeBlocks([...htmlBlocks, ...rawBlocks]).slice(0, 250)
  const extractedText = normalizeExtractedText(
    blocks.map((block) => block.text).join("\n") || params.rawText
  )
  const messageText = (params.messages || []).join(" ").toLowerCase()
  const hasTableEvidence =
    /<table|<tr|<td|<th/i.test(params.html) ||
    blocks.some((block) => block.kind === "tableish")
  const hasMultiColumnEvidence =
    /column-count|mso-column|w:cols|<v:textbox|<w:txbxcontent/i.test(
      params.html
    ) || hasTableEvidence
  const hasHeaderFooterEvidence =
    /header|footer/i.test(messageText) ||
    /<(header|footer)\b/i.test(params.html)
  const readingOrderRisk = estimateWordReadingOrderRisk(blocks, params.html)

  return documentArtifactsSchema.parse({
    sourceType: params.sourceType,
    extractedText,
    layout: {
      pageCount: 1,
      hasTableEvidence,
      hasHeaderFooterEvidence,
      hasMultiColumnEvidence,
      readingOrderRisk,
      averageBlocksPerPage: blocks.length,
    },
    blocks,
  })
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

  return buildWordArtifacts({
    rawText: rawText.value || "",
    html: htmlResult.value || "",
    sourceType,
    messages: htmlResult.messages.map((message) => message.message),
  })
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
