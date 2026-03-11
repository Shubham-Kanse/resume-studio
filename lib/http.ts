interface JsonBodyOptions {
  body?: unknown
  headers?: Record<string, string>
}

interface FetchWithPolicyOptions
  extends Omit<RequestInit, "body" | "headers">, JsonBodyOptions {
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  retryOnStatuses?: number[]
}

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504]

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithPolicy(
  input: string | URL,
  options: FetchWithPolicyOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 20_000,
    retries = 1,
    retryDelayMs = 350,
    retryOnStatuses = DEFAULT_RETRY_STATUSES,
    body,
    headers,
    ...init
  } = options

  let attempt = 0
  let lastError: unknown = null

  while (attempt <= retries) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(input, {
        ...init,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (
        response.ok ||
        !retryOnStatuses.includes(response.status) ||
        attempt === retries
      ) {
        return response
      }
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error

      if (attempt === retries) {
        throw error
      }
    }

    attempt += 1
    await delay(retryDelayMs * attempt)
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed")
}
