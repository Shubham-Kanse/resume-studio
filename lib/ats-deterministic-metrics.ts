import {
  ACTION_VERB_DICTIONARY,
  WEAK_ACTION_VERB_DICTIONARY,
} from "@/lib/action-verb-dictionary"
import { extractBullets, parseResumeSections } from "@/lib/ats-resume-parsing"

const COMMON_MISSPELLINGS: Record<string, string> = {
  seperate: "separate",
  recieve: "receive",
  acheived: "achieved",
  managment: "management",
  enviroment: "environment",
  responsibilites: "responsibilities",
  experiance: "experience",
  teh: "the",
}

const STANDARD_SECTION_HEADERS = [
  "summary",
  "professional summary",
  "experience",
  "work experience",
  "employment",
  "professional experience",
  "projects",
  "skills",
  "education",
  "certifications",
]

const SECTION_ALIASES: Record<string, string[]> = {
  professionalSummary: ["summary", "professional summary"],
  workExperience: [
    "experience",
    "work experience",
    "employment",
    "professional experience",
  ],
  skills: ["skills"],
  education: ["education"],
  certifications: ["certifications"],
  projects: ["projects"],
}

const REQUIRED_SECTION_KEYS = [
  "professionalSummary",
  "workExperience",
  "skills",
  "education",
] as const

const FILLER_MODIFIER_PHRASES = [
  "various",
  "several",
  "multiple",
  "etc",
  "and more",
]

const ATS_FILLER_PHRASES = Array.from(
  new Set(
    WEAK_ACTION_VERB_DICTIONARY.map((entry) => entry.weak.toLowerCase()).concat(
      ["responsible for", "tasked with", "duties included", "part of"]
    )
  )
).sort((left, right) => right.length - left.length)

const RESPONSIBILITY_ORIENTED_PHRASES = Array.from(
  new Set([
    "responsible for",
    "duties included",
    "tasked with",
    "participated in",
    "involved in",
    "helped with",
    "worked on",
    "was part of",
    "part of",
    "assisted with",
    "assisted",
    "supported",
  ])
).sort((left, right) => right.length - left.length)

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

type DateRef = {
  raw: string
  type: "month_year" | "numeric_month_year" | "year_only"
  sortValue: number
}

export type SpellIssue = {
  wrong: string
  correct: string
  count: number
}

export type DateOrderIssue = {
  section: string
  currentLine: string
  previousLine: string
}

export type ActiveVoiceIssue = {
  line: string
  reason: string
}

export type ConsistencyIssue = {
  category: "bullet-style" | "punctuation" | "dates" | "chronology"
  label: string
  detail: string
}

export type SectionIssue = {
  category: "missing-required" | "missing-optional" | "order"
  label: string
  detail: string
}

export type FillerWordIssue = {
  phrase: string
  line: string
  category: "weak-lead" | "weak-phrase" | "vague-modifier"
  reason: string
}

export type ActionVerbIssue = {
  phrase: string
  line: string
  category: "weak-lead" | "weak-phrase"
  reason: string
}

export type AccomplishmentIssue = {
  phrase: string
  line: string
  reason: string
}

export type LengthAssessment =
  | "optimal"
  | "good"
  | "slightly-short"
  | "slightly-long"
  | "too-short"
  | "too-long"

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9+-]/g, "")
}

function isLikelySentence(line: string) {
  const wordCount = line.split(/\s+/).filter(Boolean).length
  return /^[-*•]/.test(line) || wordCount >= 5 || /[.;:]$/.test(line)
}

function isLikelyBullet(line: string) {
  return /^[-*•]/.test(line)
}

function detectBulletMarker(line: string) {
  const marker = line.match(/^([-*•])/)
  return marker?.[1] ?? null
}

function normalizeBulletText(line: string) {
  return line.replace(/^[-*•]\s*/, "").trim()
}

function joinIssueParts(parts: string[]) {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0] || ""
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizeSectionHeader(line: string) {
  return line
    .trim()
    .toLowerCase()
    .replace(/[:\s]+$/g, "")
}

function extractDateRefs(line: string): DateRef[] {
  const matches = line.match(
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b|\b\d{1,2}\/\d{4}\b|\b\d{4}\b/gi
  )

  if (!matches) return []

  return matches
    .map((raw) => {
      if (/^\d{1,2}\/\d{4}$/i.test(raw)) {
        const [month, year] = raw.split("/")
        return {
          raw,
          type: "numeric_month_year" as const,
          sortValue: Number(year) * 100 + Number(month),
        }
      }

      if (/^\d{4}$/i.test(raw)) {
        return {
          raw,
          type: "year_only" as const,
          sortValue: Number(raw) * 100,
        }
      }

      const [monthToken = "", yearToken = "0"] = raw.toLowerCase().split(/\s+/)
      return {
        raw,
        type: "month_year" as const,
        sortValue: Number(yearToken) * 100 + (MONTH_INDEX[monthToken] ?? 0),
      }
    })
    .filter((entry) => Number.isFinite(entry.sortValue))
}

function formatSectionLabel(section: string) {
  if (section === "other") return "Other"
  return section
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function titleCaseWords(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function countWords(text: string) {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean).length
}

export function getSpellCheckMetrics(text: string) {
  const words = text.split(/\s+/).map(normalizeWord).filter(Boolean)
  const wordCounts = new Map<string, number>()

  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1)
  }

  const issues: SpellIssue[] = Object.entries(COMMON_MISSPELLINGS)
    .map(([wrong, correct]) => ({
      wrong,
      correct,
      count: wordCounts.get(wrong) ?? 0,
    }))
    .filter((issue) => issue.count > 0)
    .sort((left, right) => right.count - left.count)

  const totalMisspellingCount = issues.reduce(
    (sum, issue) => sum + issue.count,
    0
  )
  const score =
    totalMisspellingCount === 0
      ? 100
      : clampScore(100 - totalMisspellingCount * 18)

  return {
    issues,
    totalMisspellingCount,
    score,
  }
}

export function getDateOrderMetrics(text: string) {
  const lines = getLines(text)
  const entries: Array<{
    section: string
    line: string
    latestSortValue: number
    refs: DateRef[]
  }> = []
  let currentSection = "other"

  for (const line of lines) {
    const normalized = normalizeSectionHeader(line)

    if (STANDARD_SECTION_HEADERS.includes(normalized)) {
      currentSection = normalized
      continue
    }

    const refs = extractDateRefs(line)
    if (refs.length === 0) continue

    entries.push({
      section: currentSection,
      line,
      latestSortValue: Math.max(...refs.map((ref) => ref.sortValue)),
      refs,
    })
  }

  const formatTypes = Array.from(
    new Set(entries.flatMap((entry) => entry.refs.map((ref) => ref.type)))
  )

  const chronologyIssues: DateOrderIssue[] = []
  const groups = new Map<string, typeof entries>()

  for (const entry of entries) {
    const current = groups.get(entry.section) ?? []
    current.push(entry)
    groups.set(entry.section, current)
  }

  for (const [section, sectionEntries] of groups) {
    if (sectionEntries.length < 2) continue

    let previous = sectionEntries[0]
    if (!previous) continue

    for (const current of sectionEntries.slice(1)) {
      if (current.latestSortValue > previous.latestSortValue) {
        chronologyIssues.push({
          section: formatSectionLabel(section),
          currentLine: current.line,
          previousLine: previous.line,
        })
      }
      previous = current
    }
  }

  const formatPenalty = Math.max(0, formatTypes.length - 1) * 18
  const chronologyPenalty = chronologyIssues.length * 22
  const score =
    entries.length === 0
      ? 70
      : clampScore(100 - formatPenalty - chronologyPenalty)

  return {
    entries,
    formatTypes,
    chronologyIssues,
    score,
  }
}

export function getActiveVoiceMetrics(text: string) {
  const issues: ActiveVoiceIssue[] = []
  const seen = new Set<string>()
  const lines = getLines(text)

  for (const line of lines) {
    const normalized = normalizeSectionHeader(line)
    if (STANDARD_SECTION_HEADERS.includes(normalized)) continue
    if (!isLikelySentence(line)) continue

    const cleanLine = normalizeBulletText(line)
    const passivePatterns = [
      /\b(?:was|were|is|are|been|being|be)\s+\w+(?:ed|en)\b/i,
      /\b(?:was|were|is|are|been|being|be)\s+\w+ed\s+by\b/i,
      /\b(?:has|have|had)\s+been\s+\w+(?:ed|en)\b/i,
    ]

    for (const pattern of passivePatterns) {
      if (!pattern.test(cleanLine)) continue
      if (seen.has(cleanLine)) break

      issues.push({
        line: cleanLine,
        reason:
          "This line reads as passive because the result is described before the action you personally drove.",
      })
      seen.add(cleanLine)
      break
    }
  }

  return {
    issues,
    score: issues.length === 0 ? 100 : clampScore(100 - issues.length * 18),
  }
}

export function getConsistencyMetrics(text: string) {
  const lines = getLines(text)
  const bulletLines = lines.filter(isLikelyBullet)
  const sections = parseResumeSections(text)
  const extractedBullets = [
    ...extractBullets([
      ...(sections.get("experience") ?? []),
      ...(sections.get("work experience") ?? []),
      ...(sections.get("employment") ?? []),
      ...(sections.get("professional experience") ?? []),
    ]),
    ...extractBullets(sections.get("projects") ?? []),
  ]
  const issues: ConsistencyIssue[] = []

  const markerCounts = new Map<string, number>()
  for (const line of bulletLines) {
    const marker = detectBulletMarker(line)
    if (!marker) continue
    markerCounts.set(marker, (markerCounts.get(marker) ?? 0) + 1)
  }

  if (markerCounts.size > 1) {
    const markerSummary = Array.from(markerCounts.entries())
      .map(([marker, count]) => `${marker} (${count})`)
      .join(", ")
    issues.push({
      category: "bullet-style",
      label: "Mixed bullet markers",
      detail: `Bullet styles are inconsistent: ${markerSummary}. Use one bullet marker throughout the resume.`,
    })
  }

  const punctuationCounts = {
    period: 0,
    noPunctuation: 0,
    other: 0,
  }

  for (const line of extractedBullets) {
    const cleanLine = line.trim()
    if (/\.$/.test(cleanLine)) punctuationCounts.period += 1
    else if (/[;:]$/.test(cleanLine)) punctuationCounts.other += 1
    else punctuationCounts.noPunctuation += 1
  }

  const punctuationStyles = Object.values(punctuationCounts).filter(
    (count) => count > 0
  )
  if (extractedBullets.length >= 3 && punctuationStyles.length > 1) {
    const punctuationParts = [
      punctuationCounts.period > 0
        ? `${punctuationCounts.period} end with periods`
        : null,
      punctuationCounts.noPunctuation > 0
        ? `${punctuationCounts.noPunctuation} have no ending punctuation`
        : null,
      punctuationCounts.other > 0
        ? `${punctuationCounts.other} end with other punctuation`
        : null,
    ].filter((part): part is string => Boolean(part))

    issues.push({
      category: "punctuation",
      label: "Bullet ending style varies",
      detail: `Bullet endings are inconsistent: ${joinIssueParts(punctuationParts)}.`,
    })
  }

  const dateMetrics = getDateOrderMetrics(text)

  if (dateMetrics.formatTypes.length > 1) {
    issues.push({
      category: "dates",
      label: "Mixed date formats",
      detail: `Date formats are inconsistent: ${dateMetrics.formatTypes
        .map((type) => type.replaceAll("_", " "))
        .join(", ")}.`,
    })
  }

  for (const issue of dateMetrics.chronologyIssues.slice(0, 3)) {
    issues.push({
      category: "chronology",
      label: `${issue.section} chronology issue`,
      detail: `"${issue.currentLine}" appears below "${issue.previousLine}" even though it looks more recent.`,
    })
  }

  return {
    issues,
    score:
      issues.length === 0
        ? 100
        : clampScore(
            100 -
              issues.length * 16 -
              Math.max(0, dateMetrics.chronologyIssues.length - 1) * 6
          ),
  }
}

export function getSectionMetrics(
  text: string,
  options?: {
    missingRequiredSections?: string[]
    missingOptionalSections?: string[]
  }
) {
  const lines = getLines(text)
  const detectedOrder: string[] = []

  for (const line of lines) {
    const normalized = normalizeSectionHeader(line)
    const matchedEntry = Object.entries(SECTION_ALIASES).find(([, aliases]) =>
      aliases.includes(normalized)
    )
    if (!matchedEntry) continue

    const [canonical] = matchedEntry
    if (canonical && !detectedOrder.includes(canonical)) {
      detectedOrder.push(canonical)
    }
  }

  const presentSections = detectedOrder.map(titleCaseWords)
  const missingRequiredSections =
    options?.missingRequiredSections ??
    REQUIRED_SECTION_KEYS.filter((key) => !detectedOrder.includes(key)).map(
      titleCaseWords
    )
  const missingOptionalSections = options?.missingOptionalSections ?? []

  const orderIssues: SectionIssue[] = []
  const summaryIndex = detectedOrder.indexOf("professionalSummary")
  const workIndex = detectedOrder.indexOf("workExperience")
  const skillsIndex = detectedOrder.indexOf("skills")
  const educationIndex = detectedOrder.indexOf("education")

  if (summaryIndex !== -1 && workIndex !== -1 && summaryIndex > workIndex) {
    orderIssues.push({
      category: "order",
      label: "Summary order",
      detail:
        "Professional Summary appears below Work Experience. Move the summary above experience so role positioning is visible earlier.",
    })
  }

  if (skillsIndex !== -1 && workIndex !== -1 && skillsIndex < workIndex) {
    orderIssues.push({
      category: "order",
      label: "Skills order",
      detail:
        "Skills appears above Work Experience. Keep skills after the summary and primary experience unless there is a strong reason not to.",
    })
  }

  if (educationIndex !== -1 && workIndex !== -1 && educationIndex < workIndex) {
    orderIssues.push({
      category: "order",
      label: "Education order",
      detail:
        "Education appears above Work Experience. For most ATS resumes, experience should appear before education.",
    })
  }

  const issues: SectionIssue[] = [
    ...missingRequiredSections.map((section) => ({
      category: "missing-required" as const,
      label: section,
      detail: `${section} is missing or not labeled with a standard ATS-safe header.`,
    })),
    ...missingOptionalSections.map((section) => ({
      category: "missing-optional" as const,
      label: section,
      detail: `${section} is missing even though it looks relevant for this target role.`,
    })),
    ...orderIssues,
  ]

  const score = clampScore(
    100 -
      missingRequiredSections.length * 24 -
      missingOptionalSections.length * 8 -
      orderIssues.length * 10
  )

  return {
    presentSections,
    missingRequiredSections,
    missingOptionalSections,
    orderIssues,
    issues,
    score,
  }
}

export function getFillerWordMetrics(text: string) {
  const sections = parseResumeSections(text)
  const candidateLines = [
    ...extractBullets([
      ...(sections.get("experience") ?? []),
      ...(sections.get("work experience") ?? []),
      ...(sections.get("employment") ?? []),
      ...(sections.get("professional experience") ?? []),
      ...(sections.get("projects") ?? []),
    ]),
    ...(sections.get("summary") ?? []),
    ...(sections.get("professional summary") ?? []),
  ]

  const issues: FillerWordIssue[] = []
  const phraseCounts = new Map<string, number>()

  for (const rawLine of candidateLines) {
    const line = rawLine.trim()
    if (!line) continue
    const normalizedLine = line.toLowerCase()

    for (const phrase of ATS_FILLER_PHRASES) {
      const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i")
      if (!pattern.test(normalizedLine)) continue

      const category =
        normalizedLine.startsWith(phrase) ||
        new RegExp(`^[-*•\\s]*${escapeRegex(phrase)}\\b`, "i").test(line)
          ? "weak-lead"
          : "weak-phrase"

      issues.push({
        phrase,
        line,
        category,
        reason:
          category === "weak-lead"
            ? "This line opens with weak ownership language instead of the direct action you took."
            : "This phrase lowers specificity and makes the contribution read less directly.",
      })
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
    }

    for (const phrase of FILLER_MODIFIER_PHRASES) {
      const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i")
      if (!pattern.test(normalizedLine)) continue

      issues.push({
        phrase,
        line,
        category: "vague-modifier",
        reason:
          "This wording is vague and usually adds less ATS signal than a concrete tool, scope, or result.",
      })
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
    }
  }

  const uniqueIssues = Array.from(
    new Map(
      issues.map((issue) => [`${issue.phrase}::${issue.line}`, issue])
    ).values()
  )
  const weakLeadCount = uniqueIssues.filter(
    (issue) => issue.category === "weak-lead"
  ).length
  const weakPhraseCount = uniqueIssues.filter(
    (issue) => issue.category === "weak-phrase"
  ).length
  const vagueModifierCount = uniqueIssues.filter(
    (issue) => issue.category === "vague-modifier"
  ).length
  const penalty =
    weakLeadCount * 12 + weakPhraseCount * 8 + vagueModifierCount * 5

  return {
    issues: uniqueIssues,
    phraseCounts: [...phraseCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([phrase, count]) => ({ phrase, count })),
    score: uniqueIssues.length === 0 ? 100 : clampScore(100 - penalty),
  }
}

export function getActionVerbMetrics(text: string) {
  const sections = parseResumeSections(text)
  const bullets = extractBullets([
    ...(sections.get("experience") ?? []),
    ...(sections.get("work experience") ?? []),
    ...(sections.get("employment") ?? []),
    ...(sections.get("professional experience") ?? []),
    ...(sections.get("projects") ?? []),
  ])

  const strongLeadVerbSet = new Set(
    ACTION_VERB_DICTIONARY.map((entry) => entry.verb.toLowerCase())
  )
  const weakPhrases = WEAK_ACTION_VERB_DICTIONARY.map((entry) =>
    entry.weak.toLowerCase()
  ).sort((left, right) => right.length - left.length)

  const issues: ActionVerbIssue[] = []
  const phraseCounts = new Map<string, number>()
  let strongLeadCount = 0

  for (const bullet of bullets) {
    const line = bullet.trim()
    if (!line) continue
    const normalizedLine = line.toLowerCase()
    const firstWord =
      normalizedLine.split(/\s+/)[0]?.replace(/[^a-z0-9+-]/g, "") || ""

    if (strongLeadVerbSet.has(firstWord)) {
      strongLeadCount += 1
    }

    for (const phrase of weakPhrases) {
      const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i")
      if (!pattern.test(normalizedLine)) continue

      const isLead = new RegExp(`^${escapeRegex(phrase)}\\b`, "i").test(
        normalizedLine
      )
      issues.push({
        phrase,
        line,
        category: isLead ? "weak-lead" : "weak-phrase",
        reason: isLead
          ? "This bullet opens with weak action wording instead of a direct accomplishment verb."
          : "This bullet contains weak action wording that softens ownership.",
      })
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
    }
  }

  const uniqueIssues = Array.from(
    new Map(
      issues.map((issue) => [`${issue.phrase}::${issue.line}`, issue])
    ).values()
  )
  const weakLeadCount = uniqueIssues.filter(
    (issue) => issue.category === "weak-lead"
  ).length
  const weakPhraseCount = uniqueIssues.filter(
    (issue) => issue.category === "weak-phrase"
  ).length
  const totalBullets = bullets.length
  const strongLeadRatio = totalBullets > 0 ? strongLeadCount / totalBullets : 0
  const repeatedWeakPenalty = Math.max(0, uniqueIssues.length - 2) * 2

  let score =
    totalBullets === 0
      ? 70
      : 100 - weakLeadCount * 12 - weakPhraseCount * 7 - repeatedWeakPenalty

  if (totalBullets > 0) {
    if (strongLeadRatio < 0.35) score -= 16
    else if (strongLeadRatio < 0.5) score -= 10
    else if (strongLeadRatio < 0.65) score -= 6
    else if (strongLeadRatio < 0.8) score -= 2
  }

  if (weakLeadCount >= 6) score = Math.min(score, 48)
  else if (weakLeadCount >= 5) score = Math.min(score, 56)
  else if (weakLeadCount >= 4) score = Math.min(score, 64)
  else if (weakLeadCount >= 3) score = Math.min(score, 72)
  else if (weakLeadCount >= 2) score = Math.min(score, 82)
  else if (weakLeadCount >= 1) score = Math.min(score, 90)

  return {
    issues: uniqueIssues,
    phraseCounts: [...phraseCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([phrase, count]) => ({ phrase, count })),
    totalBullets,
    strongLeadCount,
    strongLeadRatio,
    weakLeadCount,
    weakPhraseCount,
    score: clampScore(score),
  }
}

export function getAccomplishmentMetrics(text: string) {
  const sections = parseResumeSections(text)
  const bullets = extractBullets([
    ...(sections.get("experience") ?? []),
    ...(sections.get("work experience") ?? []),
    ...(sections.get("employment") ?? []),
    ...(sections.get("professional experience") ?? []),
    ...(sections.get("projects") ?? []),
  ])

  const issues: AccomplishmentIssue[] = []
  const phraseCounts = new Map<string, number>()
  let accomplishmentLikeCount = 0

  for (const bullet of bullets) {
    const line = bullet.trim()
    if (!line) continue
    const normalizedLine = line.toLowerCase()
    const hasMetric =
      /\b\d[\d.,]*\b|%|\$|£|€|\b(?:kpi|okr|mrr|arr|roi)\b/i.test(line)
    const hasOutcomeSignal =
      /\b(?:increased|reduced|improved|generated|cut|boosted|grew|saved|accelerated|shortened|stabilized|expanded|raised|delivered)\b/i.test(
        normalizedLine
      )
    const hasResultConnector =
      /\b(?:by|through|resulting in|resulted in|leading to|led to|which|so that)\b/i.test(
        normalizedLine
      )

    const matchedPhrase = RESPONSIBILITY_ORIENTED_PHRASES.find((phrase) =>
      new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i").test(normalizedLine)
    )

    if (matchedPhrase) {
      issues.push({
        phrase: matchedPhrase,
        line,
        reason:
          "This line reads more like a responsibility statement than a visible accomplishment.",
      })
      phraseCounts.set(
        matchedPhrase,
        (phraseCounts.get(matchedPhrase) ?? 0) + 1
      )
      continue
    }

    if (hasMetric || (hasOutcomeSignal && hasResultConnector)) {
      accomplishmentLikeCount += 1
    }
  }

  const uniqueIssues = Array.from(
    new Map(
      issues.map((issue) => [`${issue.phrase}::${issue.line}`, issue])
    ).values()
  )
  const totalBullets = bullets.length
  const accomplishmentRatio =
    totalBullets > 0 ? accomplishmentLikeCount / totalBullets : 0
  const repeatedPenalty = Math.max(0, uniqueIssues.length - 2) * 2

  let score =
    totalBullets === 0 ? 70 : 100 - uniqueIssues.length * 12 - repeatedPenalty

  if (totalBullets > 0) {
    if (accomplishmentRatio < 0.25) score -= 18
    else if (accomplishmentRatio < 0.4) score -= 12
    else if (accomplishmentRatio < 0.55) score -= 7
    else if (accomplishmentRatio < 0.7) score -= 3
  }

  if (uniqueIssues.length >= 6) score = Math.min(score, 46)
  else if (uniqueIssues.length >= 5) score = Math.min(score, 54)
  else if (uniqueIssues.length >= 4) score = Math.min(score, 62)
  else if (uniqueIssues.length >= 3) score = Math.min(score, 72)
  else if (uniqueIssues.length >= 2) score = Math.min(score, 82)
  else if (uniqueIssues.length >= 1) score = Math.min(score, 90)

  return {
    issues: uniqueIssues,
    phraseCounts: [...phraseCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([phrase, count]) => ({ phrase, count })),
    totalBullets,
    accomplishmentLikeCount,
    accomplishmentRatio,
    score: clampScore(score),
  }
}

export function getLengthMetrics(text: string) {
  const wordCount = countWords(text)
  const lineCount = getLines(text).length
  const estimatedPages =
    wordCount <= 0
      ? 1
      : wordCount <= 450
        ? 1
        : wordCount <= 900
          ? 2
          : Math.ceil(wordCount / 450)

  let assessment: LengthAssessment = "optimal"
  let score = 100

  if (wordCount < 180) {
    assessment = "too-short"
    score = 48
  } else if (wordCount < 300) {
    assessment = "slightly-short"
    score = 68
  } else if (wordCount < 450) {
    assessment = "good"
    score = 88
  } else if (wordCount <= 900) {
    assessment = "optimal"
    score = 100
  } else if (wordCount <= 1100) {
    assessment = "slightly-long"
    score = 84
  } else if (wordCount <= 1300) {
    assessment = "slightly-long"
    score = 72
  } else {
    assessment = "too-long"
    score = 54
  }

  if (lineCount > 95) score -= 8
  else if (lineCount > 80) score -= 4

  return {
    wordCount,
    lineCount,
    estimatedPages,
    assessment,
    recommendedPageRange: "1-2",
    score: clampScore(score),
  }
}
