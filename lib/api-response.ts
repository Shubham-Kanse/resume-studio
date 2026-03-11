import { NextResponse } from "next/server"

import { ZodError } from "zod"

import { normalizeError, type AppErrorCode } from "@/lib/errors"

interface ErrorResponseOptions {
  status: number
  code?: AppErrorCode
  details?: string
  issues?: Array<{
    path: string
    message: string
  }>
  retryable?: boolean
}

function jsonError(message: string, options: ErrorResponseOptions) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: options.code,
      details: options.details,
      issues: options.issues,
      retryable: options.retryable,
    },
    { status: options.status }
  )
}

export function badRequest(message: string) {
  return jsonError(message, {
    status: 400,
    code: "BAD_REQUEST",
    retryable: false,
  })
}

export function unauthorized(message = "Unauthorized") {
  return jsonError(message, {
    status: 401,
    code: "UNAUTHORIZED",
    retryable: false,
  })
}

export function forbidden(message = "Forbidden") {
  return jsonError(message, {
    status: 403,
    code: "FORBIDDEN",
    retryable: false,
  })
}

export function unprocessable(message: string, details?: string) {
  return jsonError(message, {
    status: 422,
    code: "VALIDATION_ERROR",
    details,
    retryable: false,
  })
}

export function serverError(message: string) {
  return jsonError(message, {
    status: 500,
    code: "UNKNOWN_ERROR",
    retryable: true,
  })
}

export function serviceUnavailable(message: string) {
  return jsonError(message, {
    status: 503,
    code: "SERVICE_UNAVAILABLE",
    retryable: true,
  })
}

export function errorResponse(
  error: unknown,
  fallbackMessage = "Something went wrong.",
  status = 500
) {
  const normalized = normalizeError(error, {
    fallbackMessage,
    status,
  })

  return jsonError(normalized.userMessage, {
    status: normalized.status,
    code: normalized.code,
    retryable: normalized.retryable,
  })
}

export function validationErrorResponse(error: ZodError) {
  const message = error.issues[0]?.message || "Invalid request"
  return jsonError(message, {
    status: 400,
    code: "VALIDATION_ERROR",
    retryable: false,
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  })
}

export function rateLimitError(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: "RATE_LIMITED" as const,
      retryable: true,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  )
}

export function customError(
  message: string,
  options: ErrorResponseOptions & { headers?: HeadersInit }
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: options.code,
      details: options.details,
      issues: options.issues,
      retryable: options.retryable,
    },
    {
      status: options.status,
      headers: options.headers,
    }
  )
}
