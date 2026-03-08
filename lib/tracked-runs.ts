import type { ATSScoreResponse } from "@/lib/ats-types"

export type TrackedRunMode = "generate" | "ats-score"

export interface TrackedRunRecord {
  id: string
  user_id: string
  mode: TrackedRunMode
  label: string
  job_description: string | null
  resume_content: string
  resume_file_name: string | null
  resume_file_mime_type: string | null
  resume_file_data_url: string | null
  extra_instructions: string | null
  latex_content: string | null
  ats_score: ATSScoreResponse | null
  created_at: string
  updated_at: string
}

export interface SaveTrackedRunInput {
  mode: TrackedRunMode
  jobDescription: string
  resumeContent: string
  extraInstructions?: string
  sourceFileName?: string
  sourceFileMimeType?: string
  sourceFileDataUrl?: string
  latexContent?: string | null
  atsScore?: ATSScoreResponse | null
}

function truncateLabel(source: string, fallback: string, maxLength = 52) {
  const normalized = source.replace(/\s+/g, " ").trim()

  if (!normalized) return fallback
  if (normalized.length <= maxLength) return normalized

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
}

function normalizeFileName(fileName?: string) {
  const value = (fileName || "").trim()
  return value || null
}

export function buildTrackedRunLabel(input: SaveTrackedRunInput) {
  const sourceFileName = normalizeFileName(input.sourceFileName)
  const jobSummary = truncateLabel(input.jobDescription, "Target role", 42)

  if (input.mode === "generate") {
    if (sourceFileName) return `Generated Resume • ${truncateLabel(sourceFileName, "resume", 52)}`
    if (input.jobDescription.trim()) return `Generated Resume • ${jobSummary}`
    return "Generated Resume"
  }

  if (sourceFileName) {
    return `ATS Check • ${truncateLabel(sourceFileName, "resume", 52)}`
  }

  if (input.jobDescription.trim()) {
    return `ATS Check • ${jobSummary}`
  }

  return "ATS Check • Resume Snapshot"
}

export function extractTrackedRunFileName(label: string) {
  const parts = label.split("•").map((part) => part.trim()).filter(Boolean)

  if (parts.length < 2) return null

  const modePrefix = parts[0]
  if (
    modePrefix !== "Generated Resume" &&
    modePrefix !== "ATS Check" &&
    modePrefix !== "Generated Resume Resume" // defensive for any future bad data
  ) {
    return null
  }

  const candidate = parts[1]
  if (!candidate || candidate === "Resume Snapshot" || candidate === "Target role") return null

  return candidate
}
