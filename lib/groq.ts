const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

export const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"

type GroqMessageRole = "system" | "user" | "assistant"

export interface GroqChatMessage {
  role: GroqMessageRole
  content: string
}

interface GroqResponseFormat {
  type: "json_object"
}

interface CreateGroqChatCompletionOptions {
  messages: GroqChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: GroqResponseFormat
  timeoutMs?: number
}

interface GroqErrorPayload {
  error?: {
    message?: string
  }
}

export interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

export class GroqApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = "GroqApiError"
    this.status = status
    this.details = details
  }
}

export function getGroqApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error("Groq API key not configured.")
  }
  return apiKey
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
}

function redactGroqHeaders(headers: HeadersInit | undefined) {
  if (!headers || Array.isArray(headers)) return headers
  if (headers instanceof Headers) return headers

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) =>
      key.toLowerCase() === "authorization" ? [key, "Bearer [REDACTED]"] : [key, value]
    )
  )
}

export async function createGroqChatCompletion(
  options: CreateGroqChatCompletionOptions
): Promise<GroqChatCompletionResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000)

  let response: Response
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model || getGroqModel(),
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: options.responseFormat,
      }),
    })
  } catch (error) {
    clearTimeout(timeoutId)
    throw new GroqApiError(
      error instanceof Error ? error.message : "Groq request failed",
      500,
      {
        messageCount: options.messages.length,
        headers: redactGroqHeaders({
          Authorization: `Bearer ${getGroqApiKey()}`,
          "Content-Type": "application/json",
        }),
      }
    )
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as GroqErrorPayload
    throw new GroqApiError(errorData.error?.message || "Groq API error", response.status, errorData)
  }

  return (await response.json()) as GroqChatCompletionResponse
}
