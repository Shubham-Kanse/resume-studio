import assert from "node:assert/strict"
import test from "node:test"

import {
  buildWordArtifacts,
  extractWordBlocksFromHtml,
  normalizeExtractedText,
} from "@/lib/services/document-service"

test("extractWordBlocksFromHtml preserves headings, bullets, and table rows", () => {
  const html = `
    <h1>Jane Doe</h1>
    <p>jane@example.com | linkedin.com/in/janedoe</p>
    <h2>Professional Experience</h2>
    <ul>
      <li>Built internal tooling</li>
      <li>Improved reporting pipeline</li>
    </ul>
    <table>
      <tr><td>Skills</td><td>React, TypeScript, SQL</td></tr>
    </table>
  `

  const blocks = extractWordBlocksFromHtml(html)

  assert.ok(
    blocks.some(
      (block) => block.kind === "heading" && block.text === "Jane Doe"
    )
  )
  assert.ok(
    blocks.some(
      (block) =>
        block.kind === "bullet" && block.text === "Built internal tooling"
    )
  )
  assert.ok(
    blocks.some(
      (block) =>
        block.kind === "tableish" &&
        block.text === "Skills | React, TypeScript, SQL"
    )
  )
})

test("buildWordArtifacts marks table and multi-column risk from Word HTML", () => {
  const artifacts = buildWordArtifacts({
    sourceType: "docx",
    rawText: `
      Jane Doe

      Professional Experience

      Built internal tooling
    `,
    html: `
      <h1>Jane Doe</h1>
      <table>
        <tr><td>Professional Experience</td><td>Built internal tooling</td></tr>
      </table>
      <div style="column-count: 2"></div>
    `,
    messages: ["Header was ignored during conversion"],
  })

  assert.equal(artifacts.sourceType, "docx")
  assert.equal(artifacts.layout.hasTableEvidence, true)
  assert.equal(artifacts.layout.hasMultiColumnEvidence, true)
  assert.equal(artifacts.layout.hasHeaderFooterEvidence, true)
  assert.ok(artifacts.layout.readingOrderRisk > 0)
  assert.ok(artifacts.blocks.some((block) => block.kind === "tableish"))
})

test("normalizeExtractedText repairs PDF-style wrapping and dehyphenates split words", () => {
  const normalized = normalizeExtractedText(`
    EXPERIENCE
    Built event pipe-
    lines for ETL workflows
    reduced reporting latency by 35 %
    SKILLS
    SQL
    Python
  `)

  const lines = normalized.split("\n")
  assert.ok(lines.includes("EXPERIENCE"))
  assert.ok(
    lines.includes(
      "Built event pipelines for ETL workflows reduced reporting latency by 35%"
    )
  )
  assert.ok(lines.includes("SKILLS"))
  assert.ok(lines.includes("SQL"))
})

test("normalizeExtractedText normalizes unicode whitespace and symbols", () => {
  const normalized = normalizeExtractedText(
    "Senior\u00A0Engineer\u200B\nOptimized ﬁnancial models\u00A0for scale"
  )

  assert.equal(
    normalized,
    "Senior Engineer\nOptimized financial models for scale"
  )
})
