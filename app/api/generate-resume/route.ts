import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { reportServerError } from "@/lib/error-monitoring"
import {
  createGroqChatCompletion,
  getGroqApiKey,
  getGroqModel,
  GroqApiError,
  type GroqChatCompletionResponse,
} from "@/lib/groq"
import { buildKnowledgePrompt, buildSystemPrompt, buildUserPrompt } from "@/lib/llm-context"
import { validationErrorResponse } from "@/lib/api-response"

export const runtime = "nodejs"
export const maxDuration = 60

const generateResumeSchema = z.object({
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

function parseMaxTokens(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim()
  const fencedMatch = cleaned.match(/^```(?:latex|tex)?\s*\n?([\s\S]*?)\n?```$/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()
  if (cleaned.startsWith("```latex")) cleaned = cleaned.slice(8).trim()
  else if (cleaned.startsWith("```tex")) cleaned = cleaned.slice(6).trim()
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3).trim()
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim()
  return cleaned
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "generate-resume",
    limit: 10,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const formData = await request.formData()
    const parsed = generateResumeSchema.safeParse({
      jobDescription: String(formData.get("jobDescription") || ""),
      resumeContent: String(formData.get("resumeContent") || ""),
      extraInstructions: String(formData.get("extraInstructions") || ""),
    })

    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const { jobDescription: jd, resumeContent: resume, extraInstructions: extra } = parsed.data

    try {
      getGroqApiKey()
    } catch {
      return NextResponse.json(
        { error: "Groq API key not configured." },
        { status: 500 }
      )
    }

    const systemPrompt = buildSystemPrompt()
    const knowledgePrompt = buildKnowledgePrompt(jd, resume, extra || undefined)
    const userPrompt = buildUserPrompt(jd, resume, extra || undefined)
    const model = getGroqModel()
    const maxTokens = parseMaxTokens(
      process.env.GROQ_MAX_TOKENS || process.env.OPENROUTER_MAX_TOKENS,
      8000
    )

    let data: GroqChatCompletionResponse
    try {
      data = await createGroqChatCompletion({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: knowledgePrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens,
      })
    } catch (error) {
      if (error instanceof GroqApiError) {
        console.error("Groq error:", error.details)
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      throw error
    }

    const message = data?.choices?.[0]?.message
    let latex = message?.content || ""

    if (!latex) {
      return NextResponse.json(
        { error: `Model ${model} returned no LaTeX. Increase GROQ_MAX_TOKENS or use a different model.` },
        { status: 500 }
      )
    }

    latex = stripCodeFences(latex)
    const start = latex.indexOf("\\documentclass")
    if (start > 0) latex = latex.slice(start)

    return NextResponse.json({ latex })
  } catch (error) {
    reportServerError(error, "generate-resume")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate resume" },
      { status: 500 }
    )
  }
}
