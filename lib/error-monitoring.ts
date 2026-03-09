function redactMessage(message: string) {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/gi, "[REDACTED_LINKEDIN]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]")
}

export function reportClientError(error: unknown, context?: string) {
  console.error(context ? `[client:${context}]` : "[client]", error)

  if (typeof window === "undefined") return

  void fetch("/api/client-error", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      context: context || "client",
      message: redactMessage(error instanceof Error ? error.message : String(error)),
      stack: undefined,
      path: window.location.pathname,
    }),
  }).catch(() => undefined)
}

export function reportServerError(error: unknown, context?: string) {
  console.error(context ? `[server:${context}]` : "[server]", error)

  const webhookUrl = process.env.ERROR_MONITORING_WEBHOOK_URL
  if (!webhookUrl) return

  void fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      level: "error",
      context: context || "server",
      message: redactMessage(error instanceof Error ? error.message : String(error)),
      stack: undefined,
      timestamp: new Date().toISOString(),
    }),
    cache: "no-store",
  }).catch(() => undefined)
}
