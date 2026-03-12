import assert from "node:assert/strict"
import test from "node:test"

import { accountServiceClient } from "@/features/subscription/client/service-client"

test("delete account sends auth and csrf headers", async () => {
  const originalDocument = globalThis.document
  const originalFetch = globalThis.fetch

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      cookie: "resume-studio-csrf=test-csrf-token",
    },
  })

  let capturedHeaders = new Headers()

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }) as typeof fetch

  try {
    const response = await accountServiceClient.deleteAccount(
      "access-token",
      "DELETE"
    )

    assert.deepEqual(response, { success: true })
    assert.equal(capturedHeaders.get("authorization"), "Bearer access-token")
    assert.equal(capturedHeaders.get("x-resume-studio-csrf"), "test-csrf-token")
    assert.equal(capturedHeaders.get("content-type"), "application/json")
  } finally {
    globalThis.fetch = originalFetch

    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document")
    } else {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      })
    }
  }
})
