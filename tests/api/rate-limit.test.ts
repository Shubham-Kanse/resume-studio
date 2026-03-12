import assert from "node:assert/strict"
import test from "node:test"

import { enforceRateLimit } from "@/lib/api-rate-limit"

test("rate limit can require remote backing in production", async () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = process.env.NODE_ENV
  const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

  env.NODE_ENV = "production"
  delete env.UPSTASH_REDIS_REST_URL
  delete env.UPSTASH_REDIS_REST_TOKEN

  try {
    const response = await enforceRateLimit(
      {
        headers: new Headers(),
      } as never,
      {
        key: "generate-resume",
        limit: 10,
        windowMs: 60_000,
        requireRemoteInProduction: true,
      }
    )

    assert.ok(response)
    assert.equal(response.status, 503)

    const body = await response.json()
    assert.equal(
      body.error,
      "Rate limiting is not configured for this environment."
    )
    assert.equal(body.code, "SERVICE_UNAVAILABLE")
  } finally {
    env.NODE_ENV = originalNodeEnv

    if (originalUpstashUrl === undefined) {
      delete env.UPSTASH_REDIS_REST_URL
    } else {
      env.UPSTASH_REDIS_REST_URL = originalUpstashUrl
    }

    if (originalUpstashToken === undefined) {
      delete env.UPSTASH_REDIS_REST_TOKEN
    } else {
      env.UPSTASH_REDIS_REST_TOKEN = originalUpstashToken
    }
  }
})
