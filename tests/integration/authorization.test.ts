import assert from "node:assert/strict"
import test from "node:test"

import { APP_PERMISSION, authorizeRequest } from "@/lib/authorization"

test("authorization allows guests to view plan snapshots", async () => {
  const request = {
    headers: new Headers(),
    cookies: {
      get: () => undefined,
    },
    nextUrl: new URL("http://localhost/api/account/plan"),
  }
  const { context, response } = await authorizeRequest(request as never, {
    permission: APP_PERMISSION.VIEW_PLAN,
    requireAuth: false,
  })

  assert.equal(response, null)
  assert.equal(context.role, "guest")
  assert.equal(context.user, null)
  assert.equal(context.planSnapshot.plan, "free")
})

test("authorization rejects guests from billing actions server-side", async () => {
  const request = {
    headers: new Headers(),
    cookies: {
      get: () => undefined,
    },
    nextUrl: new URL("http://localhost/api/billing/portal"),
  }
  const { response } = await authorizeRequest(request as never, {
    permission: APP_PERMISSION.MANAGE_BILLING,
    unauthorizedMessage: "Sign in to manage billing.",
  })

  assert.ok(response)
  assert.equal(response.status, 401)

  const body = await response.json()
  assert.equal(body.success, false)
  assert.equal(body.error, "Sign in to manage billing.")
})
