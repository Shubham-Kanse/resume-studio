import { z } from "zod"
import { filterUnsupportedFeedback } from "@/lib/ats-feedback"
import { documentArtifactsSchema } from "@/lib/document-artifacts"
import { buildEvidenceSummary } from "@/lib/ats-evidence"
import { createGroqChatCompletion, getGroqModel, GroqApiError } from "@/lib/groq"
import {
  buildATSKnowledgePrompt,
  buildATSSystemPrompt,
  buildATSUserPrompt,
} from "@/lib/llm-context"
import { scoreResumeDeterministically, type DeterministicATSResult } from "@/lib/local-ats-scorer"
import type { ATSIssue, ATSRecommendation, ATSScoreResponse, ATSSectionReview } from "@/lib/ats-types"
import { reportServerError } from "@/lib/error-monitoring"

export const atsScoreSchema = z.object({
  jobDescription: z.string().trim().max(30000, "Job description is too long.").optional().default(""),
  resumeContent: z
    .string()
    .trim()
    .min(1, "Resume content is required.")
    .max(60000, "Resume content is too long."),
  extractionArtifacts: documentArtifactsSchema.nullish().default(null),
})

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

function parseMaxTokens(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveNarrativeMaxTokens() {
  const requested = parseMaxTokens(
    process.env.GROQ_ATS_MAX_TOKENS ||
      process.env.GROQ_MAX_TOKENS ||
      process.env.OPENROUTER_ATS_MAX_TOKENS ||
      process.env.OPENROUTER_MAX_TOKENS,
    1800
  )

  return Math.min(requested, 1800)
}

function stripCodeFences(text: string) {
  let cleaned = text.trim()
  const fencedMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7).trim()
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3).trim()
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim()
  return cleaned
}

function extractJsonObject(text: string) {
  const cleaned = stripCodeFences(text)
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("ATS model returned invalid JSON")
  }
  return cleaned.slice(start, end + 1)
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function toPublicResponse(result: DeterministicATSResult): ATSScoreResponse {
  const { evidence: _evidence, ...publicResult } = result
  return {
    ...publicResult,
    evidenceSummary: buildEvidenceSummary(result),
  }
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

export async function scoreResume(input: z.infer<typeof atsScoreSchema>) {
  const deterministic = scoreResumeDeterministically(input)
  return filterUnsupportedFeedback(toPublicResponse(deterministic), input.resumeContent)
}

export async function scoreResumeWithInsights(input: z.infer<typeof atsScoreSchema>) {
  const deterministic = scoreResumeDeterministically(input)
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

  if (process.env.GROQ_API_KEY) {
    try {
      const systemPrompt = buildATSSystemPrompt()
      const knowledgePrompt = buildATSKnowledgePrompt(input.jobDescription, input.resumeContent)
      const userPrompt = buildATSUserPrompt(input.jobDescription, input.resumeContent, deterministicPayload)
      const model = getGroqModel()
      const maxTokens = resolveNarrativeMaxTokens()

      const data = await createGroqChatCompletion({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: knowledgePrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens,
        responseFormat: { type: "json_object" },
      })

      const content = data?.choices?.[0]?.message?.content
      if (content) {
        const parsed = JSON.parse(extractJsonObject(content))
        finalResponse = mergeNarrative(deterministic, sanitizeNarrativeResponse(parsed))
      }
    } catch (error) {
      reportServerError(error, "ats-insights-narrative")
    }
  }

  return filterUnsupportedFeedback(finalResponse, input.resumeContent)
}

export { GroqApiError }
