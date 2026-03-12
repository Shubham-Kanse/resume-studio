import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAtsOptimizationVerification,
  buildRepairVerificationSummary,
  sanitizePlainTextLatex,
} from "@/lib/latex-generation"
import { latexToPlainText } from "@/lib/latex-text"

test("sanitizePlainTextLatex does not mutate full LaTeX documents", () => {
  const latex = String.raw`\documentclass{article}
\usepackage{hyperref}
\begin{document}
\begin{tabular}{lr}
R&D & 75% \\
\end{tabular}
\href{mailto:first_last@example.com}{\texttt{first_last@example.com}}
\end{document}`

  assert.equal(sanitizePlainTextLatex(latex), latex)
})

test("sanitizePlainTextLatex escapes plain text fragments conservatively", () => {
  const latex = "Built R&D workflows with 75% faster runs and first_last IDs."

  assert.equal(
    sanitizePlainTextLatex(latex),
    "Built R\\&D workflows with 75\\% faster runs and first\\_last IDs."
  )
})

test("latexToPlainText keeps ATS-relevant resume content from LaTeX", () => {
  const latex = String.raw`\documentclass{article}
\begin{document}
\section{PROFESSIONAL SUMMARY}
Senior Product Manager with \textbf{8 years} in B2B SaaS, analytics, and SQL.
\section{SKILLS}
SQL, analytics, experimentation, stakeholder management
\section{EXPERIENCE}
\resumeSubheading{Acme}{Jan 2020 -- Present}{Product Manager}{Dublin, Ireland}
\resumeItem{Led experimentation roadmap and improved activation by 18\%.}
\end{document}`

  const text = latexToPlainText(latex)

  assert.match(text, /PROFESSIONAL SUMMARY/)
  assert.match(
    text,
    /Senior Product Manager with 8 years in B2B SaaS, analytics, and SQL\./
  )
  assert.match(
    text,
    /Led experimentation roadmap and improved activation by 18%\./
  )
})

test("buildAtsOptimizationVerification flags weak alignment on generated LaTeX", () => {
  const latex = String.raw`\documentclass{article}
\begin{document}
\section{PROFESSIONAL SUMMARY}
Generalist professional with experience across business functions.
\section{EXPERIENCE}
\resumeSubheading{Acme}{Jan 2020 -- Present}{Analyst}{Dublin, Ireland}
\resumeItem{Supported projects and collaborated with teams.}
\end{document}`

  const jd = `
  Senior Product Manager
  Requirements: SQL, analytics, experimentation, stakeholder management, roadmap planning, B2B SaaS.
  `

  const result = buildAtsOptimizationVerification(latex, jd)

  assert.equal(result.pass, false)
  assert.ok(result.issues.some((issue) => issue.type === "keyword_alignment"))
})

test("buildRepairVerificationSummary prioritizes ATS failures over successful compile summaries", () => {
  const summary = buildRepairVerificationSummary({
    repairedPass: false,
    repairedValidation: {
      pass: true,
      summary: "Local LaTeX validation passed.",
      issues: [],
    },
    repairedCompile: {
      pass: true,
      summary: "pdflatex compilation passed.",
      logExcerpt: null,
      issues: [],
    },
    repairedAts: {
      pass: false,
      summary:
        "Deterministic ATS check: overall 61/100, parseability 92/100, keyword match 54/100.",
      issues: [],
      scores: {
        overall: 61,
        parseability: 92,
        keywordMatch: 54,
      },
      missingCriticalTerms: ["SQL", "analytics"],
    },
  })

  assert.equal(
    summary,
    "Deterministic ATS check: overall 61/100, parseability 92/100, keyword match 54/100."
  )
})
