import { shouldKeepCachedRecord } from "@/lib/local-storage-policy"
import type { SaveTrackedRunInput, TrackedRunRecord } from "@/lib/tracked-runs"
import type { ATSScoreResponse } from "@/types/ats"

const STORAGE_PREFIX = "resume-studio-tracked-runs"

function cloneAtsScore(score: ATSScoreResponse | null | undefined) {
  if (!score) return null
  return JSON.parse(JSON.stringify(score)) as ATSScoreResponse
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeLocalTrackedRun(
  record: Record<string, unknown>
): TrackedRunRecord {
  return {
    id: String(record.id),
    user_id: String(record.user_id),
    mode: record.mode === "ats-score" ? "ats-score" : "generate",
    label: typeof record.label === "string" ? record.label : "",
    job_description:
      typeof record.job_description === "string"
        ? record.job_description
        : null,
    resume_content:
      typeof record.resume_content === "string" ? record.resume_content : "",
    resume_file_name:
      typeof record.resume_file_name === "string"
        ? record.resume_file_name
        : null,
    resume_file_mime_type:
      typeof record.resume_file_mime_type === "string"
        ? record.resume_file_mime_type
        : null,
    resume_file_path:
      typeof record.resume_file_path === "string"
        ? record.resume_file_path
        : null,
    resume_file_data_url:
      typeof record.resume_file_data_url === "string"
        ? record.resume_file_data_url
        : null,
    extra_instructions:
      typeof record.extra_instructions === "string"
        ? record.extra_instructions
        : null,
    latex_content:
      typeof record.latex_content === "string" ? record.latex_content : null,
    ats_score:
      (record.ats_score as ATSScoreResponse | null | undefined) ?? null,
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
  }
}

export function loadLocalTrackedRuns(userId: string): TrackedRunRecord[] {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (record): record is Record<string, unknown> =>
              typeof record === "object" && record !== null
          )
          .map(normalizeLocalTrackedRun)
          .filter((record) => shouldKeepCachedRecord(record.updated_at))
      : []
  } catch {
    return []
  }
}

export function persistLocalTrackedRuns(
  userId: string,
  records: TrackedRunRecord[]
) {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(
        records.filter((record) => shouldKeepCachedRecord(record.updated_at))
      )
    )
  } catch {
    // Ignore localStorage write failures.
  }
}

export function removeLocalTrackedRun(userId: string, runId: string) {
  const records = loadLocalTrackedRuns(userId)
  const next = records.filter((record) => record.id !== runId)
  persistLocalTrackedRuns(userId, next)
  return next
}

export function clearLocalTrackedRuns(userId: string) {
  if (!isBrowser()) return

  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // Ignore localStorage write failures.
  }
}

export function mergeTrackedRuns(
  remote: TrackedRunRecord[],
  local: TrackedRunRecord[],
  limit: number
) {
  const byId = new Map<string, TrackedRunRecord>()

  ;[...local, ...remote].forEach((record) => {
    const existing = byId.get(record.id)

    if (!existing) {
      byId.set(record.id, record)
      return
    }

    const existingTime = new Date(existing.updated_at).getTime()
    const nextTime = new Date(record.updated_at).getTime()
    byId.set(record.id, nextTime >= existingTime ? record : existing)
  })

  return [...byId.values()]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit)
}

export function createLocalTrackedRunRecord(
  userId: string,
  input: SaveTrackedRunInput,
  label: string
): TrackedRunRecord {
  const now = new Date().toISOString()

  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    user_id: userId,
    mode: input.mode,
    label,
    job_description: input.jobDescription || null,
    resume_content: input.resumeContent,
    resume_file_name: input.sourceFileName?.trim() || null,
    resume_file_mime_type: input.sourceFileMimeType?.trim() || null,
    resume_file_path: input.sourceFilePath?.trim() || null,
    resume_file_data_url: input.sourceFileDataUrl?.trim() || null,
    extra_instructions: input.extraInstructions?.trim()
      ? input.extraInstructions.trim()
      : null,
    latex_content: input.latexContent ?? null,
    ats_score: cloneAtsScore(input.atsScore),
    created_at: now,
    updated_at: now,
  }
}

export function updateTrackedRunScoreLocally(
  records: TrackedRunRecord[],
  runId: string,
  score: ATSScoreResponse
) {
  const updatedAt = new Date().toISOString()
  let changed = false

  const next = records.map((record) => {
    if (record.id !== runId) return record
    changed = true
    return {
      ...record,
      ats_score: cloneAtsScore(score),
      updated_at: updatedAt,
    }
  })

  return { changed, records: next }
}
