import type { JobApplicationRecord } from "@/lib/job-applications"
import type { TrackedRunRecord } from "@/lib/tracked-runs"

import type { SupabaseClient } from "@supabase/supabase-js"

const DEFAULT_RESUME_STORAGE_BUCKET = "resume-files"
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

type ResumeStorageKind = "tracked-runs" | "job-applications"

interface UploadResumeDataUrlInput {
  supabase: SupabaseClient
  userId: string
  recordId: string
  kind: ResumeStorageKind
  fileName?: string | null
  mimeType?: string | null
  dataUrl: string
  existingPath?: string | null
}

type ResumeBackedRecord = {
  resume_file_path: string | null
  resume_file_data_url: string | null
}

function getResumeStorageBucket() {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_RESUME_STORAGE_BUCKET

  if (typeof configured === "string" && configured.trim()) {
    return configured.trim()
  }

  return DEFAULT_RESUME_STORAGE_BUCKET
}

function normalizeFileName(fileName?: string | null) {
  const trimmed = (fileName || "").trim()
  if (!trimmed) return "resume"

  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return sanitized || "resume"
}

export function isDataUrl(value: string | null | undefined) {
  return typeof value === "string" && value.trim().startsWith("data:")
}

export function buildResumeStoragePath(
  userId: string,
  recordId: string,
  fileName: string | null | undefined,
  kind: ResumeStorageKind
) {
  return `${userId}/${kind}/${recordId}/${normalizeFileName(fileName)}`
}

async function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/
  )
  if (!match) {
    throw new Error("Failed to read the uploaded resume file.")
  }

  const mimeType = match[1] || "application/octet-stream"
  const isBase64 = Boolean(match[2])
  const payload = match[3] || ""

  if (isBase64) {
    if (typeof Buffer !== "undefined") {
      return new Blob([Buffer.from(payload, "base64")], { type: mimeType })
    }

    const decoded = atob(payload)
    const bytes = new Uint8Array(decoded.length)
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index)
    }
    return new Blob([bytes], { type: mimeType })
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType })
}

export async function uploadResumeDataUrl({
  supabase,
  userId,
  recordId,
  kind,
  fileName,
  mimeType,
  dataUrl,
  existingPath,
}: UploadResumeDataUrlInput) {
  const bucket = getResumeStorageBucket()
  const path = buildResumeStoragePath(userId, recordId, fileName, kind)
  const blob = await dataUrlToBlob(dataUrl)
  const contentType = (mimeType || "").trim() || blob.type || undefined

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType,
    upsert: true,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (existingPath && existingPath !== path) {
    const { error: cleanupError } = await supabase.storage
      .from(bucket)
      .remove([existingPath])

    if (cleanupError) {
      console.warn("Failed to remove replaced resume file:", cleanupError)
    }
  }

  return path
}

export async function removeResumeFile(
  supabase: SupabaseClient,
  path: string | null | undefined
) {
  const trimmedPath = (path || "").trim()
  if (!trimmedPath) return

  const { error } = await supabase.storage
    .from(getResumeStorageBucket())
    .remove([trimmedPath])

  if (error) {
    throw new Error(error.message)
  }
}

async function createSignedUrl(
  supabase: SupabaseClient,
  path: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(getResumeStorageBucket())
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (error) {
    console.warn("Failed to create signed resume URL:", error)
    return null
  }

  return data?.signedUrl || null
}

async function hydrateResumeUrls<T extends ResumeBackedRecord>(
  supabase: SupabaseClient,
  records: T[]
) {
  const urlCache = new Map<string, string | null>()

  return Promise.all(
    records.map(async (record) => {
      if (record.resume_file_data_url || !record.resume_file_path) {
        return record
      }

      const cached = urlCache.get(record.resume_file_path)
      if (cached !== undefined) {
        return {
          ...record,
          resume_file_data_url: cached,
        }
      }

      const signedUrl = await createSignedUrl(supabase, record.resume_file_path)
      urlCache.set(record.resume_file_path, signedUrl)

      return {
        ...record,
        resume_file_data_url: signedUrl,
      }
    })
  )
}

export function hydrateTrackedRunResumeUrls(
  supabase: SupabaseClient,
  records: TrackedRunRecord[]
) {
  return hydrateResumeUrls(supabase, records)
}

export function hydrateJobApplicationResumeUrls(
  supabase: SupabaseClient,
  records: JobApplicationRecord[]
) {
  return hydrateResumeUrls(supabase, records)
}
