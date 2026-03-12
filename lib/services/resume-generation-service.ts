import { z } from "zod"

import { AppError } from "@/lib/errors"
import {
  createGroqChatCompletion,
  getGroqApiKey,
  getGroqModel,
  GroqApiError,
  type GroqChatCompletionResponse,
} from "@/lib/groq"
import { verifyAndRepairLatex } from "@/lib/latex-generation"
import {
  buildKnowledgePrompt,
  buildTailoringPlanPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "@/lib/llm-context"

export const generateResumeSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(1, "Job description is required.")
    .max(30000, "Job description is too long."),
  resumeContent: z
    .string()
    .trim()
    .min(1, "Resume content is required.")
    .max(60000, "Resume content is too long."),
  extraInstructions: z
    .string()
    .trim()
    .max(12000, "Additional info is too long.")
    .optional()
    .default(""),
})

function parseMaxTokens(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function stripCodeFences(text: string) {
  let cleaned = text.trim()
  const fencedMatch = cleaned.match(
    /^```(?:latex|tex)?\s*\n?([\s\S]*?)\n?```$/i
  )
  if (fencedMatch?.[1]) return fencedMatch[1].trim()
  if (cleaned.startsWith("```latex")) cleaned = cleaned.slice(8).trim()
  else if (cleaned.startsWith("```tex")) cleaned = cleaned.slice(6).trim()
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3).trim()
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim()
  return cleaned
}

const tailoringPlanSchema = z.object({
  targetRole: z.string().trim().min(1).max(200).catch("Target Role"),
  targetSeniority: z.string().trim().max(120).nullable().catch(null),
  priorityKeywords: z.array(z.string().trim().min(1).max(80)).max(15).catch([]),
  supportedKeywords: z
    .array(z.string().trim().min(1).max(80))
    .max(20)
    .catch([]),
  unsupportedKeywords: z
    .array(z.string().trim().min(1).max(80))
    .max(8)
    .catch([]),
  summaryStrategy: z.array(z.string().trim().min(1).max(220)).max(6).catch([]),
  skillsBuckets: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(80),
        keywords: z.array(z.string().trim().min(1).max(80)).max(8).catch([]),
      })
    )
    .max(7)
    .catch([]),
  experiencePriorities: z
    .array(
      z.object({
        focusArea: z.string().trim().min(1).max(140),
        evidence: z.array(z.string().trim().min(1).max(220)).max(4).catch([]),
        keywords: z.array(z.string().trim().min(1).max(80)).max(6).catch([]),
      })
    )
    .max(6)
    .catch([]),
  atsGuardrails: z.array(z.string().trim().min(1).max(180)).max(6).catch([]),
  deEmphasize: z.array(z.string().trim().min(1).max(180)).max(5).catch([]),
})

type TailoringPlan = z.infer<typeof tailoringPlanSchema>

function uniqueTrimmed(items: string[], max = items.length) {
  const result: string[] = []
  for (const item of items) {
    const value = item.trim()
    if (!value || result.includes(value)) continue
    result.push(value)
    if (result.length >= max) break
  }
  return result
}

function extractJsonObject(text: string) {
  const cleaned = stripCodeFences(text)
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new AppError("Model returned invalid tailoring plan JSON.", {
      code: "UPSTREAM_ERROR",
      status: 502,
      retryable: true,
    })
  }
  return cleaned.slice(start, end + 1)
}

function normalizeTailoringPlan(plan: TailoringPlan): TailoringPlan {
  return {
    targetRole: plan.targetRole.trim() || "Target Role",
    targetSeniority: plan.targetSeniority?.trim() || null,
    priorityKeywords: uniqueTrimmed(plan.priorityKeywords, 15),
    supportedKeywords: uniqueTrimmed(plan.supportedKeywords, 20),
    unsupportedKeywords: uniqueTrimmed(plan.unsupportedKeywords, 8),
    summaryStrategy: uniqueTrimmed(plan.summaryStrategy, 6),
    skillsBuckets: plan.skillsBuckets
      .map((bucket) => ({
        category: bucket.category.trim(),
        keywords: uniqueTrimmed(bucket.keywords, 8),
      }))
      .filter((bucket) => bucket.category && bucket.keywords.length > 0)
      .slice(0, 7),
    experiencePriorities: plan.experiencePriorities
      .map((priority) => ({
        focusArea: priority.focusArea.trim(),
        evidence: uniqueTrimmed(priority.evidence, 4),
        keywords: uniqueTrimmed(priority.keywords, 6),
      }))
      .filter(
        (priority) =>
          priority.focusArea &&
          (priority.evidence.length > 0 || priority.keywords.length > 0)
      )
      .slice(0, 6),
    atsGuardrails: uniqueTrimmed(plan.atsGuardrails, 6),
    deEmphasize: uniqueTrimmed(plan.deEmphasize, 5),
  }
}

function formatTailoringBlueprint(plan: TailoringPlan): string {
  const lines = [
    `Target role: ${plan.targetRole}`,
    `Target seniority: ${plan.targetSeniority || "Not explicitly stated"}`,
    `Priority keywords: ${plan.priorityKeywords.join(", ") || "None identified"}`,
    `Supported keywords to surface: ${plan.supportedKeywords.join(", ") || "None identified"}`,
  ]

  if (plan.unsupportedKeywords.length > 0) {
    lines.push(
      `Do not claim unsupported keywords: ${plan.unsupportedKeywords.join(", ")}`
    )
  }

  if (plan.summaryStrategy.length > 0) {
    lines.push(`Summary strategy: ${plan.summaryStrategy.join(" | ")}`)
  }

  if (plan.skillsBuckets.length > 0) {
    lines.push(
      `Skills emphasis: ${plan.skillsBuckets
        .map((bucket) => `${bucket.category}: ${bucket.keywords.join(", ")}`)
        .join(" | ")}`
    )
  }

  if (plan.experiencePriorities.length > 0) {
    lines.push(
      `Experience priorities: ${plan.experiencePriorities
        .map(
          (priority) =>
            `${priority.focusArea} -> evidence: ${priority.evidence.join("; ") || "n/a"} -> keywords: ${priority.keywords.join(", ") || "n/a"}`
        )
        .join(" | ")}`
    )
  }

  if (plan.atsGuardrails.length > 0) {
    lines.push(`ATS guardrails: ${plan.atsGuardrails.join(" | ")}`)
  }

  if (plan.deEmphasize.length > 0) {
    lines.push(`De-emphasize: ${plan.deEmphasize.join(" | ")}`)
  }

  return lines.join("\n")
}

async function buildTailoringBlueprint(
  input: z.infer<typeof generateResumeSchema>,
  model: string
) {
  const data = await createGroqChatCompletion({
    model,
    messages: [
      {
        role: "system",
        content:
          "You plan ATS-targeted resume tailoring. Return only valid JSON and never include commentary.",
      },
      {
        role: "user",
        content: buildTailoringPlanPrompt(
          input.jobDescription,
          input.resumeContent,
          input.extraInstructions || undefined
        ),
      },
    ],
    temperature: 0.1,
    maxTokens: 1400,
    responseFormat: { type: "json_object" },
    timeoutMs: 15_000,
  })

  const parsed = tailoringPlanSchema.parse(
    JSON.parse(extractJsonObject(data.choices?.[0]?.message?.content || ""))
  )

  return normalizeTailoringPlan(parsed)
}

export async function generateResume(
  input: z.infer<typeof generateResumeSchema>
) {
  getGroqApiKey()

  const systemPrompt = buildSystemPrompt()
  const model = getGroqModel()
  let tailoringBlueprint = ""

  try {
    const plan = await buildTailoringBlueprint(input, model)
    tailoringBlueprint = formatTailoringBlueprint(plan)
  } catch {
    tailoringBlueprint = ""
  }

  const knowledgePrompt = buildKnowledgePrompt(
    input.jobDescription,
    input.resumeContent,
    input.extraInstructions || undefined
  )
  const userPrompt = buildUserPrompt(
    input.jobDescription,
    input.resumeContent,
    input.extraInstructions || undefined,
    tailoringBlueprint || undefined
  )
  const maxTokens = parseMaxTokens(
    process.env.GROQ_MAX_TOKENS || process.env.OPENROUTER_MAX_TOKENS,
    8000
  )

  const data: GroqChatCompletionResponse = await createGroqChatCompletion({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "system", content: knowledgePrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens,
  })

  const message = data?.choices?.[0]?.message
  let latex = message?.content || ""

  if (!latex) {
    throw new AppError("Model returned no LaTeX.", {
      code: "UPSTREAM_ERROR",
      status: 502,
      userMessage:
        "The AI model returned an empty resume. Please try again shortly.",
      retryable: true,
      details: {
        model,
      },
    })
  }

  latex = stripCodeFences(latex)
  const start = latex.indexOf("\\documentclass")
  if (start > 0) latex = latex.slice(start)

  const verified = await verifyAndRepairLatex({
    latex,
    jobDescription: input.jobDescription,
    resumeContent: input.resumeContent,
    additionalInstructions: input.extraInstructions || undefined,
  })

  return {
    latex: verified.latex,
    validation: {
      repaired: verified.repaired,
      pass: verified.verification.pass,
      issues: verified.verification.issues,
      summary: verified.verification.summary,
    },
  }
}

export { GroqApiError }
