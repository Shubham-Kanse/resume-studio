import assert from "node:assert/strict"
import test from "node:test"

import { normalizePolarSubscriptionStatus } from "@/features/subscription/server/polar-service"

test("polar subscription status preserves supported non-active states", () => {
  assert.equal(normalizePolarSubscriptionStatus("active"), "active")
  assert.equal(normalizePolarSubscriptionStatus("trialing"), "trialing")
  assert.equal(normalizePolarSubscriptionStatus("past_due"), "past_due")
  assert.equal(normalizePolarSubscriptionStatus("canceled"), "canceled")
  assert.equal(normalizePolarSubscriptionStatus("unknown"), "inactive")
  assert.equal(normalizePolarSubscriptionStatus(undefined), "inactive")
})
