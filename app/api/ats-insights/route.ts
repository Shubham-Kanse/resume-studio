import { NextRequest, NextResponse } from "next/server"
import {
  buildATSKnowledgePrompt,
  buildATSSystemPrompt,
  buildATSUserPrompt,
} from "@/lib/llm-context"
import { scoreResumeDeterministically, type DeterministicATSResult } from "@/lib/local-ats-scorer"
import type { ATSIssue, ATSRecommendation, ATSScoreResponse, ATSSectionReview } from "@/lib/ats-types"

export const runtime = "nodejs"
export const maxDuration = 60

type NarrativeSectionReview = Pick<ATSSectionReview, "id" | "diagnosis" | "whatWorks" | "gaps" | "actions">

interface ATSNarrativeResponse {
  keyFindings: {
    strengths: string[]
    weaknesses: string[]
  }
  detailedIssues: ATSIssue[]
  recommendations: ATSRecommendation[]
  sectionReviews: NarrativeSectionReview[]
}

function parseMaxTokens(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveNarrativeMaxTokens(): number {
  const requested = parseMaxTokens(
    process.env.OPENROUTER_ATS_MAX_TOKENS || process.env.OPENROUTER_MAX_TOKENS,
    1800
  )

  // ATS scoring is deterministic now; the model only adds narrative.
  // Keep the token budget intentionally tight to avoid unnecessary credit failures.
  return Math.min(requested, 1800)
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim()
  const fencedMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7).trim()
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3).trim()
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim()
  return cleaned
}

function extractJsonObject(text: string): string {
  const cleaned = stripCodeFences(text)
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("ATS model returned invalid JSON")
  }
  return cleaned.slice(start, end + 1)
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function toPublicResponse(result: DeterministicATSResult): ATSScoreResponse {
  const { evidence: _evidence, ...publicResult } = result
  return publicResult
}

function sanitizeNarrativeResponse(data: unknown): ATSNarrativeResponse {
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, any>
  const allowedIds = new Set<ATSSectionReview["id"]>([
    "professionalSummary",
    "workExperience",
    "skills",
    "education",
    "keywords",
    "formatting",
  ])

  return {
    keyFindings: {
      strengths: toStringArray(obj.keyFindings?.strengths).slice(0, 6),
      weaknesses: toStringArray(obj.keyFindings?.weaknesses).slice(0, 6),
    },
    detailedIssues: Array.isArray(obj.detailedIssues)
      ? obj.detailedIssues.slice(0, 8).map((issue: any) => ({
          severity: ["critical", "high", "medium", "low"].includes(issue?.severity) ? issue.severity : "medium",
          category: String(issue?.category || "General"),
          issue: String(issue?.issue || "Issue not provided"),
          impact: String(issue?.impact || "Impact not provided"),
          howToFix: String(issue?.howToFix || "Fix not provided"),
          example: String(issue?.example || "No example provided"),
        }))
      : [],
    recommendations: Array.isArray(obj.recommendations)
      ? obj.recommendations.slice(0, 6).map((rec: any) => ({
          priority: ["high", "medium", "low"].includes(rec?.priority) ? rec.priority : "medium",
          action: String(rec?.action || "Improve resume alignment"),
          benefit: String(rec?.benefit || "Stronger ATS and recruiter performance"),
          implementation: String(rec?.implementation || "Revise the relevant section with stronger evidence."),
        }))
      : [],
    sectionReviews: Array.isArray(obj.sectionReviews)
      ? obj.sectionReviews
          .slice(0, 6)
          .map((section: any) => {
            const id = String(section?.id || "") as ATSSectionReview["id"]
            if (!allowedIds.has(id)) return null
            return {
              id,
              diagnosis: String(section?.diagnosis || ""),
              whatWorks: toStringArray(section?.whatWorks).slice(0, 3),
              gaps: toStringArray(section?.gaps).slice(0, 3),
              actions: toStringArray(section?.actions).slice(0, 4),
            } satisfies NarrativeSectionReview
          })
          .filter((section): section is NarrativeSectionReview => section !== null)
      : [],
  }
}

function mergeNarrative(
  deterministic: DeterministicATSResult,
  narrative: ATSNarrativeResponse
): ATSScoreResponse {
  const base = toPublicResponse(deterministic)
  const narrativeSections = new Map(narrative.sectionReviews.map((section) => [section.id, section]))

  return {
    ...base,
    keyFindings: {
      strengths: narrative.keyFindings.strengths.length ? narrative.keyFindings.strengths : base.keyFindings.strengths,
      weaknesses: narrative.keyFindings.weaknesses.length ? narrative.keyFindings.weaknesses : base.keyFindings.weaknesses,
      missingKeywords: base.keyFindings.missingKeywords,
      presentKeywords: base.keyFindings.presentKeywords,
    },
    detailedIssues: narrative.detailedIssues.length ? narrative.detailedIssues : base.detailedIssues,
    recommendations: narrative.recommendations.length ? narrative.recommendations : base.recommendations,
    sectionReviews: base.sectionReviews.map((section) => {
      const narrativeSection = narrativeSections.get(section.id)
      if (!narrativeSection) return section
      return {
        ...section,
        diagnosis: narrativeSection.diagnosis || section.diagnosis,
        whatWorks: narrativeSection.whatWorks.length ? narrativeSection.whatWorks : section.whatWorks,
        gaps: narrativeSection.gaps.length ? narrativeSection.gaps : section.gaps,
        actions: narrativeSection.actions.length ? narrativeSection.actions : section.actions,
      }
    }),
  }
}

function resumeHasFutureDate(text: string): boolean {
  const now = new Date("2026-03-08T00:00:00Z")
  const currentYear = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth()

  const yearMatches = text.match(/\b(19|20)\d{2}\b/g) || []
  for (const match of yearMatches) {
    const year = Number(match)
    if (year > currentYear) return true
  }

  const monthMap: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }

  const monthYearPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{4})\b/gi
  let match: RegExpExecArray | null
  while ((match = monthYearPattern.exec(text)) !== null) {
    const month = monthMap[match[1].toLowerCase()]
    const year = Number(match[2])
    if (year > currentYear) return true
    if (year === currentYear && month > currentMonth) return true
  }

  const numericPattern = /\b(0?[1-9]|1[0-2])\/(\d{4})\b/g
  while ((match = numericPattern.exec(text)) !== null) {
    const month = Number(match[1]) - 1
    const year = Number(match[2])
    if (year > currentYear) return true
    if (year === currentYear && month > currentMonth) return true
  }

  return false
}

function hasLayoutEvidence(text: string): boolean {
  return /(table|column|header|footer|text box|textbox|graphic|image|logo|watermark)/i.test(text)
}

function filterItems(items: string[], patterns: RegExp[]): string[] {
  return items.filter((item) => !patterns.some((pattern) => pattern.test(item)))
}

function filterUnsupportedFeedback(response: ATSScoreResponse, resumeContent: string): ATSScoreResponse {
  const futureDatesPresent = resumeHasFutureDate(resumeContent)
  const layoutEvidencePresent = hasLayoutEvidence(resumeContent)

  const unsupportedTemporalPatterns = futureDatesPresent
    ? []
    : [
        /future date/i,
        /future education/i,
        /future qualification/i,
        /future graduation/i,
        /future graduation date/i,
        /timeline discrepancy/i,
        /verification flag/i,
        /date discrepancy/i,
        /current qualification/i,
        /graduation date.*current date/i,
        /education.*relative to.*employment/i,
        /graduation.*relative to.*employment/i,
        /employment end/i,
        /current enrollment status/i,
        /expected graduation/i,
      ]

  const unsupportedAcademicOptionalPatterns = [
    /missing gpa/i,
    /gpa or academic honors/i,
    /academic honors/i,
    /honors where potentially beneficial/i,
    /no indication of current enrollment status/i,
    /no indication of expected graduation/i,
    /expected graduation/i,
    /current enrollment status/i,
  ]

  const unsupportedCosmeticPatterns = layoutEvidencePresent
    ? []
    : [
        /table(s)?\b/i,
        /multi-?column/i,
        /column layout/i,
        /text box/i,
        /textbox/i,
        /image(s)?\b/i,
        /logo(s)?\b/i,
        /photo(s)?\b/i,
        /graphic(s)?\b/i,
        /watermark/i,
        /colored text/i,
        /background color/i,
        /custom font/i,
        /header\/footer/i,
        /header or footer/i,
        /content in header/i,
        /content in footer/i,
        /decorative shape/i,
        /border(s)?\b/i,
      ]

  const unsupportedPatterns = [
    ...unsupportedTemporalPatterns,
    ...unsupportedAcademicOptionalPatterns,
    ...unsupportedCosmeticPatterns,
  ]

  if (unsupportedPatterns.length === 0) return response

  return {
    ...response,
    keyFindings: {
      ...response.keyFindings,
      strengths: filterItems(response.keyFindings.strengths, unsupportedPatterns),
      weaknesses: filterItems(response.keyFindings.weaknesses, unsupportedPatterns),
    },
    detailedIssues: response.detailedIssues.filter((issue) =>
      !unsupportedPatterns.some((pattern) =>
        pattern.test(`${issue.issue} ${issue.impact} ${issue.howToFix} ${issue.example}`)
      )
    ),
    recommendations: response.recommendations.filter((rec) =>
      !unsupportedPatterns.some((pattern) =>
        pattern.test(`${rec.action} ${rec.benefit} ${rec.implementation}`)
      )
    ),
    sectionReviews: response.sectionReviews.map((section) => ({
      ...section,
      whatWorks: filterItems(section.whatWorks, unsupportedPatterns),
      gaps: filterItems(section.gaps, unsupportedPatterns),
      actions: filterItems(section.actions, unsupportedPatterns),
      diagnosis: unsupportedPatterns.some((pattern) => pattern.test(section.diagnosis))
        ? "Section reviewed using only evidence that can be supported from the extracted resume text."
        : section.diagnosis,
    })),
    atsCompatibility: {
      ...response.atsCompatibility,
      issues: filterItems(response.atsCompatibility.issues, unsupportedPatterns),
      warnings: filterItems(response.atsCompatibility.warnings, unsupportedPatterns),
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const jobDescription = String(body?.jobDescription || "").trim()
    const resumeContent = String(body?.resumeContent || "").trim()

    if (!resumeContent) {
      return NextResponse.json(
        { error: "Resume content is required." },
        { status: 400 }
      )
    }

    const deterministic = scoreResumeDeterministically({
      resumeContent,
      jobDescription,
    })

    const deterministicPayload = JSON.stringify(
      {
        analysisMode: deterministic.analysisMode,
        resumeQualityScore: deterministic.resumeQualityScore,
        targetRoleScore: deterministic.targetRoleScore,
        overallScore: deterministic.overallScore,
        categoryScores: deterministic.categoryScores,
        rating: deterministic.rating,
        atsCompatibility: deterministic.atsCompatibility,
        keywordAnalysis: deterministic.keywordAnalysis,
        evidence: deterministic.evidence,
      },
      null,
      2
    )

    let finalResponse: ATSScoreResponse = toPublicResponse(deterministic)

    if (process.env.OPENROUTER_API_KEY) {
      try {
        const systemPrompt = buildATSSystemPrompt()
        const knowledgePrompt = buildATSKnowledgePrompt(jobDescription, resumeContent)
        const userPrompt = buildATSUserPrompt(jobDescription, resumeContent, deterministicPayload)
        const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat"
        const maxTokens = resolveNarrativeMaxTokens()

        const requestPayload = {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: knowledgePrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: maxTokens,
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "AI Resume Generator",
          },
          body: JSON.stringify(requestPayload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.warn("OpenRouter ATS narrative skipped; using deterministic ATS result.", errorData)
        } else {
          const data = await response.json()
          const content = data?.choices?.[0]?.message?.content
          if (content) {
            const parsed = JSON.parse(extractJsonObject(content))
            const narrative = sanitizeNarrativeResponse(parsed)
            finalResponse = mergeNarrative(deterministic, narrative)
          }
        }
      } catch (aiError) {
        console.error("ATS narrative generation error:", aiError)
      }
    }

    const sanitized = filterUnsupportedFeedback(finalResponse, resumeContent)
    return NextResponse.json(sanitized)
  } catch (error) {
    console.error("ATS scoring error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to score resume" },
      { status: 500 }
    )
  }
}
