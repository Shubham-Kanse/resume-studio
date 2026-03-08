import { NextRequest, NextResponse } from "next/server"
import { buildKnowledgePrompt, buildSystemPrompt, buildUserPrompt } from "@/lib/llm-context"

export const runtime = "nodejs"
export const maxDuration = 60

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
  try {
    const formData = await request.formData()
    const jd = (formData.get("jobDescription") as string)?.trim() || ""
    const resume = (formData.get("resumeContent") as string)?.trim() || ""
    const extra = (formData.get("extraInstructions") as string)?.trim() || ""

    if (!jd || !resume) {
      return NextResponse.json(
        { error: "Job description and resume are required." },
        { status: 400 }
      )
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured." },
        { status: 500 }
      )
    }

    const systemPrompt = buildSystemPrompt()
    const knowledgePrompt = buildKnowledgePrompt(jd, resume, extra || undefined)
    const userPrompt = buildUserPrompt(jd, resume, extra || undefined)
    const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat"
    const maxTokens = parseMaxTokens(process.env.OPENROUTER_MAX_TOKENS, 8000)
    const requestPayload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: knowledgePrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: maxTokens
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "AI Resume Generator"
        },
        body: JSON.stringify(requestPayload)
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenRouter error:", errorData)
      return NextResponse.json(
        { error: errorData?.error?.message || "AI service error" },
        { status: response.status }
      )
    }

    const data = await response.json()
    const message = data?.choices?.[0]?.message
    let latex = message?.content || ""

    if (!latex) {
      const usedReasoning = Boolean(message?.reasoning)
      return NextResponse.json(
        {
          error: usedReasoning
            ? `Model ${model} used its output budget on reasoning and returned no LaTeX. Increase OPENROUTER_MAX_TOKENS or use a different model.`
            : "AI returned empty response"
        },
        { status: 500 }
      )
    }

    latex = stripCodeFences(latex)
    const start = latex.indexOf("\\documentclass")
    if (start > 0) latex = latex.slice(start)

    return NextResponse.json({ latex })
  } catch (error) {
    console.error("AI generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate resume" },
      { status: 500 }
    )
  }
}
