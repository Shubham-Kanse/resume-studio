import assert from "node:assert/strict"
import test from "node:test"

import { getActionVerbMetrics } from "../../lib/ats-deterministic-metrics"
import {
  filterUnsupportedFeedback,
  resumeHasFutureDate,
} from "../../lib/ats-feedback"
import { buildATSNLPAnalysis } from "../../lib/ats-nlp-analysis"
import { scoreResumeDeterministically } from "../../lib/local-ats-scorer"

test("future-date detection uses the actual current year boundary", () => {
  assert.equal(
    resumeHasFutureDate(
      "Senior Engineer, Jan 2027 - Present",
      new Date("2026-03-09T00:00:00Z")
    ),
    true
  )
  assert.equal(
    resumeHasFutureDate(
      "Senior Engineer, Jan 2026 - Present",
      new Date("2026-03-09T00:00:00Z")
    ),
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

  const result = scoreResumeDeterministically({
    resumeContent: resume,
    jobDescription: jd,
  })

  assert.equal(result.analysisMode, "resume-only")
  assert.equal(result.overallScore, result.resumeQualityScore)
  assert.ok((result.targetRoleScore ?? 0) >= 70)
  assert.ok(
    result.evidence.requiredSectionsPresent.includes("Professional Summary")
  )
  assert.ok(
    (result.keywordAnalysis?.coverageBySection.professionalSummary.length ||
      0) > 0
  )
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

  assert.ok(
    result.evidence.requiredSectionsPresent.includes("Professional Summary")
  )
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

  const result = scoreResumeDeterministically({
    resumeContent: resume,
    jobDescription: jd,
  })

  assert.ok(
    (result.keywordAnalysis?.matchedByCategory.required || []).includes(
      "stakeholder management"
    )
  )
  assert.ok(
    (result.keywordAnalysis?.matchedByCategory.required || []).includes(
      "a/b testing"
    )
  )
})

test("keyword matching uses stemming, n-grams, and fuzzy similarity for JD alignment", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin | linkedin.com/in/janedoe

  Summary
  Platform engineer with experience designing distributed systems and mentoring teams.

  Experience
  Senior Platform Engineer | Acme | Jan 2020 - Present
  - Built Kubernetes-based deployment workflows for multi-service infrastructure.
  - Led distributed system design reviews and mentored backend engineers.

  Skills
  Kubernetes, platform engineering, system design, mentoring

  Education
  BSc Computer Science, 2018
  `

  const jd = `
  Senior Platform Engineer
  Requirements: Kubernets, distributed systems, mentor engineers, system design.
  `

  const result = scoreResumeDeterministically({
    resumeContent: resume,
    jobDescription: jd,
  })

  assert.ok(
    (result.keywordAnalysis?.matchedByCategory.required || []).includes(
      "kubernetes"
    )
  )
  assert.ok(
    (result.keywordAnalysis?.matchedByCategory.required || []).includes(
      "distributed systems"
    )
  )
  assert.ok(
    (result.keywordAnalysis?.matchedByCategory.required || []).includes(
      "system design"
    )
  )
  assert.ok((result.keywordAnalysis?.semanticMatchPercentage || 0) >= 50)
})

test("action verb scoring treats common outcome-oriented lead verbs as strong", () => {
  const resume = `
  Experience
  Senior Engineer | Acme | Jan 2020 - Present
  - Refactored synchronous services into event-driven flows and reduced latency by 40%.
  - Engineered deployment automation that cut release time from 2 hours to 20 minutes.
  - Built internal APIs powering three product teams.
  - Delivered CI-ready features for regulated production releases.
  - Simulated secure transaction workflows across partner systems.
  `

  const metrics = getActionVerbMetrics(resume)

  assert.equal(metrics.totalBullets, 5)
  assert.equal(metrics.strongLeadCount, 5)
  assert.equal(metrics.weakLeadCount, 0)
  assert.equal(metrics.score, 100)
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
    result.atsCompatibility.issues.some((issue) =>
      issue.includes("LaTeX layout commands suggest tables, columns")
    )
  )
})

test("resume quality category scores stay stable when a JD is added", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin, Ireland | linkedin.com/in/janedoe

  Professional Summary
  Software engineer with 6 years building SaaS products using TypeScript, React, Node.js, SQL, and AWS.

  Work Experience
  Senior Software Engineer | Acme | Jan 2021 - Present
  - Built workflow automation tools in React and Node.js, reducing support time by 24%.
  - Improved reporting pipelines with SQL and AWS, cutting dashboard latency by 38%.

  Skills
  Languages: TypeScript, JavaScript, SQL
  Frameworks: React, Next.js, Node.js
  Cloud: AWS, Docker

  Education
  BSc Computer Science, University College Dublin, 2019
  `

  const jd = `
  Staff Backend Engineer
  Requirements: Go, Kubernetes, distributed systems, PostgreSQL, mentoring, system design.
  `

  const resumeOnly = scoreResumeDeterministically({ resumeContent: resume })
  const withJD = scoreResumeDeterministically({
    resumeContent: resume,
    jobDescription: jd,
  })

  assert.equal(
    withJD.categoryScores.professionalSummary.score,
    resumeOnly.categoryScores.professionalSummary.score
  )
  assert.equal(
    withJD.categoryScores.skills.score,
    resumeOnly.categoryScores.skills.score
  )
  assert.equal(
    withJD.categoryScores.contentQuality.score,
    resumeOnly.categoryScores.contentQuality.score
  )
  assert.equal(
    withJD.categoryScores.formatting.score,
    resumeOnly.categoryScores.formatting.score
  )
  assert.equal(
    withJD.categoryScores.structure?.score,
    resumeOnly.categoryScores.structure?.score
  )
  assert.equal(withJD.resumeQualityScore, resumeOnly.resumeQualityScore)
  assert.equal(withJD.overallScore, resumeOnly.overallScore)
  assert.deepEqual(withJD.evidence.missingOptionalSections, [])
  assert.deepEqual(
    withJD.keyFindings.strengths,
    resumeOnly.keyFindings.strengths
  )
  assert.deepEqual(
    withJD.keyFindings.weaknesses,
    resumeOnly.keyFindings.weaknesses
  )
  assert.deepEqual(
    withJD.sectionReviews.map((section) => ({
      id: section.id,
      score: section.score,
      status: section.status,
    })),
    resumeOnly.sectionReviews.map((section) => ({
      id: section.id,
      score: section.score,
      status: section.status,
    }))
  )
  assert.ok(withJD.targetRoleScore !== null)
})

test("ATS NLP analysis still returns resume-only panels when job-match analysis fails", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin, Ireland

  Work Experience
  Senior Software Engineer | Acme | Jan 2021 - Present
  - Developed and deployed Java/Spring Boot microservices handling 5M+ daily financial transactions with 98% uptime using distributed messaging and OAuth2-secured interfaces.
  - Improved reporting pipelines with SQL and AWS, cutting dashboard latency by 38%.
  `

  const jd = `
  Senior Backend Engineer
  Requirements: Java, Spring Boot, distributed systems, OAuth2, messaging, microservices.
  `

  const result = buildATSNLPAnalysis({
    resumeContent: resume,
    jobDescription: jd,
  })

  assert.ok(result.quantifyingImpact.totalBullets > 0)
  assert.ok(result.quantifyingImpact.bulletAnalyses.length > 0)
  assert.equal(result.jobMatch.hasJobDescription, true)
})

test("quantifying impact uses semantic JD term matching for bullet evaluation", () => {
  const resume = `
  Jane Doe
  jane@example.com | Dublin, Ireland

  Work Experience
  Senior Platform Engineer | Acme | Jan 2021 - Present
  - Built Kubernetes deployment workflows for distributed systems, reducing release time by 37%.
  - Mentored backend engineers through system design reviews across platform services.
  `

  const jd = `
  Senior Platform Engineer
  Requirements: Kubernets, distributed systems, mentor engineers, system design.
  `

  const result = buildATSNLPAnalysis({
    resumeContent: resume,
    jobDescription: jd,
  })

  const topBullet = result.quantifyingImpact.bulletAnalyses[0]

  assert.ok(topBullet)
  assert.ok(topBullet.signals.keywordMatches.length > 0)
  assert.ok(topBullet.score >= 70)
})
