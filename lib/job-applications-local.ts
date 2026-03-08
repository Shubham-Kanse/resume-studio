import type { JobApplicationRecord } from "@/lib/job-applications"
import {
  formatJobApplicationDateForDisplay,
  normalizeJobApplicationStage,
  sortJobApplications,
} from "@/lib/job-applications"

const STORAGE_PREFIX = "resume-studio-job-applications"

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeLocalJobApplication(record: Record<string, unknown>): JobApplicationRecord {
  return {
    id: String(record.id),
    user_id: String(record.user_id),
    company: typeof record.company === "string" ? record.company : "",
    position: typeof record.position === "string" ? record.position : null,
    stage: normalizeJobApplicationStage(record.stage),
    job_link: typeof record.job_link === "string" ? record.job_link : null,
    resume_file_name:
      typeof record.resume_file_name === "string"
        ? record.resume_file_name
        : typeof record.resume_label === "string"
          ? record.resume_label
          : null,
    resume_file_mime_type:
      typeof record.resume_file_mime_type === "string" ? record.resume_file_mime_type : null,
    resume_file_data_url:
      typeof record.resume_file_data_url === "string" ? record.resume_file_data_url : null,
    applied_on:
      typeof record.applied_on === "string"
        ? formatJobApplicationDateForDisplay(record.applied_on)
        : null,
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
  }
}

export function loadLocalJobApplications(userId: string): JobApplicationRecord[] {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? sortJobApplications(
          parsed
            .filter((record): record is Record<string, unknown> => typeof record === "object" && record !== null)
            .map(normalizeLocalJobApplication)
        )
      : []
  } catch {
    return []
  }
}

export function persistLocalJobApplications(userId: string, records: JobApplicationRecord[]) {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(sortJobApplications(records)))
  } catch {
    // Ignore localStorage write failures.
  }
}

export function removeLocalJobApplication(userId: string, applicationId: string) {
  const records = loadLocalJobApplications(userId)
  const next = records.filter((record) => record.id !== applicationId)
  persistLocalJobApplications(userId, next)
  return next
}

export function mergeJobApplications(remote: JobApplicationRecord[], local: JobApplicationRecord[]) {
  const byId = new Map<string, JobApplicationRecord>()

  ;[...remote, ...local].forEach((record) => {
    const existing = byId.get(record.id)

    if (!existing) {
      byId.set(record.id, record)
      return
    }

    const existingTime = new Date(existing.updated_at).getTime()
    const nextTime = new Date(record.updated_at).getTime()
    byId.set(record.id, nextTime >= existingTime ? record : existing)
  })

  return sortJobApplications([...byId.values()])
}
