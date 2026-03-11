export const JOB_APPLICATION_STAGES = [
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "No Answer",
] as const

export type JobApplicationStage = (typeof JOB_APPLICATION_STAGES)[number]

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DISPLAY_DATE_PATTERN =
  /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{2}$/

function padDatePart(value: number) {
  return value.toString().padStart(2, "0")
}

function isValidDateParts(day: number, month: number, year: number) {
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year)
  ) {
    return false
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function formatDisplayDate(day: number, month: number, year: number) {
  return `${padDatePart(day)}/${padDatePart(month)}/${year.toString().slice(-2)}`
}

export interface JobApplicationRecord {
  id: string
  user_id: string
  company: string
  position: string | null
  stage: JobApplicationStage
  job_link: string | null
  resume_file_name: string | null
  resume_file_mime_type: string | null
  resume_file_data_url: string | null
  applied_on: string | null
  created_at: string
  updated_at: string
}

export function isJobApplicationStage(
  value: string
): value is JobApplicationStage {
  return JOB_APPLICATION_STAGES.includes(value as JobApplicationStage)
}

export function normalizeJobApplicationStage(
  value: unknown
): JobApplicationStage {
  if (typeof value === "string" && isJobApplicationStage(value)) {
    return value
  }

  return "Applied"
}

export function isJobApplicationDisplayDate(value: string) {
  if (!DISPLAY_DATE_PATTERN.test(value)) {
    return false
  }

  const [day, month, year] = value.split("/").map(Number)
  if (day === undefined || month === undefined || year === undefined)
    return false
  return isValidDateParts(day, month, 2000 + year)
}

export function normalizeJobApplicationDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 6)

  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function formatJobApplicationDateForDisplay(
  value: string | null | undefined
) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (isJobApplicationDisplayDate(trimmed)) {
    return trimmed
  }

  if (ISO_DATE_PATTERN.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number)
    if (year === undefined || month === undefined || day === undefined)
      return trimmed
    return isValidDateParts(day, month, year)
      ? formatDisplayDate(day, month, year)
      : trimmed
  }

  const displayYearMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (displayYearMatch) {
    const [, dayText, monthText, yearText] = displayYearMatch
    const day = Number(dayText)
    const month = Number(monthText)
    const year = Number(yearText)
    return isValidDateParts(day, month, year)
      ? formatDisplayDate(day, month, year)
      : trimmed
  }

  return trimmed
}

export function formatJobApplicationDateForStorage(
  value: string | null | undefined
) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (ISO_DATE_PATTERN.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number)
    if (year === undefined || month === undefined || day === undefined)
      return null
    return isValidDateParts(day, month, year)
      ? `${year.toString().padStart(4, "0")}-${padDatePart(month)}-${padDatePart(day)}`
      : null
  }

  if (isJobApplicationDisplayDate(trimmed)) {
    const [day, month, year] = trimmed.split("/").map(Number)
    if (day === undefined || month === undefined || year === undefined)
      return null
    const fullYear = 2000 + year
    return `${fullYear.toString().padStart(4, "0")}-${padDatePart(month)}-${padDatePart(day)}`
  }

  const displayYearMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (displayYearMatch) {
    const [, dayText, monthText, yearText] = displayYearMatch
    const day = Number(dayText)
    const month = Number(monthText)
    const year = Number(yearText)

    return isValidDateParts(day, month, year)
      ? `${year.toString().padStart(4, "0")}-${padDatePart(month)}-${padDatePart(day)}`
      : null
  }

  return null
}

export function sortJobApplications(records: JobApplicationRecord[]) {
  return [...records].sort((a, b) => {
    const appliedA = formatJobApplicationDateForStorage(a.applied_on)
      ? new Date(
          `${formatJobApplicationDateForStorage(a.applied_on)}T00:00:00Z`
        ).getTime()
      : 0
    const appliedB = formatJobApplicationDateForStorage(b.applied_on)
      ? new Date(
          `${formatJobApplicationDateForStorage(b.applied_on)}T00:00:00Z`
        ).getTime()
      : 0

    if (appliedA !== appliedB) {
      return appliedB - appliedA
    }

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

export function createJobApplicationDraft(
  userId: string
): JobApplicationRecord {
  const now = new Date()
  const timestamp = now.toISOString()
  const appliedOn = formatJobApplicationDateForDisplay(timestamp.slice(0, 10))

  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    user_id: userId,
    company: "",
    position: "",
    stage: "Applied",
    job_link: "",
    resume_file_name: "",
    resume_file_mime_type: "",
    resume_file_data_url: "",
    applied_on: appliedOn ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  }
}
