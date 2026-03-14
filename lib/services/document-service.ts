import { execFile } from "node:child_process"
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { z } from "zod"

import { tokenizeNaturalText } from "@/lib/ats-natural-language"
import {
  documentArtifactsSchema,
  type DocumentArtifacts,
  type DocumentBlock,
} from "@/lib/document-artifacts"
import { AppError } from "@/lib/errors"
import { compileLatexDocument } from "@/lib/latex-compiler"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const execFileAsync = promisify(execFile)

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

const PDF_BULLET_PREFIX = /^[-*•▪◦●]\s+/
const PDF_NUMBERED_PREFIX = /^\d+[.)]\s+/

function normalizeUnicodeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00AD/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
}

function normalizeLineText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?%])/g, "$1")
    .trim()
}

function isLikelySectionLikeLine(line: string) {
  const normalized = line.trim()
  if (!normalized) return false
  if (
    PDF_BULLET_PREFIX.test(normalized) ||
    PDF_NUMBERED_PREFIX.test(normalized)
  )
    return false
  if (normalized.length > 90) return false

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 8) return false
  if (/[:|]$/.test(normalized)) return true

  const lettersOnly = normalized.replace(/[^A-Za-z]/g, "")
  if (lettersOnly.length === 0) return false
  const uppercaseRatio =
    normalized.replace(/[^A-Z]/g, "").length / lettersOnly.length

  return uppercaseRatio >= 0.7
}

function looksLikeParagraphContinuation(line: string) {
  const normalized = line.trim()
  if (!normalized) return false
  if (
    PDF_BULLET_PREFIX.test(normalized) ||
    PDF_NUMBERED_PREFIX.test(normalized)
  )
    return false

  const firstChar = normalized.charAt(0)
  if (/[a-z(]/.test(firstChar)) return true
  if (
    /^\d/.test(firstChar) &&
    /\b(?:%|ms|sec|seconds?|minutes?|hours?)\b/i.test(normalized)
  ) {
    return true
  }

  const tokenCount = tokenizeNaturalText(normalized, {
    minLength: 1,
    excludeStopwords: false,
  }).length
  return tokenCount > 0 && tokenCount <= 5 && !/[.!?]$/.test(normalized)
}

async function importOptionalModule<T = unknown>(
  moduleName: string
): Promise<T | null> {
  try {
    const dynamicImporter = new Function("name", "return import(name)") as (
      name: string
    ) => Promise<T>
    return await dynamicImporter(moduleName)
  } catch {
    return null
  }
}

export function normalizeExtractedText(value: string) {
  const unicodeNormalized = normalizeUnicodeText(value)
    .replace(/([A-Za-z])-\n\s*([a-z])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")

  const mergedLines: string[] = []
  let current: string | null = null

  for (const rawLine of unicodeNormalized.split("\n")) {
    const line = normalizeLineText(rawLine)
    if (!line) continue

    if (!current) {
      current = line
      continue
    }

    const currentEndsSentence = /[.!?;:]$/.test(current)
    const currentTokenCount = tokenizeNaturalText(current, {
      minLength: 1,
      excludeStopwords: false,
    }).length
    const shouldMerge =
      currentTokenCount >= 4 &&
      !currentEndsSentence &&
      !isLikelySectionLikeLine(current) &&
      !isLikelySectionLikeLine(line) &&
      looksLikeParagraphContinuation(line)

    if (shouldMerge) {
      current = normalizeLineText(`${current} ${line}`)
      continue
    }

    mergedLines.push(current)
    current = line
  }

  if (current) mergedLines.push(current)

  return mergedLines.join("\n")
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
      pageRiskMap: [
        {
          page: 1,
          risk: readingOrderRisk,
          signals: [
            ...(hasTableEvidence ? ["table-evidence"] : []),
            ...(hasMultiColumnEvidence ? ["multi-column-evidence"] : []),
            ...(hasHeaderFooterEvidence ? ["header-footer-evidence"] : []),
          ],
        },
      ],
      flagConfidence: [
        {
          flag: "table-evidence",
          present: hasTableEvidence,
          confidence: hasTableEvidence ? 0.88 : 0.74,
          detail: hasTableEvidence
            ? "Word HTML contains table elements or table-like blocks."
            : "No dominant table signal in Word extraction.",
        },
        {
          flag: "multi-column-evidence",
          present: hasMultiColumnEvidence,
          confidence: hasMultiColumnEvidence ? 0.84 : 0.7,
          detail: hasMultiColumnEvidence
            ? "Word HTML includes column or table layout indicators."
            : "No strong multi-column signal from Word HTML.",
        },
      ],
    },
    blocks,
  })
}

function classifyBlockKind(text: string): DocumentBlock["kind"] {
  if (/@|linkedin\.com|github\.com|https?:\/\//i.test(text)) return "contact"
  if (/^\s*[-*•▪◦●]\s+/.test(text)) return "bullet"
  if (/^\s*\d+[.)]\s+/.test(text)) return "bullet"
  if (/\|.+\|/.test(text) || /\t/.test(text)) return "tableish"
  if (text.length <= 80 && /^[A-Z0-9][A-Za-z0-9 &/(),.+-]+:?$/.test(text))
    return "heading"
  if (text.length >= 25) return "paragraph"
  return "other"
}

function estimatePdfReadingOrderRisk(lines: string[]) {
  if (lines.length < 20) return 0

  const wordCounts = lines.map(
    (line) =>
      tokenizeNaturalText(line, {
        minLength: 1,
        excludeStopwords: false,
      }).length
  )
  const shortLines = wordCounts.filter(
    (count) => count > 0 && count <= 3
  ).length
  const shortLineRatio = shortLines / Math.max(1, lines.length)
  const longLines = wordCounts.filter((count) => count >= 8).length
  const longLineRatio = longLines / Math.max(1, lines.length)

  let alternatingTransitions = 0
  for (let index = 1; index < wordCounts.length; index += 1) {
    const previous = wordCounts[index - 1] || 0
    const current = wordCounts[index] || 0
    if ((previous <= 3 && current >= 8) || (previous >= 8 && current <= 3)) {
      alternatingTransitions += 1
    }
  }
  const alternationRatio =
    alternatingTransitions / Math.max(1, wordCounts.length - 1)

  let risk = 0
  if (shortLineRatio >= 0.35 && longLineRatio >= 0.25) risk += 0.16
  if (alternationRatio >= 0.45) risk += 0.14

  return Math.min(0.6, Number(risk.toFixed(2)))
}

type PdfExtractionCandidate = {
  source: "pdf-parse" | "pdfjs" | "ocr-fallback"
  text: string
  pageCount: number
  pageLines: string[][]
}

type PdfExtractionScore = {
  score: number
  tokenContinuity: number
  sectionDetectability: number
  dateParseability: number
}

function scorePdfExtraction(text: string): PdfExtractionScore {
  const lines = splitLines(text)
  const tokens = tokenizeNaturalText(text, {
    minLength: 1,
    excludeStopwords: false,
  })
  const wordsPerLine =
    lines.length > 0 ? tokens.length / Math.max(1, lines.length) : 0
  const tokenContinuity = Math.max(
    0,
    Math.min(1, (wordsPerLine - 1.2) / Math.max(1, 7.5 - 1.2))
  )

  const sectionHeadings = lines.filter((line) =>
    /^(summary|professional summary|experience|work experience|employment|skills|education|projects|certifications)\b[:\s]*$/i.test(
      line
    )
  ).length
  const sectionDetectability = Math.min(1, sectionHeadings / 5)

  const dateMatches = (
    text.match(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b|\b\d{1,2}\/\d{4}\b|\b(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:present|current|now|(?:19|20)\d{2})\b/gi
    ) || []
  ).length
  const dateParseability = Math.min(1, dateMatches / 8)

  const score = Number(
    (
      tokenContinuity * 0.5 +
      sectionDetectability * 0.3 +
      dateParseability * 0.2
    ).toFixed(3)
  )

  return { score, tokenContinuity, sectionDetectability, dateParseability }
}

async function extractPdfWithPdfParse(
  buffer: ArrayBuffer
): Promise<PdfExtractionCandidate> {
  const pdfParse = (await import("pdf-parse-fork")).default
  const parsed = await pdfParse(Buffer.from(buffer))
  const text = normalizeExtractedText(parsed.text || "")
  const lines = splitLines(text)
  return {
    source: "pdf-parse",
    text,
    pageCount: parsed.numpages || 1,
    pageLines: [lines],
  }
}

async function extractPdfWithPdfJs(
  buffer: ArrayBuffer
): Promise<PdfExtractionCandidate> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer.slice(0)),
    useWorkerFetch: false,
    isEvalSupported: false,
  })
  const pdfDoc = await loadingTask.promise
  const pageLines: string[][] = []
  const pageTexts: string[] = []

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    const page = await pdfDoc.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const items = (textContent.items || []) as Array<{
      str?: string
      transform?: number[]
    }>
    const lineBuckets = new Map<number, string[]>()

    for (const item of items) {
      const raw = (item.str || "").trim()
      if (!raw) continue
      const y =
        Math.round(
          (((item.transform || [])[5] as number | undefined) || 0) * 2
        ) / 2
      const bucket = lineBuckets.get(y) ?? []
      bucket.push(raw)
      lineBuckets.set(y, bucket)
    }

    const sortedLines = [...lineBuckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => normalizeLineText(parts.join(" ")))
      .filter(Boolean)
    pageLines.push(sortedLines)
    pageTexts.push(sortedLines.join("\n"))
  }

  await pdfDoc.destroy()
  const text = normalizeExtractedText(pageTexts.join("\n"))
  return {
    source: "pdfjs",
    text,
    pageCount: pdfDoc.numPages || 1,
    pageLines,
  }
}

async function canRunCommand(command: string) {
  try {
    await execFileAsync("which", [command])
    return true
  } catch {
    return false
  }
}

async function extractPdfWithSystemOcr(
  buffer: ArrayBuffer
): Promise<PdfExtractionCandidate | null> {
  const [hasPdftoppm, hasTesseract] = await Promise.all([
    canRunCommand("pdftoppm"),
    canRunCommand("tesseract"),
  ])
  if (!hasPdftoppm || !hasTesseract) return null

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "resume-ocr-"))
  try {
    const pdfPath = path.join(tempDir, "input.pdf")
    await writeFile(pdfPath, Buffer.from(buffer))

    const imagePrefix = path.join(tempDir, "page")
    await execFileAsync("pdftoppm", ["-png", pdfPath, imagePrefix])

    const files = (await readdir(tempDir))
      .filter((file) => /^page-\d+\.png$/.test(file))
      .sort((left, right) => {
        const leftNum = Number(left.match(/\d+/)?.[0] || 0)
        const rightNum = Number(right.match(/\d+/)?.[0] || 0)
        return leftNum - rightNum
      })
    if (files.length === 0) return null

    const pageLines: string[][] = []
    for (const file of files) {
      const imagePath = path.join(tempDir, file)
      const { stdout } = await execFileAsync("tesseract", [
        imagePath,
        "stdout",
        "-l",
        "eng",
        "--psm",
        "6",
      ])
      pageLines.push(splitLines(normalizeExtractedText(stdout || "")))
    }

    const text = normalizeExtractedText(pageLines.flat().join("\n"))
    return {
      source: "ocr-fallback",
      text,
      pageCount: pageLines.length,
      pageLines,
    }
  } catch {
    return null
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function extractPdfWithPortableOcr(
  buffer: ArrayBuffer
): Promise<PdfExtractionCandidate | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const canvasModule = await importOptionalModule<{
      createCanvas?: Function
    }>("@napi-rs/canvas")
    if (!canvasModule) return null
    const transformers = await import("@xenova/transformers")
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer.slice(0)),
      useWorkerFetch: false,
      isEvalSupported: false,
    })
    const pdfDoc = await loadingTask.promise

    // Keep OCR cost bounded and practical for resume parsing.
    const maxPages = Math.min(pdfDoc.numPages || 1, 4)
    const createCanvas =
      (canvasModule as { createCanvas?: Function }).createCanvas || null
    if (!createCanvas) {
      await pdfDoc.destroy()
      return null
    }

    const pipelineFactory =
      (transformers as { pipeline?: Function }).pipeline || null
    if (!pipelineFactory) {
      await pdfDoc.destroy()
      return null
    }

    const ocr = await pipelineFactory(
      "image-to-text",
      "Xenova/trocr-small-printed",
      { quantized: true }
    )

    const pageLines: string[][] = []

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = createCanvas(
        Math.max(1, Math.floor(viewport.width)),
        Math.max(1, Math.floor(viewport.height))
      )
      const context = canvas.getContext("2d")
      await page.render({
        canvasContext: context,
        viewport,
      }).promise

      const pngBuffer: Buffer = canvas.toBuffer("image/png")
      const result = await ocr(pngBuffer)
      const rawText =
        Array.isArray(result) && result[0]?.generated_text
          ? String(result[0].generated_text)
          : typeof result === "string"
            ? result
            : ""
      pageLines.push(splitLines(normalizeExtractedText(rawText)))
    }

    await pdfDoc.destroy()
    const text = normalizeExtractedText(pageLines.flat().join("\n"))
    if (!text.trim()) return null

    return {
      source: "ocr-fallback",
      text,
      pageCount: pageLines.length,
      pageLines,
    }
  } catch {
    return null
  }
}

function buildPdfPageRiskMap(pageLines: string[][]) {
  return pageLines.map((lines, index) => {
    const tokenCount = tokenizeNaturalText(lines.join(" "), {
      minLength: 1,
      excludeStopwords: false,
    }).length
    const lineCount = Math.max(1, lines.length)
    const avgWordsPerLine = tokenCount / lineCount
    const shortLineRatio =
      lines.filter((line) => line.split(/\s+/).length <= 3).length / lineCount
    const separatorDensity =
      lines.filter((line) => /[|]{1,}|\t/.test(line)).length / lineCount

    const signals: string[] = []
    let risk = 0
    if (avgWordsPerLine < 2.2) {
      risk += 0.2
      signals.push("fragmented-text")
    }
    if (shortLineRatio >= 0.35) {
      risk += 0.18
      signals.push("many-short-lines")
    }
    if (separatorDensity >= 0.1) {
      risk += 0.14
      signals.push("table-like-lines")
    }

    return {
      page: index + 1,
      risk: Math.min(1, Number(risk.toFixed(2))),
      signals,
    }
  })
}

async function extractFromPDF(buffer: ArrayBuffer): Promise<DocumentArtifacts> {
  const [parseCandidate, pdfjsCandidate] = await Promise.all([
    extractPdfWithPdfParse(buffer),
    extractPdfWithPdfJs(buffer).catch(() => null),
  ])
  const baseCandidates = [parseCandidate, pdfjsCandidate].filter(
    (candidate): candidate is PdfExtractionCandidate => Boolean(candidate)
  )
  let best = baseCandidates[0] || parseCandidate
  let bestScore = scorePdfExtraction(best.text)

  for (const candidate of baseCandidates.slice(1)) {
    const candidateScore = scorePdfExtraction(candidate.text)
    if (candidateScore.score > bestScore.score) {
      best = candidate
      bestScore = candidateScore
    }
  }

  if (bestScore.score < 0.32) {
    const ocrCandidates = [
      await extractPdfWithPortableOcr(buffer),
      await extractPdfWithSystemOcr(buffer),
    ].filter((candidate): candidate is PdfExtractionCandidate =>
      Boolean(candidate)
    )
    for (const ocrCandidate of ocrCandidates) {
      const ocrScore = scorePdfExtraction(ocrCandidate.text)
      if (ocrScore.score >= bestScore.score) {
        best = ocrCandidate
        bestScore = ocrScore
      }
    }
  }

  const extractedText = normalizeExtractedText(best.text || "")
  const lines = splitLines(extractedText)
  const pageLines = best.pageLines.length > 0 ? best.pageLines : [lines]
  const blocks: DocumentBlock[] = pageLines
    .flatMap((page, pageIndex) =>
      page.map((line) => ({
        page: pageIndex + 1,
        text: line,
        kind: classifyBlockKind(line),
      }))
    )
    .slice(0, 250)

  const hasTableEvidence = lines.some(
    (line) => (line.match(/\|/g) || []).length >= 2 || /\t/.test(line)
  )
  const readingOrderRisk = estimatePdfReadingOrderRisk(lines)
  const pageRiskMap = buildPdfPageRiskMap(pageLines)
  const hasMultiColumnEvidence =
    readingOrderRisk >= 0.26 || pageRiskMap.some((entry) => entry.risk >= 0.45)
  const hasHeaderFooterEvidence = lines.some((line) =>
    /page\s+\d+|@|linkedin\.com|github\.com|https?:\/\//i.test(line)
  )
  const flagConfidence = [
    {
      flag: "table-evidence",
      present: hasTableEvidence,
      confidence: hasTableEvidence ? 0.84 : 0.74,
      detail: hasTableEvidence
        ? "Detected separator-heavy or tabular lines."
        : "No strong table-like patterns detected.",
    },
    {
      flag: "multi-column-evidence",
      present: hasMultiColumnEvidence,
      confidence: hasMultiColumnEvidence ? 0.78 : 0.7,
      detail: hasMultiColumnEvidence
        ? "Reading-order and page risk patterns suggest potential multi-column layout."
        : "No dominant multi-column extraction pattern detected.",
    },
    {
      flag: "header-footer-evidence",
      present: hasHeaderFooterEvidence,
      confidence: hasHeaderFooterEvidence ? 0.73 : 0.69,
      detail: hasHeaderFooterEvidence
        ? "Contact or page marker patterns may indicate repeated header/footer content."
        : "No repeated header/footer-like markers detected.",
    },
  ]

  return documentArtifactsSchema.parse({
    sourceType: "pdf",
    extractedText,
    layout: {
      pageCount: Math.max(best.pageCount || 1, pageLines.length || 1),
      hasTableEvidence,
      hasHeaderFooterEvidence,
      hasMultiColumnEvidence,
      readingOrderRisk,
      averageBlocksPerPage: Number(
        (blocks.length / Math.max(1, best.pageCount || 1)).toFixed(1)
      ),
      pageRiskMap,
      flagConfidence,
    },
    blocks,
  })
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
        pageRiskMap: [{ page: 1, risk: 0, signals: [] }],
        flagConfidence: [
          {
            flag: "table-evidence",
            present: false,
            confidence: 0.9,
            detail: "Plain text input has no table markup signal.",
          },
          {
            flag: "multi-column-evidence",
            present: false,
            confidence: 0.9,
            detail: "Plain text input has no column-layout signal.",
          },
        ],
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
