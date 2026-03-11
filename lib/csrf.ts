import type { NextRequest } from "next/server"

import { forbidden } from "@/lib/api-response"
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security-constants"

const CSRF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
])

export function createCsrfToken() {
  return crypto.randomUUID().replace(/-/g, "")
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
  }
}

function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS"
}

function parseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function normalizeHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname) ? "localhost" : hostname
}

function normalizeOrigin(url: URL) {
  const port =
    url.port ||
    (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "")
  return `${url.protocol}//${normalizeHostname(url.hostname)}${port ? `:${port}` : ""}`
}

function resolveRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")
  const host = forwardedHost || request.headers.get("host")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const protocol = forwardedProto
    ? `${forwardedProto}:`
    : request.nextUrl.protocol

  if (host) {
    return parseUrl(`${protocol}//${host}`)
  }

  return request.nextUrl
}

export function verifyCsrfRequest(request: NextRequest) {
  if (isSafeMethod(request.method)) {
    return null
  }

  const origin = request.headers.get("origin")
  if (origin) {
    const requestOrigin = resolveRequestOrigin(request)
    const parsedOrigin = parseUrl(origin)

    if (
      !parsedOrigin ||
      !requestOrigin ||
      normalizeOrigin(parsedOrigin) !== normalizeOrigin(requestOrigin)
    ) {
      return forbidden("Invalid request origin.")
    }
  }

  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? null
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME)

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return forbidden("Invalid CSRF token.")
  }

  return null
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME }
