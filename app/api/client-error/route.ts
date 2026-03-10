import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { reportServerError } from "@/lib/error-monitoring"

export const runtime = "nodejs"

const clientErrorSchema = z.object({
  context: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  code: z.string().trim().max(120).optional(),
  status: z.number().int().min(100).max(599).optional(),
  retryable: z.boolean().optional(),
  path: z.string().max(1000).optional(),
  userAgent: z.string().max(1000).optional(),
})

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "client-error",
    limit: 20,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const parsed = clientErrorSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid client error payload" }, { status: 400 })
    }

    console.error("[client-report]", parsed.data)

    const webhookUrl = process.env.ERROR_MONITORING_WEBHOOK_URL
    if (webhookUrl) {
      void fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level: "error",
          source: "client",
          ...parsed.data,
          timestamp: new Date().toISOString(),
        }),
        cache: "no-store",
      }).catch(() => undefined)
    }

    return NextResponse.json({ ok: true })
  } catch {
    reportServerError("Failed to report client error", "client-error")
    return NextResponse.json({ error: "Failed to report client error" }, { status: 500 })
  }
}
