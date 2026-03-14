import assert from "node:assert/strict"
import test from "node:test"

import { POST as spellCheckRoute } from "@/app/api/ats-spell-check/route"

test("ATS spell-check route avoids false positives for proper nouns and tech terms", async () => {
  const request = {
    headers: new Headers({
      "Content-Type": "application/json",
    }),
    json: async () => ({
      content:
        "Built cloud-native Kafka pipelines in Galway, Ireland using OAuth and completed MSc studies.",
    }),
  }

  const response = await spellCheckRoute(request as never)
  const body = await response.json()

  assert.equal(response.status, 200)
  const issues = Array.isArray(body.issues)
    ? (body.issues as Array<{ word: string }>)
    : []
  const words = new Set(issues.map((issue) => String(issue.word).toLowerCase()))

  assert.equal(words.has("cloud-native"), false)
  assert.equal(words.has("kafka"), false)
  assert.equal(words.has("galway"), false)
  assert.equal(words.has("ireland"), false)
  assert.equal(words.has("oauth"), false)
  assert.equal(words.has("msc"), false)
})

test("ATS spell-check route still flags real misspellings", async () => {
  const request = {
    headers: new Headers({
      "Content-Type": "application/json",
    }),
    json: async () => ({
      content: "Led teh migration and recieved customer feedback.",
    }),
  }

  const response = await spellCheckRoute(request as never)
  const body = await response.json()

  assert.equal(response.status, 200)
  const issues = Array.isArray(body.issues)
    ? (body.issues as Array<{ word: string }>)
    : []
  const words = new Set(issues.map((issue) => String(issue.word).toLowerCase()))

  assert.equal(words.has("teh"), true)
  assert.equal(words.has("recieved"), true)
})
