import { NextResponse } from "next/server"
import { ZodError } from "zod"

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 })
}

export function serviceUnavailable(message: string) {
  return NextResponse.json({ error: message }, { status: 503 })
}

export function validationErrorResponse(error: ZodError) {
  const message = error.issues[0]?.message || "Invalid request"
  return NextResponse.json(
    {
      error: message,
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 }
  )
}
