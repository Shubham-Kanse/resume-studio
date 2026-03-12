import { AppError } from "@/lib/errors"
import { createGroqChatCompletion, getGroqModel } from "@/lib/groq"
import { compileLatexDocument } from "@/lib/latex-compiler"
import { validateLaTeX } from "@/lib/latex-editor"
import { latexToPlainText } from "@/lib/latex-text"
import { scoreResumeDeterministically } from "@/lib/local-ats-scorer"

type LatexIssueSeverity = "high" | "medium" | "low"
type LatexIssueType =
  | "latex_error"
  | "format_violation"
  | "unsupported_claim"
  | "keyword_alignment"
  | "other"

interface LatexVerificationIssue {
  type: LatexIssueType
  severity: LatexIssueSeverity
  message: string
}

interface LatexVerificationResult {
  pass: boolean
  summary: string
  issues: LatexVerificationIssue[]
}

interface LatexCompileResult {
  pass: boolean
  summary: string
  logExcerpt: string | null
  issues: LatexVerificationIssue[]
}

interface LatexAtsOptimizationResult {
  pass: boolean
  summary: string
  issues: LatexVerificationIssue[]
  scores: {
    overall: number
    parseability: number
    keywordMatch: number | null
  }
  missingCriticalTerms: string[]
}

interface VerifyAndRepairLatexInput {
  latex: string
  jobDescription: string
  resumeContent: string
  additionalInstructions?: string
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim()
  const fencedMatch = cleaned.match(
    /^```(?:latex|tex|json)?\s*\n?([\s\S]*?)\n?```$/i
  )
  if (fencedMatch?.[1]) return fencedMatch[1].trim()
  if (cleaned.startsWith("```latex")) cleaned = cleaned.slice(8).trim()
  else if (cleaned.startsWith("```tex")) cleaned = cleaned.slice(6).trim()
  else if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7).trim()
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3).trim()
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim()
  return cleaned
}

function extractJsonObject(text: string): string {
  const cleaned = stripCodeFences(text)
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new AppError("Latex verifier returned invalid JSON", {
      code: "UPSTREAM_ERROR",
      status: 502,
      userMessage: "AI LaTeX verification returned an invalid response.",
      retryable: true,
    })
  }
  return cleaned.slice(start, end + 1)
}

export function normalizeGeneratedLatex(text: string): string {
  const stripped = stripCodeFences(text)
  const start = stripped.indexOf("\\documentclass")
  return start > 0 ? stripped.slice(start) : stripped
}

function shouldSanitizePlainTextLatex(latex: string): boolean {
  const trimmed = latex.trim()
  if (!trimmed) return false

  // Full LaTeX documents already contain structure that is safer to validate
  // and repair than to mutate heuristically.
  if (
    trimmed.includes("\\documentclass") ||
    trimmed.includes("\\begin{document}") ||
    trimmed.includes("\\end{document}")
  ) {
    return false
  }

  const commandMatches = trimmed.match(/\\[A-Za-z@]+/g) || []
  return commandMatches.length < 8
}

export function sanitizePlainTextLatex(latex: string): string {
  if (!shouldSanitizePlainTextLatex(latex)) {
    return latex
  }

  const lines = latex.split("\n")
  const envStack: string[] = []

  return lines
    .map((line) => {
      const escapedLine = line.replace(/\\%/g, "__ESCAPED_PERCENT__")
      const trimmedStart = escapedLine.trimStart()
      const commentStart = trimmedStart.startsWith("%")
        ? escapedLine.indexOf("%")
        : -1
      const codePart =
        commentStart >= 0
          ? line.slice(0, commentStart).replace(/__ESCAPED_PERCENT__/g, "\\%")
          : line
      const commentPart = commentStart >= 0 ? line.slice(commentStart) : ""

      const beginMatch = codePart.match(/\\begin\{([^}]+)\}/)
      if (beginMatch?.[1]) envStack.push(beginMatch[1])

      const inAlignmentEnv = envStack.some((env) =>
        ["tabular", "tabular*", "array", "align", "align*", "aligned"].includes(
          env
        )
      )

      let sanitized = codePart
      if (!inAlignmentEnv) {
        sanitized = sanitized
          .replace(/(^|[^\\])&/g, "$1\\&")
          .replace(/(^|[^\\])_(?!\{)/g, "$1\\_")
          .replace(/(^|[0-9A-Za-z])%(?![A-Za-z])/g, "$1\\%")
      }

      const endMatch = codePart.match(/\\end\{([^}]+)\}/)
      if (endMatch) {
        const last = envStack[envStack.length - 1]
        if (last && last === endMatch[1]) envStack.pop()
      }

      return `${sanitized}${commentPart}`
    })
    .join("\n")
}

export function buildLocalLatexVerification(
  latex: string
): LatexVerificationResult {
  const issues = validateLaTeX(latex).map((issue) => ({
    type: issue.type === "error" ? "latex_error" : "format_violation",
    severity: issue.type === "error" ? "high" : "medium",
    message: issue.message,
  })) satisfies LatexVerificationIssue[]

  return {
    pass: issues.every((issue) => issue.severity !== "high"),
    summary: issues.length
      ? "Local LaTeX validation found issues that may affect compilation or formatting."
      : "Local LaTeX validation passed.",
    issues,
  }
}

export function buildAtsOptimizationVerification(
  latex: string,
  jobDescription: string
): LatexAtsOptimizationResult {
  if (!jobDescription.trim()) {
    return {
      pass: true,
      summary:
        "ATS optimization check skipped because no job description was provided.",
      issues: [],
      scores: {
        overall: 0,
        parseability: 0,
        keywordMatch: null,
      },
      missingCriticalTerms: [],
    }
  }

  const resumeText = latexToPlainText(latex)
  const score = scoreResumeDeterministically({
    resumeContent: resumeText,
    jobDescription,
  })

  const keywordMatch = score.categoryScores.keywordMatch?.score ?? null
  const missingCriticalTerms =
    score.evidenceSummary?.missingKeywords.slice(0, 8) ??
    score.keywordAnalysis?.missingByCategory.required.slice(0, 8) ??
    []
  const issues: LatexVerificationIssue[] = []

  if (score.overallScore < 78) {
    issues.push({
      type: "keyword_alignment",
      severity: "high",
      message: `Deterministic ATS overall score is ${score.overallScore}/100. Strengthen summary, skills, and recent experience alignment to the target role.`,
    })
  } else if (score.overallScore < 86) {
    issues.push({
      type: "keyword_alignment",
      severity: "medium",
      message: `Deterministic ATS overall score is ${score.overallScore}/100. There is still room to improve role alignment and evidence placement.`,
    })
  }

  if (score.atsCompatibility.parseability < 82) {
    issues.push({
      type: "format_violation",
      severity: "high",
      message: `Deterministic parseability score is ${score.atsCompatibility.parseability}/100. The generated resume may not be sufficiently ATS-safe when reduced to plain text.`,
    })
  } else if (score.atsCompatibility.parseability < 90) {
    issues.push({
      type: "format_violation",
      severity: "medium",
      message: `Deterministic parseability score is ${score.atsCompatibility.parseability}/100. Tighten section structure, keyword placement, and extraction clarity.`,
    })
  }

  if (keywordMatch !== null && keywordMatch < 76) {
    issues.push({
      type: "keyword_alignment",
      severity: "high",
      message: `Deterministic keyword-match score is ${keywordMatch}/100. The draft is missing too much supported job terminology.`,
    })
  } else if (keywordMatch !== null && keywordMatch < 88) {
    issues.push({
      type: "keyword_alignment",
      severity: "medium",
      message: `Deterministic keyword-match score is ${keywordMatch}/100. Increase supported exact-match terminology in summary, skills, and recent bullets.`,
    })
  }

  if (missingCriticalTerms.length >= 5) {
    issues.push({
      type: "keyword_alignment",
      severity: "high",
      message: `Supported critical terms are still missing: ${missingCriticalTerms.join(", ")}.`,
    })
  } else if (missingCriticalTerms.length > 0) {
    issues.push({
      type: "keyword_alignment",
      severity: "medium",
      message: `Add more supported critical terms where accurate: ${missingCriticalTerms.join(", ")}.`,
    })
  }

  for (const issue of score.atsCompatibility.issues.slice(0, 3)) {
    issues.push({
      type: "format_violation",
      severity: "medium",
      message: issue,
    })
  }

  const requiredMissing = score.evidence.missingSections.slice(0, 3)
  if (requiredMissing.length > 0) {
    issues.push({
      type: "format_violation",
      severity: "high",
      message: `Required ATS sections are missing or not extractable: ${requiredMissing.join(", ")}.`,
    })
  }

  return {
    pass: !issues.some((issue) => issue.severity === "high"),
    summary: `Deterministic ATS check: overall ${score.overallScore}/100, parseability ${score.atsCompatibility.parseability}/100${keywordMatch !== null ? `, keyword match ${keywordMatch}/100` : ""}.`,
    issues,
    scores: {
      overall: score.overallScore,
      parseability: score.atsCompatibility.parseability,
      keywordMatch,
    },
    missingCriticalTerms,
  }
}

export function buildRepairVerificationSummary(params: {
  repairedPass: boolean
  repairedValidation: LatexVerificationResult
  repairedCompile: LatexCompileResult | null
  repairedAts: LatexAtsOptimizationResult | null
}): string {
  const { repairedPass, repairedValidation, repairedCompile, repairedAts } =
    params

  if (repairedPass) {
    return (
      repairedCompile?.summary ||
      repairedAts?.summary ||
      repairedValidation.summary ||
      "Repair attempt completed."
    )
  }

  if (!repairedValidation.pass) {
    return repairedValidation.summary || "Repair attempt failed validation."
  }

  if (repairedCompile && !repairedCompile.pass) {
    return repairedCompile.summary || "Repair attempt failed validation."
  }

  if (repairedAts && !repairedAts.pass) {
    return repairedAts.summary || "Repair attempt failed validation."
  }

  return "Repair attempt failed validation."
}

async function compileLatexForDiagnostics(
  latex: string
): Promise<LatexCompileResult> {
  const result = await compileLatexDocument(latex)
  if (!result.ok && result.details === "Empty response from LaTeX compiler.") {
    return {
      pass: false,
      summary: "Compiler returned an empty response.",
      logExcerpt: null,
      issues: [
        {
          type: "latex_error",
          severity: "high",
          message: "Compiler returned an empty response.",
        },
      ],
    }
  }

  if (result.ok) {
    return {
      pass: true,
      summary: "pdflatex compilation passed.",
      logExcerpt: null,
      issues: [],
    }
  }

  const excerpt = result.details.slice(0, 3000)
  const issues: LatexVerificationIssue[] = []
  const lines = excerpt.split("\n")

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] || "").trim()
    if (!line.startsWith("!")) continue
    const detail = lines[index + 1]?.trim()
    issues.push({
      type: "latex_error",
      severity: "high",
      message: detail ? `${line} ${detail}` : line,
    })
  }

  if (issues.length === 0) {
    issues.push({
      type: "latex_error",
      severity: "high",
      message: "pdflatex compilation failed. Review compiler log excerpt.",
    })
  }

  return {
    pass: false,
    summary: "pdflatex compilation failed.",
    logExcerpt: excerpt,
    issues,
  }
}

function buildVerificationPrompt(
  input: VerifyAndRepairLatexInput,
  localResult: LatexVerificationResult,
  atsResult?: LatexAtsOptimizationResult
): string {
  return `Review this generated LaTeX resume against the source resume and job description.

Your task:
1. Identify unsupported claims or invented facts.
2. Identify LaTeX issues that could break compilation or produce poor output.
3. Identify important target-role keywords from the JD that are missing even though the source resume supports them.
4. Return JSON only.

JSON schema:
{
  "pass": boolean,
  "summary": string,
  "issues": [
    {
      "type": "latex_error" | "format_violation" | "unsupported_claim" | "keyword_alignment" | "other",
      "severity": "high" | "medium" | "low",
      "message": string
    }
  ]
}

Local validation summary:
${JSON.stringify(localResult, null, 2)}

${
  atsResult
    ? `Deterministic ATS summary:
${JSON.stringify(atsResult, null, 2)}

`
    : ""
}## JOB DESCRIPTION
${input.jobDescription}

## SOURCE RESUME
${input.resumeContent}

${input.additionalInstructions?.trim() ? `## ADDITIONAL INSTRUCTIONS\n${input.additionalInstructions.trim()}\n\n` : ""}## GENERATED LATEX
${input.latex}`
}

function buildRepairPrompt(
  input: VerifyAndRepairLatexInput,
  verification: LatexVerificationResult,
  compileResult?: LatexCompileResult,
  atsResult?: LatexAtsOptimizationResult
): string {
  return `Repair this generated LaTeX resume.

Requirements:
- Return only raw LaTeX.
- Keep all supported facts from the source resume.
- Remove or rewrite unsupported claims.
- Preserve strong alignment with the job description.
- Fix LaTeX and formatting issues so it compiles cleanly.

Repair issues:
${JSON.stringify(verification, null, 2)}

${
  compileResult?.logExcerpt
    ? `Compiler diagnostics:
${compileResult.logExcerpt}

`
    : ""
}${
    atsResult
      ? `Deterministic ATS diagnostics:
${JSON.stringify(atsResult, null, 2)}

`
      : ""
  }Focus on fixing any real pdflatex compilation errors first, then ATS parseability and keyword alignment issues.

## JOB DESCRIPTION
${input.jobDescription}

## SOURCE RESUME
${input.resumeContent}

${input.additionalInstructions?.trim() ? `## ADDITIONAL INSTRUCTIONS\n${input.additionalInstructions.trim()}\n\n` : ""}## LATEX TO REPAIR
${input.latex}`
}

async function verifyLatexWithGroq(
  input: VerifyAndRepairLatexInput,
  localResult: LatexVerificationResult,
  atsResult?: LatexAtsOptimizationResult
): Promise<LatexVerificationResult> {
  const data = await createGroqChatCompletion({
    model: getGroqModel(),
    messages: [
      {
        role: "system",
        content:
          "You are a strict resume QA and LaTeX validation assistant. Return only valid JSON and do not include commentary.",
      },
      {
        role: "user",
        content: buildVerificationPrompt(input, localResult, atsResult),
      },
    ],
    temperature: 0.1,
    maxTokens: 700,
    responseFormat: { type: "json_object" },
    timeoutMs: 12_000,
  })

  const content = data.choices?.[0]?.message?.content || ""
  const parsed = JSON.parse(
    extractJsonObject(content)
  ) as Partial<LatexVerificationResult>
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues
        .map((issue) => ({
          type: issue?.type || "other",
          severity: issue?.severity || "medium",
          message: String(issue?.message || "").trim(),
        }))
        .filter((issue) => issue.message)
    : []

  return {
    pass:
      Boolean(parsed.pass) &&
      issues.every((issue) => issue.severity !== "high"),
    summary: String(parsed.summary || "Verification completed."),
    issues,
  }
}

async function repairLatexWithGroq(
  input: VerifyAndRepairLatexInput,
  verification: LatexVerificationResult,
  compileResult?: LatexCompileResult,
  atsResult?: LatexAtsOptimizationResult
): Promise<string> {
  const data = await createGroqChatCompletion({
    model: getGroqModel(),
    messages: [
      {
        role: "system",
        content:
          "You repair ATS resume LaTeX. Return only raw LaTeX that starts with \\documentclass and ends with \\end{document}.",
      },
      {
        role: "user",
        content: buildRepairPrompt(
          input,
          verification,
          compileResult,
          atsResult
        ),
      },
    ],
    temperature: 0.1,
    maxTokens: 5000,
    timeoutMs: 20_000,
  })

  return normalizeGeneratedLatex(data.choices?.[0]?.message?.content || "")
}

export async function verifyAndRepairLatex(
  input: VerifyAndRepairLatexInput
): Promise<{
  latex: string
  verification: LatexVerificationResult
  repaired: boolean
}> {
  const normalized = sanitizePlainTextLatex(
    normalizeGeneratedLatex(input.latex)
  )
  const localResult = buildLocalLatexVerification(normalized)
  let combinedResult = localResult
  let compileResult: LatexCompileResult | null = null
  let atsResult: LatexAtsOptimizationResult | null = null

  try {
    atsResult = buildAtsOptimizationVerification(
      normalized,
      input.jobDescription
    )
    if (!atsResult.pass) {
      combinedResult = {
        pass: false,
        summary: atsResult.summary,
        issues: [...combinedResult.issues, ...atsResult.issues],
      }
    }
  } catch {
    atsResult = null
  }

  try {
    const modelResult = await verifyLatexWithGroq(
      {
        ...input,
        latex: normalized,
      },
      localResult,
      atsResult || undefined
    )

    combinedResult = {
      pass: localResult.pass && modelResult.pass,
      summary: modelResult.summary || localResult.summary,
      issues: [...localResult.issues, ...modelResult.issues],
    }
  } catch {
    combinedResult = localResult
  }

  try {
    compileResult = await compileLatexForDiagnostics(normalized)
    if (!compileResult.pass) {
      combinedResult = {
        pass: false,
        summary: compileResult.summary,
        issues: [...combinedResult.issues, ...compileResult.issues],
      }
    }
  } catch {
    compileResult = null
  }

  if (combinedResult.pass) {
    return { latex: normalized, verification: combinedResult, repaired: false }
  }

  try {
    const repairedLatex = await repairLatexWithGroq(
      {
        ...input,
        latex: normalized,
      },
      combinedResult,
      compileResult || undefined,
      atsResult || undefined
    )

    const repairedValidation = buildLocalLatexVerification(repairedLatex)
    const repairedAts = input.jobDescription.trim()
      ? buildAtsOptimizationVerification(repairedLatex, input.jobDescription)
      : null
    const repairedCompile = await compileLatexForDiagnostics(
      repairedLatex
    ).catch(() => null)
    const repairedIssues = [
      ...repairedValidation.issues,
      ...(repairedAts?.issues || []),
      ...(repairedCompile && !repairedCompile.pass
        ? repairedCompile.issues
        : []),
    ]
    const repairedPass =
      repairedValidation.pass &&
      (repairedCompile?.pass ?? true) &&
      (repairedAts?.pass ?? true)
    return {
      latex: repairedLatex,
      verification: {
        pass: repairedPass,
        summary: buildRepairVerificationSummary({
          repairedPass,
          repairedValidation,
          repairedCompile,
          repairedAts,
        }),
        issues: repairedIssues,
      },
      repaired: true,
    }
  } catch {
    return {
      latex: normalized,
      verification: combinedResult,
      repaired: false,
    }
  }
}
