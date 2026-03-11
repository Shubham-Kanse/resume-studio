import assert from "node:assert/strict"
import test from "node:test"

import { GET as accountPlanRoute } from "@/app/api/account/plan/route"

test("account plan route returns the guest snapshot when unauthenticated", async () => {
  const request = {
    headers: new Headers(),
    cookies: {
      get: () => undefined,
    },
    nextUrl: new URL("http://localhost/api/account/plan"),
  }

  const response = await accountPlanRoute(request as never)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.plan, "free")
  assert.equal(body.status, "inactive")
  assert.equal(body.source, "guest")
  assert.deepEqual(body.entitlements, {
    canUseAiGenerator: false,
    canUseAiInsights: false,
    canUseJobTracker: false,
  })
})
