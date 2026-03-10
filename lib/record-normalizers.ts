import type { ATSScoreResponse } from "@/lib/ats-types"
import {
  formatJobApplicationDateForDisplay,
  normalizeJobApplicationStage,
  type JobApplicationRecord,
} from "@/lib/job-applications"
import { TRACKED_RUN_MODE, type TrackedRunRecord } from "@/lib/tracked-runs"

export function normalizeTrackedRun(record: Record<string, unknown>): TrackedRunRecord {
  return {
    id: String(record.id),
    user_id: String(record.user_id),
    mode: record.mode === TRACKED_RUN_MODE.ATS_SCORE ? TRACKED_RUN_MODE.ATS_SCORE : TRACKED_RUN_MODE.GENERATE,
    label: String(record.label),
    job_description: typeof record.job_description === "string" ? record.job_description : null,
    resume_content: typeof record.resume_content === "string" ? record.resume_content : "",
    resume_file_name: typeof record.resume_file_name === "string" ? record.resume_file_name : null,
    resume_file_mime_type:
      typeof record.resume_file_mime_type === "string" ? record.resume_file_mime_type : null,
    resume_file_data_url:
      typeof record.resume_file_data_url === "string" ? record.resume_file_data_url : null,
    extra_instructions:
      typeof record.extra_instructions === "string" ? record.extra_instructions : null,
    latex_content: typeof record.latex_content === "string" ? record.latex_content : null,
    ats_score: (record.ats_score as ATSScoreResponse | null | undefined) ?? null,
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
  }
}

export function normalizeJobApplication(record: Record<string, unknown>): JobApplicationRecord {
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

export function isMissingTrackedRunsTable(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("tracked_runs") ||
    error?.message?.includes("schema cache") ||
    false
  )
}

export function isMissingJobApplicationsTable(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("job_applications") ||
    error?.message?.includes("schema cache") ||
    false
  )
}
