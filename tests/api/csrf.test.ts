import assert from "node:assert/strict"
import test from "node:test"

import { verifyCsrfRequest } from "@/lib/csrf"

test("csrf validation accepts localhost and 0.0.0.0 as the same local origin", () => {
  const csrfToken = "test-csrf-token"
  const request = {
    method: "POST",
    headers: new Headers({
      origin: "http://localhost:3000",
      host: "0.0.0.0:3000",
      "x-resume-studio-csrf": csrfToken,
    }),
    cookies: {
      get: (name: string) =>
        name === "resume-studio-csrf" ? { value: csrfToken } : undefined,
    },
    nextUrl: new URL("http://0.0.0.0:3000/api/ats-insights"),
  }

  const response = verifyCsrfRequest(request as never)

  assert.equal(response, null)
})

test("csrf validation still rejects cross-site origins", async () => {
  const csrfToken = "test-csrf-token"
  const request = {
    method: "POST",
    headers: new Headers({
      origin: "https://evil.example",
      host: "localhost:3000",
      "x-resume-studio-csrf": csrfToken,
    }),
    cookies: {
      get: (name: string) =>
        name === "resume-studio-csrf" ? { value: csrfToken } : undefined,
    },
    nextUrl: new URL("http://localhost:3000/api/ats-insights"),
  }

  const response = verifyCsrfRequest(request as never)

  assert.ok(response)
  assert.equal(response.status, 403)

  const body = await response.json()
  assert.equal(body.error, "Invalid request origin.")
})
