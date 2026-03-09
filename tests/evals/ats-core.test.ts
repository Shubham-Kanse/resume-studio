import test from "node:test"
import assert from "node:assert/strict"
import { filterUnsupportedFeedback, resumeHasFutureDate } from "../../lib/ats-feedback"
import { scoreResumeDeterministically } from "../../lib/local-ats-scorer"

test("future-date detection uses the actual current year boundary", () => {
  assert.equal(
    resumeHasFutureDate("Senior Engineer, Jan 2027 - Present", new Date("2026-03-09T00:00:00Z")),
    true
  )
  assert.equal(
    resumeHasFutureDate("Senior Engineer, Jan 2026 - Present", new Date("2026-03-09T00:00:00Z")),
    false
  )
})

test("unsupported ATS feedback is removed when it is not grounded in extracted text", () => {
  const filtered = filterUnsupportedFeedback(
    {
      analysisMode: "resume-only",
      resumeQualityScore: 80,
      targetRoleScore: null,
      overallScore: 80,
      categoryScores: {
        keywordMatch: null,
        formatting: { score: 80, maxScore: 100 },
        contentQuality: { score: 80, maxScore: 100 },
        professionalSummary: { score: 80, maxScore: 100 },
        skills: { score: 80, maxScore: 100 },
        structure: { score: 80, maxScore: 100 },
      },
      rating: "Very Good",
      keyFindings: {
        strengths: ["Clear chronology"],
        weaknesses: ["Potential future graduation date"],
        missingKeywords: null,
        presentKeywords: null,
      },
      detailedIssues: [
        {
          severity: "medium",
          category: "Education",
          issue: "Future graduation date",
          impact: "Can look inaccurate.",
          howToFix: "Adjust the date.",
          example: "May 2027",
        },
      ],
      recommendations: [
        {
          priority: "medium",
          action: "Fix future graduation date",
          benefit: "Removes verification risk",
          implementation: "Review education timeline",
        },
      ],
      sectionReviews: [],
      atsCompatibility: { parseability: 90, issues: [], warnings: [] },
      keywordAnalysis: null,
      debugAnalysis: [],
      evidenceSummary: undefined,
    },
    "BSc Computer Science, May 2024"
  )

  assert.equal(filtered.detailedIssues.length, 0)
  assert.equal(filtered.recommendations.length, 0)
  assert.deepEqual(filtered.keyFindings.weaknesses, [])
})

test("deterministic ATS scorer exposes stable evidence for a strong aligned resume", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin | linkedin.com/in/janedoe

  Professional Summary
  Senior product manager with 8 years leading B2B SaaS platforms, analytics, and cross-functional launches.

  Work Experience
  Product Manager | Acme | Jan 2020 - Present
  - Led roadmap execution for analytics platform used by enterprise customers.
  - Partnered with engineering and design to ship workflow automation features.
  - Increased activation by 18% and reduced churn by 11%.

  Skills
  Product strategy, SQL, analytics, experimentation, stakeholder management, roadmap planning

  Education
  BSc Computer Science, 2017
  `

  const jd = `
  Senior Product Manager
  Requirements: product strategy, analytics, SQL, experimentation, stakeholder management, B2B SaaS.
  `

  const result = scoreResumeDeterministically({ resumeContent: resume, jobDescription: jd })

  assert.equal(result.analysisMode, "resume-with-jd")
  assert.ok(result.overallScore >= 70)
  assert.ok(result.evidence.requiredSectionsPresent.includes("Professional Summary"))
  assert.ok((result.keywordAnalysis?.coverageBySection.professionalSummary.length || 0) > 0)
})
