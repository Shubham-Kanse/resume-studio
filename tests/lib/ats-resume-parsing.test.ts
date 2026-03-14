import assert from "node:assert/strict"
import test from "node:test"

import { extractExperienceBullets } from "@/lib/ats-resume-parsing"

test("extractExperienceBullets infers bullets when DOCX extraction loses bullet markers", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin

  Work Experience
  Senior Software Engineer | Acme | Jan 2021 - Present
  Built workflow automation tools in React and Node.js, reducing support time by 24%.
  Improved reporting pipelines with SQL and AWS, cutting dashboard latency by 38%.
  Mentored engineers through system design reviews and release planning.

  Skills
  React, Node.js, SQL, AWS
  `

  const bullets = extractExperienceBullets(resume)

  assert.equal(bullets.length, 3)
  assert.ok(
    bullets.some((bullet) => bullet.includes("reducing support time by 24%"))
  )
  assert.ok(
    bullets.some((bullet) =>
      bullet.includes("cutting dashboard latency by 38%")
    )
  )
  assert.ok(
    bullets.some((bullet) =>
      bullet.includes("Mentored engineers through system design reviews")
    )
  )
})
