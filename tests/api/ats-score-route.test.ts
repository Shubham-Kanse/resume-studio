import assert from "node:assert/strict"
import test from "node:test"

import { POST as scoreRoute } from "@/app/api/ats-score/route"

test("ATS score route rejects invalid payloads with a validation error", async () => {
  const request = {
    headers: new Headers({
      "Content-Type": "application/json",
    }),
    json: async () => ({ resumeContent: "" }),
  }

  const response = await scoreRoute(request as never)
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.equal(typeof body.error, "string")
  assert.ok(Array.isArray(body.issues))
})

test("ATS score route returns a scored response for valid payloads", async () => {
  const request = {
    headers: new Headers({
      "Content-Type": "application/json",
    }),
    json: async () => ({
      jobDescription:
        "Senior Product Manager with SQL and analytics experience",
      resumeContent:
        "Senior Product Manager with SQL, analytics, roadmap planning, and stakeholder management.",
    }),
  }

  const response = await scoreRoute(request as never)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(typeof body.overallScore, "number")
  assert.equal(body.analysisMode, "resume-only")
  assert.ok(Array.isArray(body.sectionReviews))
})
