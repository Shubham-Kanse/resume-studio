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

export async function generateResume(
  input: z.infer<typeof generateResumeSchema>
) {
  getGroqApiKey()

  const systemPrompt = buildSystemPrompt()
  const knowledgePrompt = buildKnowledgePrompt(
    input.jobDescription,
    input.resumeContent,
    input.extraInstructions || undefined
  )
  const userPrompt = buildUserPrompt(
    input.jobDescription,
    input.resumeContent,
    input.extraInstructions || undefined
  )
  const model = getGroqModel()
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
