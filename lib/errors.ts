export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "UPSTREAM_ERROR"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR"

export interface AppErrorOptions {
  code?: AppErrorCode
  status?: number
  userMessage?: string
  retryable?: boolean
  cause?: unknown
  context?: string
  details?: Record<string, unknown> | null
}

export class AppError extends Error {
  code: AppErrorCode
  status: number
  userMessage: string
  retryable: boolean
  cause?: unknown
  context?: string
  details?: Record<string, unknown> | null

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message)
    this.name = "AppError"
    this.code = options.code || "UNKNOWN_ERROR"
    this.status = options.status ?? 500
    this.userMessage = options.userMessage || message
    this.retryable = options.retryable ?? this.status >= 500
    this.cause = options.cause
    this.context = options.context
    this.details = options.details ?? null
  }
}

function inferCode(status?: number): AppErrorCode {
  if (status === 400) return "BAD_REQUEST"
  if (status === 401) return "UNAUTHORIZED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 429) return "RATE_LIMITED"
  if (status === 503) return "SERVICE_UNAVAILABLE"
  if (status && status >= 400 && status < 500) return "VALIDATION_ERROR"
  if (status && status >= 500) return "UPSTREAM_ERROR"
  return "UNKNOWN_ERROR"
}

export function getUserFacingMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof AppError) return error.userMessage
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export function normalizeError(
  error: unknown,
  options: Omit<AppErrorOptions, "cause"> & { fallbackMessage?: string } = {}
) {
  if (error instanceof AppError) return error

  const fallbackMessage = options.fallbackMessage || "Unexpected error"
  const message = error instanceof Error && error.message.trim() ? error.message : fallbackMessage
  const status = options.status ?? 500

  return new AppError(message, {
    ...options,
    cause: error,
    code: options.code || inferCode(status),
    userMessage: options.userMessage || message,
  })
}

export function isLikelyConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes("not configured") || message.includes("missing") || message.includes("service role")
}

export function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}
