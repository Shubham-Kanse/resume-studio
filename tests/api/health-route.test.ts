import assert from "node:assert/strict"
import test from "node:test"

import { GET as healthRoute } from "@/app/api/health/route"

test("health route reports healthy when required env is configured", async () => {
  const env = process.env as Record<string, string | undefined>
  const previous = {
    GROQ_API_KEY: env.GROQ_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET,
    POLAR_PRO_PRODUCT_ID: env.POLAR_PRO_PRODUCT_ID,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  }

  Object.assign(env, {
    GROQ_API_KEY: "gsk_test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    POLAR_ACCESS_TOKEN: "polar",
    POLAR_WEBHOOK_SECRET: "whsec_test",
    POLAR_PRO_PRODUCT_ID: "prod_123",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "token",
  })

  try {
    const response = await healthRoute()
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.checks.rateLimiting, true)
    assert.equal(body.checks.supabaseAdmin, true)
  } finally {
    Object.assign(env, previous)
  }
})
