import { createRequire } from "node:module"
import { performance } from "node:perf_hooks"

import {
  buildNaturalCorpusDocuments,
  rankTermsByTfIdf,
  tokenizeNaturalText,
} from "@/lib/ats-natural-language"

const require = createRequire(import.meta.url)

type TfIdfLike = {
  addDocument: (document: string) => void
  tfidf: (term: string, index: number) => number
}

type TfIdfCtor = new () => TfIdfLike

const tfidfModule = require("natural/lib/natural/tfidf/tfidf") as
  | { TfIdf?: TfIdfCtor; default?: TfIdfCtor }
  | TfIdfCtor

const LegacyTfIdfCtor =
  typeof tfidfModule === "function"
    ? tfidfModule
    : tfidfModule.TfIdf || tfidfModule.default

if (!LegacyTfIdfCtor) {
  throw new Error("Failed to initialize legacy natural TfIdf constructor")
}

const SafeLegacyTfIdfCtor = LegacyTfIdfCtor

type BenchmarkCase = {
  name: string
  jobDescription: string
  resumeContent: string
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function legacyRankTerms(
  document: string,
  options?: {
    limit?: number
    minLength?: number
    stopwords?: Set<string>
  }
) {
  const tfidf = new SafeLegacyTfIdfCtor()
  tfidf.addDocument(document)

  const tokens = unique(
    tokenizeNaturalText(document, {
      minLength: options?.minLength ?? 3,
      stopwords: options?.stopwords,
      excludeStopwords: true,
    })
  )

  return tokens
    .map((token) => ({
      token,
      score: tfidf.tfidf(token, 0),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.token.localeCompare(right.token)
    )
    .slice(0, options?.limit ?? 20)
}

const benchmarkCases: BenchmarkCase[] = [
  {
    name: "Product Manager",
    jobDescription: `
      Senior Product Manager
      Requirements: product strategy, analytics, SQL, experimentation, stakeholder management, B2B SaaS.
      Own roadmap prioritization, partner cross-functionally, and improve activation and retention.
    `,
    resumeContent: `
      Senior product manager with 8 years leading B2B SaaS platforms, analytics, SQL reporting, experimentation, and stakeholder alignment.
      Led roadmap execution and activation improvements across enterprise workflows.
    `,
  },
  {
    name: "Backend Engineer",
    jobDescription: `
      Staff Backend Engineer
      Requirements: Go, Kubernetes, distributed systems, PostgreSQL, mentoring, system design.
      Build platform services, improve reliability, and mentor engineers.
    `,
    resumeContent: `
      Software engineer with TypeScript, React, Node.js, SQL, AWS, and reporting pipeline experience.
      Built workflow automation tools and dashboard infrastructure for internal users.
    `,
  },
  {
    name: "Platform Engineer",
    jobDescription: `
      Senior Platform Engineer
      Requirements: Kubernetes, distributed systems, mentor engineers, system design, platform engineering.
      Improve release automation and platform reliability.
    `,
    resumeContent: `
      Platform engineer with experience designing distributed systems and mentoring teams.
      Built Kubernetes deployment workflows and led system design reviews for platform services.
    `,
  },
]

for (const benchmarkCase of benchmarkCases) {
  const corpus = [
    ...buildNaturalCorpusDocuments(benchmarkCase.jobDescription),
    ...buildNaturalCorpusDocuments(benchmarkCase.resumeContent),
  ]

  const legacyStart = performance.now()
  const legacy = legacyRankTerms(benchmarkCase.jobDescription, {
    limit: 12,
  })
  const legacyDuration = performance.now() - legacyStart

  const nextStart = performance.now()
  const next = rankTermsByTfIdf(benchmarkCase.jobDescription, {
    limit: 12,
    corpusDocuments: corpus,
  })
  const nextDuration = performance.now() - nextStart

  console.log(`\n# ${benchmarkCase.name}`)
  console.log(
    JSON.stringify(
      {
        legacyDurationMs: Number(legacyDuration.toFixed(2)),
        nextDurationMs: Number(nextDuration.toFixed(2)),
        legacyTopTerms: legacy.map((item) => item.token),
        nextTopTerms: next.map((item) => item.token),
      },
      null,
      2
    )
  )
}
