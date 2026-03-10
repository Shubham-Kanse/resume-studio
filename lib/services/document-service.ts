import { z } from "zod"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import { documentArtifactsSchema, type DocumentArtifacts, type DocumentBlock } from "@/lib/document-artifacts"
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
  size: z.number().positive("Uploaded file is empty.").max(MAX_UPLOAD_BYTES, "Resume file is too large. Use a file under 10MB."),
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
  if (text.length <= 80 && /^[A-Z0-9][A-Za-z0-9 &/(),.+-]+:?$/.test(text)) return "heading"
  if (text.length >= 25) return "paragraph"
  return "other"
}

async function extractFromPDF(buffer: ArrayBuffer): Promise<DocumentArtifacts> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const blocks: DocumentBlock[] = []
  let hasTableEvidence = false
  let hasHeaderFooterEvidence = false
  let hasMultiColumnEvidence = false
  let misorderedPairs = 0
  let pageComparisons = 0

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => "str" in item)
    const rows = new Map<number, TextItem[]>()

    for (const item of items) {
      const y = Math.round(item.transform[5])
      const row = rows.get(y) || []
      row.push(item)
      rows.set(y, row)
    }

    const orderedRows = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, rowItems]) => {
        const sorted = [...rowItems].sort((a, b) => a.transform[4] - b.transform[4])
        const text = sorted.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim()
        const minX = Math.min(...sorted.map((item) => item.transform[4]))
        const maxX = Math.max(...sorted.map((item) => item.transform[4] + item.width))
        const avgFont = sorted.reduce((sum, item) => sum + Math.abs(item.transform[0] || 0), 0) / sorted.length
        return { y, text, minX, maxX, avgFont }
      })
      .filter((row) => row.text.length > 0)

    const leftRows = orderedRows.filter((row) => row.minX < viewport.width * 0.42)
    const rightRows = orderedRows.filter((row) => row.minX > viewport.width * 0.58)
    if (leftRows.length >= 4 && rightRows.length >= 4) hasMultiColumnEvidence = true

    const bodyTop = viewport.height * 0.15
    const bodyBottom = viewport.height * 0.88

    for (let index = 0; index < orderedRows.length; index += 1) {
      const row = orderedRows[index]
      const next = orderedRows[index + 1]
      if (next) {
        pageComparisons += 1
        const horizontalJump = Math.abs(next.minX - row.minX)
        if (horizontalJump > viewport.width * 0.38 && Math.abs(next.y - row.y) < 80) misorderedPairs += 1
      }

      if ((row.y >= viewport.height * 0.92 || row.y <= viewport.height * 0.08) && row.text.length > 4) {
        hasHeaderFooterEvidence = true
      }
      if ((row.text.match(/\|/g) || []).length >= 2) hasTableEvidence = true

      blocks.push({
        page: pageNumber,
        text: row.text,
        kind: classifyBlockKind(row.text),
        x: Number(row.minX.toFixed(1)),
        y: Number(row.y.toFixed(1)),
        width: Number((row.maxX - row.minX).toFixed(1)),
        height: Number(Math.max(10, row.avgFont * 1.3).toFixed(1)),
        fontSize: Number(row.avgFont.toFixed(1)),
      })

      if (row.y < bodyTop || row.y > bodyBottom) {
        if (/@|linkedin\.com|github\.com|https?:\/\//i.test(row.text)) hasHeaderFooterEvidence = true
      }
    }
  }

  const extractedText = normalizeExtractedText(blocks.map((block) => block.text).join("\n"))
  const artifacts = {
    sourceType: "pdf" as const,
    extractedText,
    layout: {
      pageCount: pdf.numPages,
      hasTableEvidence,
      hasHeaderFooterEvidence,
      hasMultiColumnEvidence,
      readingOrderRisk: pageComparisons > 0 ? Number((misorderedPairs / pageComparisons).toFixed(2)) : 0,
      averageBlocksPerPage: Number((blocks.length / Math.max(1, pdf.numPages)).toFixed(1)),
    },
    blocks: blocks.slice(0, 250),
  }

  return documentArtifactsSchema.parse(artifacts)
}

async function extractFromWord(buffer: ArrayBuffer, sourceType: "docx" | "doc"): Promise<DocumentArtifacts> {
  const mammoth = (await import("mammoth")).default
  const [rawText, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer: Buffer.from(buffer) }),
    mammoth.convertToHtml({ buffer: Buffer.from(buffer) }),
  ])

  const html = htmlResult.value || ""
  const blockMatches = [...html.matchAll(/<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi)]
  const blocks: DocumentBlock[] = blockMatches
    .map((match, index) => {
      const tag = match[1].toLowerCase()
      const text = match[2]
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

  const extractedText = normalizeExtractedText(rawText.value || blocks.map((block) => block.text).join("\n"))
  const artifacts = {
    sourceType,
    extractedText,
    layout: {
      pageCount: 1,
      hasTableEvidence: /<table|<tr|<td/i.test(html),
      hasHeaderFooterEvidence: /header|footer/i.test(htmlResult.messages.map((message) => message.message).join(" ")),
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

export async function extractResumeDocument(file: File): Promise<DocumentArtifacts> {
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
        .map((line) => ({ page: 1, text: line, kind: classifyBlockKind(line) })),
    })
  }

  throw new Error("Unsupported file type")
}

function splitLines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean)
}

export async function extractResumeText(file: File) {
  const document = await extractResumeDocument(file)
  return document.extractedText
}
