import { NextRequest, NextResponse } from "next/server"
import { fetchWithPolicy } from "@/lib/http"

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

async function enforceUpstashRateLimit(
  storeKey: string,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  try {
    const incrResponse = await fetchWithPolicy(`${url}/incr/${encodeURIComponent(storeKey)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      retries: 1,
      timeoutMs: 5_000,
    })

    if (!incrResponse.ok) {
      return null
    }

    const incrPayload = (await incrResponse.json()) as { result?: number }
    const count = Number(incrPayload.result ?? 0)

    if (count === 1) {
      await fetchWithPolicy(
        `${url}/expire/${encodeURIComponent(storeKey)}/${Math.ceil(options.windowMs / 1000)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          retries: 0,
          timeoutMs: 5_000,
        }
      ).catch(() => undefined)
    }

    if (count > options.limit) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(options.windowMs / 1000)),
            "X-RateLimit-Limit": String(options.limit),
          },
        }
      )
    }

    return null
  } catch {
    return null
  }
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }

  return request.headers.get("x-real-ip") || "unknown"
}

function buildStoreKey(request: NextRequest, key: string) {
  return `${key}:${getClientIp(request)}`
}

function cleanupExpiredEntries(now: number) {
  for (const [entryKey, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(entryKey)
    }
  }
}

export async function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const storeKey = buildStoreKey(request, options.key)
  const remoteResponse = await enforceUpstashRateLimit(storeKey, options)
  if (remoteResponse) {
    return remoteResponse
  }

  const now = Date.now()
  cleanupExpiredEntries(now)

  const current = rateLimitStore.get(storeKey)

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(storeKey, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return null
  }

  if (current.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(options.limit),
        },
      }
    )
  }

  current.count += 1
  rateLimitStore.set(storeKey, current)
  return null
}
