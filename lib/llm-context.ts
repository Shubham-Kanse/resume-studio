import { readFileSync } from "fs"
import path from "path"

const LLM_UTILS_DIR = path.join(process.cwd(), "lib", "LLM_utils")

const LLM_UTIL_FILES = [
  "Claude-Master-Instructions.md",
  "Claude-Project-System-Instructions.md",
  "Claude-ATS-Cheatsheet-Instructions.md",
  "Action-Verbs-claude.txt",
  "LatexRules.txt",
] as const

type LlmUtilFile = (typeof LLM_UTIL_FILES)[number]

interface KnowledgeChunk {
  fileName: LlmUtilFile
  heading: string
  content: string
  priority: number
  alwaysInclude?: boolean
}

function loadInstructionFile(fileName: LlmUtilFile): string {
  return readFileSync(path.join(LLM_UTILS_DIR, fileName), "utf8").trim()
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function tokenize(value: string): string[] {
  const matches = value.toLowerCase().match(/[a-z0-9][a-z0-9.+#/-]{1,}/g) || []
  return matches.filter((token) => token.length > 2)
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function inferPriority(
  fileName: LlmUtilFile,
  heading: string,
  content: string
): number {
  const text = `${heading}\n${content}`.toLowerCase()

  if (fileName === "LatexRules.txt") {
    if (text.includes("latex preamble")) return 300
    if (text.includes("document body template")) return 290
    if (text.includes("pre-output checklist")) return 280
    if (text.includes("behavior rules")) return 270
    if (text.includes("formatting reference")) return 260
    return 220
  }

  if (fileName === "Action-Verbs-claude.txt") {
    return 240
  }

  if (text.includes("ethical standards")) return 225
  if (text.includes("quality assurance")) return 220
  if (text.includes("ats optimization")) return 215
  if (text.includes("keyword")) return 210
  if (text.includes("professional summary")) return 205
  if (text.includes("experience")) return 205
  if (text.includes("technical skills")) return 200

  return 160
}

function splitIntoChunks(
  fileName: LlmUtilFile,
  content: string
): KnowledgeChunk[] {
  const normalized = normalizeWhitespace(content)
  const lines = normalized.split("\n")
  const chunks: KnowledgeChunk[] = []

  let currentHeading = "Overview"
  let buffer: string[] = []

  const flush = () => {
    const chunkContent = normalizeWhitespace(buffer.join("\n"))
    if (!chunkContent) return

    const chunk: KnowledgeChunk = {
      fileName,
      heading: currentHeading,
      content: chunkContent,
      priority: inferPriority(fileName, currentHeading, chunkContent),
    }

    const lowerHeading = currentHeading.toLowerCase()
    if (
      fileName === "LatexRules.txt" &&
      (lowerHeading.includes("behavior rules") ||
        lowerHeading.includes("latex preamble") ||
        lowerHeading.includes("document body template") ||
        lowerHeading.includes("pre-output checklist"))
    ) {
      chunk.alwaysInclude = true
    }

    if (fileName === "Action-Verbs-claude.txt") {
      chunk.alwaysInclude = true
    }

    chunks.push(chunk)
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flush()
      currentHeading = (headingMatch[2] || "").trim()
      buffer = []
      continue
    }
    buffer.push(line)
  }

  flush()
  return chunks
}

const KNOWLEDGE_BASE = LLM_UTIL_FILES.flatMap((fileName) =>
  splitIntoChunks(fileName, loadInstructionFile(fileName))
)

const MASTER_SYSTEM_INSTRUCTIONS = loadInstructionFile(
  "Claude-Master-Instructions.md"
)

const CORE_SYSTEM_PROMPT = `${MASTER_SYSTEM_INSTRUCTIONS}

---

## Runtime Enforcement

Treat the master instructions above as the primary system prompt for this application.

Additional runtime rules:
1. Output only raw LaTeX.
2. The response must start with \\documentclass and end with \\end{document}.
3. Never include markdown fences, commentary, reasoning, or any text outside the LaTeX document.
4. Never invent facts, metrics, dates, employers, education, certifications, links, or tools not supported by the candidate background.
5. If user data is incomplete, omit unsupported details instead of fabricating them.
6. Preserve LaTeX-specific formatting rules even if generic ATS advice elsewhere suggests a different output format.
7. Use exact job-description keywords only when they are truthfully supported by the candidate background.
8. Prefer the stricter rule when retrieved knowledge excerpts overlap.
9. Produce a single-column, compilable resume suitable for pdflatex/Overleaf.
10. Treat retrieved knowledge excerpts as the attached reference documents for this task.
11. Do not simply restate or lightly format the uploaded resume; transform it into a tailored version targeted to the job description.
12. Reorder, rewrite, condense, and emphasize content based on job relevance while staying truthful to the source material.
13. Prefer stronger, more specific, ATS-aligned phrasing over the candidate's original wording when both are supported by the same facts.`

function buildQueryTerms(
  jd: string,
  resume: string,
  additionalInstructions?: string
): string[] {
  const baseTerms = [
    "latex",
    "resume",
    "ats",
    "technical skills",
    "professional summary",
    "experience",
    "projects",
    "education",
    "certifications",
    "action verbs",
    "keyword optimization",
  ]

  return unique([
    ...baseTerms,
    ...tokenize(jd),
    ...tokenize(resume),
    ...tokenize(additionalInstructions || ""),
  ])
}

function scoreChunk(chunk: KnowledgeChunk, queryTerms: string[]): number {
  const haystack = `${chunk.heading}\n${chunk.content}`.toLowerCase()
  let score = chunk.priority

  for (const term of queryTerms) {
    if (!term) continue
    if (haystack.includes(term)) score += term.length > 6 ? 8 : 4
    if (chunk.heading.toLowerCase().includes(term)) score += 6
  }

  return score
}

function trimChunkContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content
  return `${content.slice(0, maxChars).trim()}\n...`
}

function renderKnowledgeChunks(
  chunks: KnowledgeChunk[],
  maxCharsByFile?: Partial<Record<LlmUtilFile, number>>
): string {
  return chunks
    .map((chunk) => {
      const maxChars = maxCharsByFile?.[chunk.fileName] ?? 2800
      return [
        `FILE: ${chunk.fileName}`,
        `SECTION: ${chunk.heading}`,
        trimChunkContent(chunk.content, maxChars),
      ].join("\n")
    })
    .join("\n\n---\n\n")
}

export function buildSystemPrompt(): string {
  return CORE_SYSTEM_PROMPT
}

export function buildKnowledgePrompt(
  jd: string,
  resume: string,
  additionalInstructions?: string
): string {
  const queryTerms = buildQueryTerms(jd, resume, additionalInstructions)
  const mandatoryChunks = KNOWLEDGE_BASE.filter((chunk) => chunk.alwaysInclude)
  const optionalChunks = KNOWLEDGE_BASE.filter((chunk) => !chunk.alwaysInclude)
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTerms) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ chunk }) => chunk)

  const selected = unique([...mandatoryChunks, ...optionalChunks])

  const rendered = renderKnowledgeChunks(selected, {
    "LatexRules.txt": 9000,
  })

  return `Attached knowledge for this request.

Use these excerpts exactly like retrieved knowledge-base documents in a Custom GPT. These excerpts come from files in lib/LLM_utils and are the relevant reference material for this generation request.

${rendered}`
}

export function buildUserPrompt(
  jd: string,
  resume: string,
  additionalInstructions?: string,
  tailoringBlueprint?: string
): string {
  let prompt = `Generate an ATS-optimized LaTeX resume from the provided job description and candidate background.

Runtime contract:
- Use only supported facts from the candidate background.
- Materially tailor the resume to the job description.
- Use the retrieved knowledge excerpts as the project knowledge base.
- Return only compilable LaTeX.

Tailoring instructions:
- Do not produce a formatted copy of the uploaded resume.
- Rewrite the summary, skills, and experience bullets to align with the job description while remaining truthful.
- Reorder bullets and sections so the most relevant evidence appears first.
- Mirror exact job-description terminology for skills, tools, and responsibilities when supported by the candidate background.
- Compress, combine, or omit low-relevance content to make space for high-relevance evidence.
- Strengthen weak bullets by improving specificity, action verbs, technical depth, and measurable outcomes only when those details are supported by the input.
- If a required job-description keyword is unsupported by the candidate background, do not add it.

Required internal workflow:
1. Identify the most important requirements and keywords from the job description.
2. Map those requirements to the strongest matching facts in the candidate background.
3. Build a tailored professional summary focused on the target role.
4. Rebuild the skills section around the technologies and competencies most relevant to the job description.
5. Rewrite experience bullets to prioritize directly relevant achievements, technologies, scope, and impact.
6. Deliver a stronger tailored resume, not a transcription.

## JOB DESCRIPTION
${jd}

## CANDIDATE BACKGROUND
${resume}`

  if (tailoringBlueprint?.trim()) {
    prompt += `

## TAILORING BLUEPRINT
${tailoringBlueprint.trim()}

Use this blueprint as the execution plan for section ordering, keyword coverage, and emphasis decisions.`
  }

  if (additionalInstructions?.trim()) {
    prompt += `

## ADDITIONAL INSTRUCTIONS
${additionalInstructions.trim()}`
  }

  prompt += `

## FINAL OUTPUT CONTRACT
1. Start with \\documentclass[letterpaper,11pt]{article}
2. End with \\end{document}
3. Do not wrap the response in code fences
4. Do not include explanations before or after the LaTeX
5. Omit unsupported claims instead of inventing them`

  return prompt
}

export function buildTailoringPlanPrompt(
  jd: string,
  resume: string,
  additionalInstructions?: string
): string {
  let prompt = `Analyze the job description and candidate background, then produce a structured tailoring plan for a high-performing ATS-safe resume.

Return valid JSON only.

Planning goals:
- prioritize the job's real screening requirements
- map only supported evidence from the candidate background
- identify the strongest keywords to surface in summary, skills, and recent experience
- avoid unsupported tools, metrics, certifications, or responsibilities

JSON schema:
{
  "targetRole": string,
  "targetSeniority": string | null,
  "priorityKeywords": string[],
  "supportedKeywords": string[],
  "unsupportedKeywords": string[],
  "summaryStrategy": string[],
  "skillsBuckets": [
    {
      "category": string,
      "keywords": string[]
    }
  ],
  "experiencePriorities": [
    {
      "focusArea": string,
      "evidence": string[],
      "keywords": string[]
    }
  ],
  "atsGuardrails": string[],
  "deEmphasize": string[]
}

Constraints:
- 8 to 15 priorityKeywords
- 0 to 8 unsupportedKeywords
- 3 to 6 summaryStrategy items
- 3 to 7 skillsBuckets
- 2 to 6 experiencePriorities
- 3 to 6 atsGuardrails
- 0 to 5 deEmphasize items
- Keep every item concise and specific.

## JOB DESCRIPTION
${jd}

## CANDIDATE BACKGROUND
${resume}`

  if (additionalInstructions?.trim()) {
    prompt += `

## ADDITIONAL INSTRUCTIONS
${additionalInstructions.trim()}`
  }

  return prompt
}

const ATS_SYSTEM_PROMPT = `You are the ATS CV Scoring and Resume Review Engine for this application.

You are modeled after enterprise ATS and resume-audit behavior seen in systems such as Workday, Greenhouse, Lever, iCIMS, and CareerSet-style review products, but you are not any of those products. Your job is to evaluate the submitted resume with rule-based ATS logic plus evidence-based contextual analysis grounded in the project knowledge base from lib/LLM_utils.

Your operating style:
- impartial
- strict
- evidence-based
- non-flattering
- specific
- ATS-first

Primary objective:
- produce a consistent, low-hallucination ATS review
- score only what is visible in the provided resume and job description
- give actionable fixes section by section

Evaluation modes:
1. resume-with-jd
   - First analyze the job description.
   - Extract role title, hard requirements, preferred qualifications, tools, technologies, certifications, years of experience requirements, industry terminology, and company-culture language.
   - Then score the resume against those requirements.
2. resume-only
   - Score only against ATS best practices and general resume quality standards from the ATS cheatsheet.
   - Do not pretend a role-specific match exists when no job description is present.

Scoring framework:
- Use a 100-point composite mindset based on these weighted dimensions:
  1. Keyword and skills match: 30
  2. ATS formatting and parsability: 20
  3. Quantification and achievement quality: 20
  4. Experience and qualification alignment: 15
  5. Professional summary quality: 7
  6. Content structure and readability: 5
  7. Role and culture fit signals: 3
- Use this weighted rubric internally even though the API response uses the application's JSON schema.
- Map the rubric into the JSON fields consistently:
  - keywordMatch = keyword and skills match
  - formatting = ATS formatting and parsability
  - contentQuality = quantification, achievement quality, and experience evidence quality
  - professionalSummary = summary quality
  - skills = skills clarity, categorization, granularity, and relevance
  - structure = content structure and readability in resume-only mode
- In resume-with-jd mode, overallScore should primarily reflect target-role fitness while remaining anchored in ATS quality.
- In resume-only mode, overallScore should reflect standalone ATS strength.

Job-description-first rules:
1. Always analyze the job description before evaluating the resume when a JD is provided.
2. Extract and weight:
   - job title keywords at 5x
   - required skills at 4x
   - years-of-experience terms at 3x
   - preferred qualifications at 2x
   - culture/value terms at 1x
3. Evaluate keyword placement quality using this priority:
   - professional summary
   - skills section
   - recent experience bullets
   - education/certifications/projects

ATS and evidence rules:
1. Output JSON only.
2. Do not output markdown fences, commentary, chain-of-thought, or extra text.
3. Use the retrieved knowledge excerpts from lib/LLM_utils as the governing rubric, especially the ATS cheatsheet.
4. Deterministic ATS scores will be provided by the application. Treat those scores, categories, and evidence as fixed inputs. Do not recalculate or override them.
5. Your role is to explain the deterministic findings, prioritize fixes, and improve clarity without changing the numeric results.
6. Never invent facts, dates, employers, achievements, technologies, certifications, metrics, or degrees.
7. Never assume a vague bullet implies strong impact.
8. Do not raise speculative recruiter, verification, timeline, or fraud concerns unless conflicting evidence is explicitly present in the resume text.
9. If evidence is missing, say it is missing. Do not fill gaps with assumptions.
10. Every issue, weakness, warning, recommendation, and section review must be traceable to visible evidence in the resume, job description, or deterministic evidence payload.
11. Recommendations must be concrete, implementable, and tied to the exact section that needs revision.
12. Be strict but fair. Scores in the 80s and 90s are reserved for genuinely strong, highly optimized resumes.
13. Never infer an education problem from an employment date alone. A degree date after a job end date is not automatically an issue.
14. Never require GPA, academic honors, current enrollment status, or expected graduation unless:
   - the job description explicitly asks for them, or
   - the resume explicitly presents incomplete or contradictory education information.
15. A completed degree date in 2025 is not a future date relative to March 8, 2026.

Formatting and parsing rules:
- Score ATS parsability before human readability.
- Check for ATS-safe section headers, consistent dates, single-column structure, parse-safe contact details, plain-text survivability, and forbidden layout elements as defined by the ATS cheatsheet.
- If the input is plain extracted text and layout evidence is not available, do not hallucinate visual violations. Only flag formatting or parseability issues that are inferable from the extracted text.

Section-review rules:
- Give section-by-section advice using ATS cheatsheet standards for:
  - professional summary
  - work experience
  - skills
  - education
  - keywords
  - formatting
- Each section review must explain:
  - current quality
  - what is working
  - what is missing or weak
  - exactly how to improve it

Consistency rules:
- Prefer conservative scoring over optimistic scoring when evidence is thin.
- Use the same standard every time for similar evidence.
- Avoid generic praise.
- Avoid generic criticism.
- Do not contradict the ATS cheatsheet.
- When in doubt, choose the interpretation most defensible from the source text.`

function buildATSQueryTerms(jd: string, resume: string): string[] {
  return unique([
    ...buildQueryTerms(jd, resume),
    "ats review",
    "resume review",
    "keyword match",
    "parseability",
    "ats compatibility",
    "professional summary",
    "skills section",
    "content quality",
    "recommendations",
    "strengths",
    "weaknesses",
    "tailored review",
  ])
}

function isATSEssentialChunk(chunk: KnowledgeChunk): boolean {
  const heading = chunk.heading.toLowerCase()

  if (chunk.fileName === "Claude-ATS-Cheatsheet-Instructions.md") {
    return (
      heading.includes("purpose & success targets") ||
      heading.includes("keyword strategy") ||
      heading.includes("formatting requirements") ||
      heading.includes("content requirements") ||
      heading.includes("ats simulation process") ||
      heading.includes("ats technical validation") ||
      heading.includes("human readability optimization") ||
      heading.includes("quality assurance") ||
      heading.includes("advanced optimization")
    )
  }

  if (chunk.fileName === "Claude-Project-System-Instructions.md") {
    return (
      heading.includes("ats optimization") ||
      heading.includes("resume architecture") ||
      heading.includes("technical skills matrix") ||
      heading.includes("experience section") ||
      heading.includes("ethical standards")
    )
  }

  if (chunk.fileName === "Action-Verbs-claude.txt") {
    return heading.includes("strong accomplishment-driven verbs")
  }

  return false
}

export function buildATSKnowledgePrompt(jd: string, resume: string): string {
  const queryTerms = buildATSQueryTerms(jd, resume)
  const essentialChunks = KNOWLEDGE_BASE.filter(isATSEssentialChunk)
  const optionalChunks = KNOWLEDGE_BASE.filter(
    (chunk) =>
      !essentialChunks.includes(chunk) && chunk.fileName !== "LatexRules.txt"
  )
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTerms) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ chunk }) => chunk)

  const selected = unique([...essentialChunks, ...optionalChunks])
  const rendered = renderKnowledgeChunks(selected, {
    "Claude-ATS-Cheatsheet-Instructions.md": 3200,
    "Claude-Project-System-Instructions.md": 2600,
    "Action-Verbs-claude.txt": 2200,
  })

  return `Attached ATS review knowledge for this request.

Use these excerpts as the ATS review knowledge base. They are the project guidance for scoring, issue detection, keyword analysis, and tailored resume review.

${rendered}`
}

export function buildATSSystemPrompt(): string {
  return ATS_SYSTEM_PROMPT
}

export function buildATSUserPrompt(
  jd: string,
  resume: string,
  deterministicAnalysisJson: string
): string {
  const hasJD = jd.trim().length > 0

  return `Generate the narrative ATS review for the candidate's resume.

Task mode:
- ${hasJD ? "resume-with-jd" : "resume-only"}

Instructions:
- Do not recalculate or change any numeric score.
- Use the deterministic analysis payload below as the fixed source of truth for:
  - overall scores
  - category scores
  - parseability
  - keyword coverage
  - detected structural evidence
- Your job is to convert that static analysis into a high-quality ATS review narrative.
- Do not use generic canned feedback.
- Make explanations specific to this resume and ${hasJD ? "job description" : "candidate background"}.
- Highlight both strong alignment and material gaps.
- Recommendations must tell the user how to improve the resume for this target role.
- Mimic the style of an evidence-based ATS audit such as CareerSet or Workday-style screening, but do not claim to be those products.
- Prefer concrete ATS and JD-alignment issues over speculative assumptions.
- Use the exact current date of March 8, 2026 when reasoning about whether a date is in the future.
- Do not flag future dates, timeline discrepancies, or verification risks unless the conflicting date evidence is explicitly present in the resume text or deterministic evidence payload.
- Example: August 2025 is in the past relative to March 8, 2026 and must not be flagged as a future date.
- Do not compare an education date to an employment end date and call it a discrepancy unless the resume explicitly claims mutually exclusive statuses.
- Do not flag internal or proprietary terms as ATS issues unless they are likely to block keyword matching and you can suggest a standard accompanying term.
- Treat hallucination prevention as mandatory:
  - no guessed dates
  - no guessed achievements
  - no guessed formatting violations that are not inferable from text
  - no unsupported claim that a requirement is met unless the resume text or deterministic evidence shows it
  - no GPA/honors/current-enrollment complaints unless the JD explicitly requires them or the resume explicitly references them
- Only flag tables, columns, colors, headers/footers, images, logos, or font issues when the extracted text or deterministic evidence provides direct support.
- If the deterministic scorer found no issue in a category, do not invent one just to fill space.

JSON output schema:
{
  "keyFindings": {
    "strengths": string[],
    "weaknesses": string[],
    "missingKeywords": string[] | null,
    "presentKeywords": string[] | null
  },
  "detailedIssues": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": string,
      "issue": string,
      "impact": string,
      "howToFix": string,
      "example": string
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "action": string,
      "benefit": string,
      "implementation": string
    }
  ],
  "sectionReviews": [
    {
      "id": "professionalSummary" | "workExperience" | "skills" | "education" | "keywords" | "formatting",
      "diagnosis": string,
      "whatWorks": string[],
      "gaps": string[],
      "actions": string[]
    }
  ]
}

Output constraints:
- Return valid JSON only.
- Provide 3-6 strengths, 3-6 weaknesses, 3-8 detailed issues, and 3-6 recommendations when evidence exists.
- Always return exactly 6 sectionReviews in this order:
  1. professionalSummary
  2. workExperience
  3. skills
  4. education
  5. keywords
  6. formatting
- Each section review must be specific, concise, and actionable:
  - diagnosis: 1-2 sentences explaining the current ATS result for that section
  - whatWorks: 1-3 evidence-based positives
  - gaps: 1-3 concrete weaknesses or missing elements
  - actions: 2-4 direct rewrite or formatting fixes
- Use the ATS cheatsheet as the grading rubric:
  - professionalSummary: summary formula, first-50-word keyword placement, role positioning, quantified value
  - workExperience: action-result bullet quality, quantification, technical specificity, dates, relevance
  - skills: section naming, categorization, granularity, exact tools/services/frameworks, JD relevance
  - education: clarity, date consistency, credential presentation, relevant coursework/certifications when present
  - keywords: primary/secondary keyword coverage, placement, density, missing critical terms, overuse
  - formatting: single-column parse safety, standard headers, date consistency, forbidden elements, readability
- Keep scoring calibrated:
  - 85+ only for genuinely strong, well-optimized resumes
  - 70-84 for solid resumes with noticeable gaps
  - 50-69 for mixed resumes with important ATS or relevance issues
  - below 50 for weak, vague, or materially misaligned resumes
- Keep issue and recommendation text concise but specific.

## DETERMINISTIC ATS ANALYSIS
${deterministicAnalysisJson}

## JOB DESCRIPTION
${hasJD ? jd : "No job description provided."}

## CANDIDATE BACKGROUND
${resume}`
}
