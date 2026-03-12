import assert from "node:assert/strict"
import test from "node:test"

import { mergeJobApplications } from "@/lib/job-applications-local"
import { buildResumeStoragePath, isDataUrl } from "@/lib/resume-storage"
import { mergeTrackedRuns } from "@/lib/tracked-runs-local"

test("resume storage path is scoped by user and sanitizes the file name", () => {
  assert.equal(
    buildResumeStoragePath(
      "user-123",
      "record-456",
      "Senior Resume 2026.pdf",
      "tracked-runs"
    ),
    "user-123/tracked-runs/record-456/Senior-Resume-2026.pdf"
  )
})

test("data URL detection ignores regular signed URLs", () => {
  assert.equal(isDataUrl("data:application/pdf;base64,abc123"), true)
  assert.equal(
    isDataUrl(
      "https://example.supabase.co/storage/v1/object/sign/resume-files"
    ),
    false
  )
})

test("tracked run merge prefers the remote record on equal timestamps", () => {
  const updatedAt = "2026-03-12T12:00:00.000Z"
  const remote = {
    id: "run-1",
    user_id: "user-1",
    mode: "generate" as const,
    label: "Generated Resume",
    job_description: null,
    resume_content: "content",
    resume_file_name: "resume.pdf",
    resume_file_mime_type: "application/pdf",
    resume_file_path: "user-1/tracked-runs/run-1/resume.pdf",
    resume_file_data_url: "https://fresh.example/download",
    extra_instructions: null,
    latex_content: null,
    ats_score: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
  const local = {
    ...remote,
    resume_file_data_url: "https://stale.example/download",
  }

  const [merged] = mergeTrackedRuns([remote], [local], 10)
  assert.equal(merged?.resume_file_data_url, remote.resume_file_data_url)
})

test("job application merge prefers the remote record on equal timestamps", () => {
  const updatedAt = "2026-03-12T12:00:00.000Z"
  const remote = {
    id: "application-1",
    user_id: "user-1",
    company: "OpenAI",
    position: "Engineer",
    stage: "Applied" as const,
    job_link: null,
    resume_file_name: "resume.pdf",
    resume_file_mime_type: "application/pdf",
    resume_file_path: "user-1/job-applications/application-1/resume.pdf",
    resume_file_data_url: "https://fresh.example/download",
    applied_on: "2026-03-12",
    created_at: updatedAt,
    updated_at: updatedAt,
  }
  const local = {
    ...remote,
    resume_file_data_url: "https://stale.example/download",
  }

  const [merged] = mergeJobApplications([remote], [local])
  assert.equal(merged?.resume_file_data_url, remote.resume_file_data_url)
})
