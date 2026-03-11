import { getUserFacingMessage, normalizeError } from "@/lib/errors"

function redactMessage(message: string) {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(
      /\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/gi,
      "[REDACTED_LINKEDIN]"
    )
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]")
}

function serializeError(error: unknown) {
  const normalized = normalizeError(error, {
    fallbackMessage: "Unexpected error",
  })

  const cause =
    normalized.cause instanceof Error
      ? redactMessage(normalized.cause.message)
      : normalized.cause
        ? redactMessage(String(normalized.cause))
        : undefined

  return {
    name: normalized.name,
    code: normalized.code,
    status: normalized.status,
    retryable: normalized.retryable,
    message: redactMessage(normalized.message),
    userMessage: redactMessage(getUserFacingMessage(normalized)),
    context: normalized.context,
    cause,
  }
}

export function reportClientError(error: unknown, context?: string) {
  const payload = serializeError(error)
  console.error(context ? `[client:${context}]` : "[client]", payload)

  if (typeof window === "undefined") return

  void fetch("/api/client-error", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      context: context || "client",
      message: payload.message,
      code: payload.code,
      status: payload.status,
      retryable: payload.retryable,
      path: window.location.pathname,
      userAgent: window.navigator.userAgent,
    }),
  }).catch(() => undefined)
}

export function reportServerError(error: unknown, context?: string) {
  const payload = serializeError(error)
  console.error(context ? `[server:${context}]` : "[server]", payload)

  const webhookUrl = process.env.ERROR_MONITORING_WEBHOOK_URL
  if (!webhookUrl) return

  void fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      level: "error",
      ...payload,
      context: context || payload.context || "server",
      timestamp: new Date().toISOString(),
    }),
    cache: "no-store",
  }).catch(() => undefined)
}
