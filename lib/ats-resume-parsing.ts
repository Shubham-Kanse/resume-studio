const SECTION_HEADERS = [
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

const EXPERIENCE_HEADERS = [
  "experience",
  "work experience",
  "employment",
  "professional experience",
]

function normalizeSectionHeader(line: string) {
  return line
    .trim()
    .toLowerCase()
    .replace(/[:\s]+$/g, "")
}

export function getResumeLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function isLikelySectionHeader(line: string) {
  const normalized = normalizeSectionHeader(line)
  const alphaOnly = line.replace(/[^A-Za-z]/g, "")
  const isMostlyUppercase =
    alphaOnly.length > 0 && alphaOnly === alphaOnly.toUpperCase()
  const wordCount = normalized.split(/\s+/).filter(Boolean).length

  return (
    SECTION_HEADERS.includes(normalized) ||
    (isMostlyUppercase && wordCount <= 4)
  )
}

function isLikelyMetadataLine(line: string) {
  const normalized = line.trim()
  const lowercase = normalized.toLowerCase()
  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  const hasTerminalPunctuation = /[.,;:)]$/.test(normalized)
  const looksLikeSentence = wordCount >= 5 || hasTerminalPunctuation

  if (looksLikeSentence) {
    return false
  }

  return (
    /\b(?:19|20)\d{2}\b/.test(normalized) ||
    /\b(?:present|current)\b/i.test(normalized) ||
    /\s[|@]\s/.test(normalized) ||
    /\b(?:remote|hybrid|onsite)\b/i.test(normalized) ||
    /^(?:[A-Z][A-Za-z0-9&()/.+-]*)(?:\s+[A-Z][A-Za-z0-9&()/.+-]*){0,4}$/.test(
      normalized
    ) ||
    /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*[-–]\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})$/i.test(
      lowercase
    )
  )
}

function isLikelyExperienceSubheading(line: string) {
  const normalized = line.trim()
  if (!normalized) return false

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount === 0 || wordCount > 10) return false
  if (/[.?!]$/.test(normalized)) return false
  if (/\b(?:19|20)\d{2}\b/.test(normalized)) return false
  if (/\s[|@]\s/.test(normalized)) return false

  const alphaOnly = normalized.replace(/[^A-Za-z]/g, "")
  const uppercaseRatio =
    alphaOnly.length > 0
      ? normalized.replace(/[^A-Z]/g, "").length / alphaOnly.length
      : 0

  return (
    /[:&]$/.test(normalized) ||
    /[–-]/.test(normalized) ||
    uppercaseRatio >= 0.55 ||
    normalized.split(/\s+/).every((word) => {
      if (/^[&/+.-]+$/.test(word)) return true
      return /^[A-Z][A-Za-z&/+.-]*$/.test(word)
    })
  )
}

function looksLikeBulletSentence(line: string) {
  const normalized = line.trim()
  if (!normalized) return false
  if (isLikelySectionHeader(normalized) || isLikelyMetadataLine(normalized))
    return false

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount < 5) return false
  const startsLikeBullet = /^[A-Z0-9]/.test(normalized)
  if (!startsLikeBullet) return false

  if (/^[A-Z][A-Za-z]+(?:ed|ing|s)\b/.test(normalized)) return true
  if (/^\d+[.)]\s+/.test(normalized)) return true
  if (/[,.%:]$/.test(normalized)) return true
  if (
    /\b(?:increased|reduced|improved|built|led|developed|designed|created|launched|managed|delivered|optimized|mentored|implemented|generated|drove|owned)\b/i.test(
      normalized
    )
  ) {
    return true
  }

  return false
}

function mergeWrappedBullets(lines: string[]) {
  const bullets: string[] = []
  let currentBullet: string | null = null

  for (const line of lines) {
    const explicitBullet = /^[-*•]/.test(line)
    const inferredBullet = !explicitBullet && looksLikeBulletSentence(line)

    if (
      currentBullet &&
      inferredBullet &&
      !explicitBullet &&
      !/[.!?]$/.test(currentBullet)
    ) {
      currentBullet = `${currentBullet} ${line}`.replace(/\s+/g, " ").trim()
      continue
    }

    if (explicitBullet || inferredBullet) {
      if (currentBullet) bullets.push(currentBullet.trim())
      currentBullet = explicitBullet
        ? line.replace(/^[-*•]\s*/, "").trim()
        : line.trim()
      continue
    }

    if (!currentBullet) continue
    if (isLikelySectionHeader(line)) break
    if (isLikelyExperienceSubheading(line)) {
      bullets.push(currentBullet.trim())
      currentBullet = null
      continue
    }
    if (isLikelyMetadataLine(line)) {
      bullets.push(currentBullet.trim())
      currentBullet = null
      continue
    }

    currentBullet = `${currentBullet} ${line}`.replace(/\s+/g, " ").trim()
  }

  if (currentBullet) bullets.push(currentBullet.trim())

  return bullets
}

export function parseResumeSections(text: string) {
  const sections = new Map<string, string[]>()
  let current = "other"

  for (const line of getResumeLines(text)) {
    const normalized = normalizeSectionHeader(line)
    if (SECTION_HEADERS.includes(normalized)) {
      current = normalized
      if (!sections.has(current)) sections.set(current, [])
      continue
    }

    const currentLines = sections.get(current) ?? []
    currentLines.push(line)
    sections.set(current, currentLines)
  }

  return sections
}

export function extractBullets(lines: string[]) {
  return mergeWrappedBullets(lines)
}

export function getSectionBulletCounts(text: string) {
  const sections = parseResumeSections(text)
  const experienceSections = new Set(EXPERIENCE_HEADERS)
  let experienceBulletCount = 0
  const otherSectionCounts: Array<{ section: string; bulletCount: number }> = []

  for (const [section, lines] of sections.entries()) {
    if (section === "other") continue

    const bulletCount = extractBullets(lines).length
    if (experienceSections.has(section)) {
      experienceBulletCount += bulletCount
      continue
    }

    otherSectionCounts.push({
      section,
      bulletCount,
    })
  }

  return {
    experienceBulletCount,
    otherSectionCounts,
  }
}

export function extractExperienceBullets(text: string) {
  const lines = getResumeLines(text)
  const sectionLines: string[] = []
  let inExperience = false

  for (const line of lines) {
    const normalized = normalizeSectionHeader(line)

    if (EXPERIENCE_HEADERS.includes(normalized)) {
      inExperience = true
      continue
    }

    if (
      inExperience &&
      SECTION_HEADERS.includes(normalized) &&
      !EXPERIENCE_HEADERS.includes(normalized)
    ) {
      break
    }

    if (!inExperience) continue
    sectionLines.push(line)
  }

  return mergeWrappedBullets(sectionLines)
}
