import { NextResponse } from "next/server"

import { hasRemoteRateLimitConfig } from "@/lib/api-rate-limit"

export const runtime = "nodejs"

function isConfigured(name: string) {
  const value = process.env[name]?.trim()
  return Boolean(value)
}

export async function GET() {
  const checks = {
    groq: isConfigured("GROQ_API_KEY"),
    supabaseAnon:
      isConfigured("NEXT_PUBLIC_SUPABASE_URL") &&
      isConfigured("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseAdmin: isConfigured("SUPABASE_SERVICE_ROLE_KEY"),
    polar:
      isConfigured("POLAR_ACCESS_TOKEN") &&
      isConfigured("POLAR_WEBHOOK_SECRET") &&
      isConfigured("POLAR_PRO_PRODUCT_ID"),
    rateLimiting: hasRemoteRateLimitConfig(),
  }

  const ok = Object.values(checks).every(Boolean)

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  )
}
