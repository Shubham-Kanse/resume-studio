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

test("section parsing recognizes non-exact ATS-safe heading variants", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin, Ireland | linkedin.com/in/janedoe

  Career Highlights:
  Product leader with 7 years scaling B2B SaaS and analytics workflows.

  Professional Background
  Product Manager | Acme | Jan 2021 - Present
  - Led roadmap planning across engineering, sales, and customer success.
  - Increased activation by 14% through onboarding and experimentation.

  Tools & Technologies
  SQL, Amplitude, Looker, experimentation, stakeholder management, roadmap planning

  Academic Background
  BSc Computer Science, 2018
  `

  const result = scoreResumeDeterministically({ resumeContent: resume })

  assert.ok(result.evidence.requiredSectionsPresent.includes("Professional Summary"))
  assert.ok(result.evidence.requiredSectionsPresent.includes("Work Experience"))
  assert.ok(result.evidence.requiredSectionsPresent.includes("Skills"))
  assert.ok(result.evidence.requiredSectionsPresent.includes("Education"))
})

test("keyword matching recognizes semantic line-level evidence instead of exact phrase only", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin | linkedin.com/in/janedoe

  Summary
  Senior product manager with 8 years in B2B SaaS, analytics, and executive communication.

  Experience
  Product Manager | Acme | Jan 2020 - Present
  - Managed stakeholders across engineering, design, and go-to-market teams.
  - Owned experimentation roadmap and lifecycle onboarding improvements.
  - Improved retention by 9% and activation by 18%.

  Skills
  SQL, analytics, product strategy, lifecycle onboarding, roadmap planning

  Education
  BSc Computer Science, 2017
  `

  const jd = `
  Senior Product Manager
  Requirements: stakeholder management, experimentation, SQL, analytics, product strategy.
  `

  const result = scoreResumeDeterministically({ resumeContent: resume, jobDescription: jd })

  assert.ok((result.keywordAnalysis?.matchedByCategory.required || []).includes("stakeholder management"))
  assert.ok((result.keywordAnalysis?.matchedByCategory.required || []).includes("a/b testing"))
})

test("parseability score drops when layout-risk markup suggests ATS extraction problems", () => {
  const resume = String.raw`
  Jane Doe
  jane@example.com | Dublin | https://portfolio.example.com

  \begin{tabular}{ll}
  Summary & Senior engineer building SaaS products \\
  Experience & Led platform delivery \\
  \end{tabular}

  Experience
  Engineer | Acme | Jan 2020 - Present
  - Built internal tools that reduced support time by 20%.

  Skills
  React | TypeScript | AWS | Docker

  Education
  BSc Computer Science, 2019
  `

  const result = scoreResumeDeterministically({ resumeContent: resume })

  assert.ok(result.atsCompatibility.parseability < 90)
  assert.ok(
    result.atsCompatibility.issues.some((issue) => issue.includes("LaTeX layout commands suggest tables, columns"))
  )
})
