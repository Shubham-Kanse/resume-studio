import { getCurrentUtcDateParts } from "./current-date"

import type { ATSScoreResponse } from "./ats-types"

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

function filterItems(items: string[], patterns: RegExp[]): string[] {
  return items.filter((item) => !patterns.some((pattern) => pattern.test(item)))
}

export function resumeHasFutureDate(
  text: string,
  referenceDate = new Date()
): boolean {
  const { currentYear, currentMonth } = getCurrentUtcDateParts(referenceDate)

  const yearMatches = text.match(/\b(19|20)\d{2}\b/g) || []
  for (const match of yearMatches) {
    const year = Number(match)
    if (year > currentYear) return true
  }

  const monthYearPattern =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{4})\b/gi
  let match: RegExpExecArray | null
  while ((match = monthYearPattern.exec(text)) !== null) {
    const month = MONTH_MAP[match[1]?.toLowerCase() || ""] ?? -1
    const year = Number(match[2] || 0)
    if (year > currentYear) return true
    if (year === currentYear && month > currentMonth) return true
  }

  const numericPattern = /\b(0?[1-9]|1[0-2])\/(\d{4})\b/g
  while ((match = numericPattern.exec(text)) !== null) {
    const month = Number(match[1] || 0) - 1
    const year = Number(match[2] || 0)
    if (year > currentYear) return true
    if (year === currentYear && month > currentMonth) return true
  }

  return false
}

export function hasLayoutEvidence(text: string): boolean {
  return /(table|column|header|footer|text box|textbox|graphic|image|logo|watermark)/i.test(
    text
  )
}

export function filterUnsupportedFeedback(
  response: ATSScoreResponse,
  resumeContent: string,
  referenceDate = new Date()
): ATSScoreResponse {
  const futureDatesPresent = resumeHasFutureDate(resumeContent, referenceDate)
  const layoutEvidencePresent = hasLayoutEvidence(resumeContent)

  const unsupportedTemporalPatterns = futureDatesPresent
    ? []
    : [
        /future date/i,
        /future education/i,
        /future qualification/i,
        /future graduation/i,
        /future graduation date/i,
        /timeline discrepancy/i,
        /verification flag/i,
        /date discrepancy/i,
        /current qualification/i,
        /graduation date.*current date/i,
        /education.*relative to.*employment/i,
        /graduation.*relative to.*employment/i,
        /employment end/i,
        /current enrollment status/i,
        /expected graduation/i,
      ]

  const unsupportedAcademicOptionalPatterns = [
    /missing gpa/i,
    /gpa or academic honors/i,
    /academic honors/i,
    /honors where potentially beneficial/i,
    /no indication of current enrollment status/i,
    /no indication of expected graduation/i,
    /expected graduation/i,
    /current enrollment status/i,
  ]

  const unsupportedCosmeticPatterns = layoutEvidencePresent
    ? []
    : [
        /table(s)?\b/i,
        /multi-?column/i,
        /column layout/i,
        /text box/i,
        /textbox/i,
        /image(s)?\b/i,
        /logo(s)?\b/i,
        /photo(s)?\b/i,
        /graphic(s)?\b/i,
        /watermark/i,
        /colored text/i,
        /background color/i,
        /custom font/i,
        /header\/footer/i,
        /header or footer/i,
        /content in header/i,
        /content in footer/i,
        /decorative shape/i,
        /border(s)?\b/i,
      ]

  const unsupportedPatterns = [
    ...unsupportedTemporalPatterns,
    ...unsupportedAcademicOptionalPatterns,
    ...unsupportedCosmeticPatterns,
  ]

  if (unsupportedPatterns.length === 0) return response

  return {
    ...response,
    keyFindings: {
      ...response.keyFindings,
      strengths: filterItems(
        response.keyFindings.strengths,
        unsupportedPatterns
      ),
      weaknesses: filterItems(
        response.keyFindings.weaknesses,
        unsupportedPatterns
      ),
    },
    detailedIssues: response.detailedIssues.filter(
      (issue) =>
        !unsupportedPatterns.some((pattern) =>
          pattern.test(
            `${issue.issue} ${issue.impact} ${issue.howToFix} ${issue.example}`
          )
        )
    ),
    recommendations: response.recommendations.filter(
      (rec) =>
        !unsupportedPatterns.some((pattern) =>
          pattern.test(`${rec.action} ${rec.benefit} ${rec.implementation}`)
        )
    ),
    sectionReviews: response.sectionReviews.map((section) => ({
      ...section,
      whatWorks: filterItems(section.whatWorks, unsupportedPatterns),
      gaps: filterItems(section.gaps, unsupportedPatterns),
      actions: filterItems(section.actions, unsupportedPatterns),
      diagnosis: unsupportedPatterns.some((pattern) =>
        pattern.test(section.diagnosis)
      )
        ? "Section reviewed using only evidence that can be supported from the extracted resume text."
        : section.diagnosis,
    })),
    atsCompatibility: {
      ...response.atsCompatibility,
      issues: filterItems(
        response.atsCompatibility.issues,
        unsupportedPatterns
      ),
      warnings: filterItems(
        response.atsCompatibility.warnings,
        unsupportedPatterns
      ),
    },
  }
}
