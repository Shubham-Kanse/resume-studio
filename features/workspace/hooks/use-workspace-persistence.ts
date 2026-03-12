"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  createJobApplicationDraft,
  formatJobApplicationDateForStorage,
  sortJobApplications,
  type JobApplicationRecord,
} from "@/lib/job-applications"
import {
  clearLocalJobApplications,
  loadLocalJobApplications,
  mergeJobApplications,
  persistLocalJobApplications,
  removeLocalJobApplication,
} from "@/lib/job-applications-local"
import {
  isMissingJobApplicationsTable,
  isMissingTrackedRunsTable,
  normalizeJobApplication,
  normalizeTrackedRun,
} from "@/lib/record-normalizers"
import {
  hydrateJobApplicationResumeUrls,
  hydrateTrackedRunResumeUrls,
  isDataUrl,
  removeResumeFile,
  uploadResumeDataUrl,
} from "@/lib/resume-storage"
import {
  buildTrackedRunLabel,
  type SaveTrackedRunInput,
  type TrackedRunRecord,
} from "@/lib/tracked-runs"
import {
  clearLocalTrackedRuns,
  createLocalTrackedRunRecord,
  loadLocalTrackedRuns,
  mergeTrackedRuns,
  persistLocalTrackedRuns,
  removeLocalTrackedRun,
  updateTrackedRunScoreLocally,
} from "@/lib/tracked-runs-local"
import type { ATSScoreResponse } from "@/types/ats"

import type { Session, SupabaseClient } from "@supabase/supabase-js"

const HISTORY_LIMIT = 24
const TRACKED_RUNS_STORAGE_NOTICE =
  "Cloud dashboard storage needs the latest Supabase schema. Using local browser history for now."
const JOB_APPLICATIONS_STORAGE_NOTICE =
  "Job tracker cloud storage needs the latest Supabase schema. Using local browser history for now."

interface UseWorkspacePersistenceOptions {
  session: Session | null
  supabase: SupabaseClient | null
  setAuthMessage: (message: string) => void
}

export function useWorkspacePersistence({
  session,
  supabase,
  setAuthMessage,
}: UseWorkspacePersistenceOptions) {
  const jobApplicationSaveTimersRef = useRef<Record<string, number>>({})
  const [historyItems, setHistoryItems] = useState<TrackedRunRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<
    string | null
  >(null)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const [storageNotice, setStorageNotice] = useState<string | null>(null)
  const [jobApplications, setJobApplications] = useState<
    JobApplicationRecord[]
  >([])
  const [jobApplicationsLoading, setJobApplicationsLoading] = useState(false)
  const [savingJobApplicationId, setSavingJobApplicationId] = useState<
    string | null
  >(null)
  const [deletingJobApplicationId, setDeletingJobApplicationId] = useState<
    string | null
  >(null)
  const [jobApplicationsNotice, setJobApplicationsNotice] = useState<
    string | null
  >(null)

  const upsertHistoryRecord = useCallback((record: TrackedRunRecord) => {
    setHistoryItems((prev) => {
      const next = [
        record,
        ...prev.filter((item) => item.id !== record.id),
      ].slice(0, HISTORY_LIMIT)
      return next
    })
    setSelectedHistoryRunId(record.id)
  }, [])

  const loadHistory = useCallback(
    async (userId: string) => {
      const localHistory = loadLocalTrackedRuns(userId)
      if (localHistory.length > 0) {
        setHistoryItems(localHistory)
        setSelectedHistoryRunId(
          (current) => current ?? localHistory[0]?.id ?? null
        )
      }

      if (!supabase) {
        setHistoryLoading(false)
        return
      }

      setHistoryLoading(true)

      const { data, error: historyError } = await supabase
        .from("tracked_runs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT)

      if (historyError) {
        if (isMissingTrackedRunsTable(historyError)) {
          setStorageNotice(TRACKED_RUNS_STORAGE_NOTICE)
        } else {
          setAuthMessage(historyError.message)
        }
        setHistoryLoading(false)
        return
      }

      const normalized = ((data ?? []) as Record<string, unknown>[]).map(
        normalizeTrackedRun
      )
      const hydrated = await hydrateTrackedRunResumeUrls(supabase, normalized)
      const merged = mergeTrackedRuns(hydrated, localHistory, HISTORY_LIMIT)
      persistLocalTrackedRuns(userId, merged)
      setHistoryItems(merged)
      setSelectedHistoryRunId((current) => current ?? merged[0]?.id ?? null)
      setHistoryLoading(false)
      setStorageNotice(null)
    },
    [setAuthMessage, supabase]
  )

  const loadJobApplications = useCallback(
    async (userId: string) => {
      const localApplications = loadLocalJobApplications(userId)
      if (localApplications.length > 0) {
        setJobApplications(localApplications)
      } else {
        setJobApplications([])
      }

      if (!supabase) {
        setJobApplicationsLoading(false)
        return
      }

      setJobApplicationsLoading(true)

      const { data, error: applicationsError } = await supabase
        .from("job_applications")
        .select("*")
        .eq("user_id", userId)
        .order("applied_on", { ascending: false })
        .order("updated_at", { ascending: false })

      if (applicationsError) {
        if (isMissingJobApplicationsTable(applicationsError)) {
          setJobApplicationsNotice(JOB_APPLICATIONS_STORAGE_NOTICE)
        } else {
          setAuthMessage(
            `Failed to load job tracker: ${applicationsError.message}`
          )
        }
        setJobApplicationsLoading(false)
        return
      }

      const normalized = sortJobApplications(
        ((data ?? []) as Record<string, unknown>[]).map(normalizeJobApplication)
      )
      const hydrated = await hydrateJobApplicationResumeUrls(
        supabase,
        normalized
      )
      const merged = mergeJobApplications(hydrated, localApplications)
      persistLocalJobApplications(userId, merged)
      setJobApplications(merged)
      setJobApplicationsNotice(null)
      setJobApplicationsLoading(false)
    },
    [setAuthMessage, supabase]
  )

  useEffect(() => {
    if (!session?.user?.id) {
      Object.values(jobApplicationSaveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      jobApplicationSaveTimersRef.current = {}
      setHistoryItems([])
      setSelectedHistoryRunId(null)
      setHistoryLoading(false)
      setStorageNotice(null)
      setJobApplications([])
      setJobApplicationsLoading(false)
      setJobApplicationsNotice(null)
      setSavingJobApplicationId(null)
      setDeletingJobApplicationId(null)
      return
    }

    void loadHistory(session.user.id)
    void loadJobApplications(session.user.id)
  }, [loadHistory, loadJobApplications, session?.user?.id])

  useEffect(() => {
    return () => {
      Object.values(jobApplicationSaveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId)
      })
    }
  }, [])

  const saveTrackedRun = useCallback(
    async (input: SaveTrackedRunInput) => {
      if (!session?.user?.id) return null

      const label = buildTrackedRunLabel(input)
      const localRecord = createLocalTrackedRunRecord(
        session.user.id,
        input,
        label
      )
      const initialFileDataUrl = input.sourceFileDataUrl?.trim() || null
      const initialFilePath = input.sourceFilePath?.trim() || null
      let resumeFilePath = initialFilePath
      let payloadFileDataUrl = initialFileDataUrl

      if (supabase && initialFileDataUrl && isDataUrl(initialFileDataUrl)) {
        try {
          resumeFilePath = await uploadResumeDataUrl({
            supabase,
            userId: session.user.id,
            recordId: localRecord.id,
            kind: "tracked-runs",
            fileName: input.sourceFileName,
            mimeType: input.sourceFileMimeType,
            dataUrl: initialFileDataUrl,
            existingPath: initialFilePath,
          })
          payloadFileDataUrl = null
        } catch (uploadError) {
          console.error(
            "Failed to upload tracked run resume file:",
            uploadError
          )
          setAuthMessage(
            "Saved your run, but the attached resume file stayed in browser storage."
          )
        }
      }

      const payload = {
        id: localRecord.id,
        user_id: session.user.id,
        mode: input.mode,
        label,
        job_description: input.jobDescription || null,
        resume_content: input.resumeContent,
        resume_file_name: input.sourceFileName?.trim() || null,
        resume_file_mime_type: input.sourceFileMimeType?.trim() || null,
        resume_file_path: resumeFilePath,
        resume_file_data_url: resumeFilePath ? null : payloadFileDataUrl,
        extra_instructions: input.extraInstructions?.trim()
          ? input.extraInstructions.trim()
          : null,
        latex_content: input.latexContent ?? null,
        ats_score: input.atsScore ?? null,
      }

      if (!supabase) {
        const localOnlyHistory = mergeTrackedRuns(
          [localRecord],
          loadLocalTrackedRuns(session.user.id),
          HISTORY_LIMIT
        )
        persistLocalTrackedRuns(session.user.id, localOnlyHistory)
        upsertHistoryRecord(localRecord)
        return localRecord.id
      }

      const { data, error: saveError } = await supabase
        .from("tracked_runs")
        .insert(payload)
        .select("*")
        .single()

      if (saveError) {
        if (isMissingTrackedRunsTable(saveError)) {
          setStorageNotice(TRACKED_RUNS_STORAGE_NOTICE)
        } else {
          setAuthMessage(`Signed in, but save failed: ${saveError.message}`)
        }

        if (resumeFilePath && resumeFilePath !== initialFilePath) {
          try {
            await removeResumeFile(supabase, resumeFilePath)
          } catch (cleanupError) {
            console.error(
              "Failed to clean up tracked run resume after save error:",
              cleanupError
            )
          }
        }

        const fallbackRecord = {
          ...localRecord,
          resume_file_path: resumeFilePath,
        }
        const localOnlyHistory = mergeTrackedRuns(
          [fallbackRecord],
          loadLocalTrackedRuns(session.user.id),
          HISTORY_LIMIT
        )
        persistLocalTrackedRuns(session.user.id, localOnlyHistory)
        upsertHistoryRecord(fallbackRecord)
        return fallbackRecord.id
      }

      const normalized = normalizeTrackedRun(data as Record<string, unknown>)
      const [hydratedRecord] = await hydrateTrackedRunResumeUrls(supabase, [
        normalized,
      ])
      const nextRecord = hydratedRecord ?? normalized
      const merged = mergeTrackedRuns(
        [nextRecord],
        loadLocalTrackedRuns(session.user.id),
        HISTORY_LIMIT
      )
      persistLocalTrackedRuns(session.user.id, merged)
      upsertHistoryRecord(nextRecord)
      setStorageNotice(null)
      return nextRecord.id
    },
    [session?.user?.id, setAuthMessage, supabase, upsertHistoryRecord]
  )

  const updateTrackedRunScore = useCallback(
    async (runId: string, score: ATSScoreResponse) => {
      if (!session?.user?.id) return

      const localRecords = loadLocalTrackedRuns(session.user.id)
      const localUpdate = updateTrackedRunScoreLocally(
        localRecords,
        runId,
        score
      )

      if (localUpdate.changed) {
        persistLocalTrackedRuns(session.user.id, localUpdate.records)
        setHistoryItems(localUpdate.records)
      }

      if (!supabase) return

      const { data, error: updateError } = await supabase
        .from("tracked_runs")
        .update({ ats_score: score })
        .eq("id", runId)
        .eq("user_id", session.user.id)
        .select("*")
        .single()

      if (updateError) {
        if (isMissingTrackedRunsTable(updateError)) {
          setStorageNotice(TRACKED_RUNS_STORAGE_NOTICE)
        } else {
          setAuthMessage(
            `Saved score could not be refreshed: ${updateError.message}`
          )
        }
        return
      }

      if (data) {
        const normalized = normalizeTrackedRun(data as Record<string, unknown>)
        const merged = mergeTrackedRuns(
          [normalized],
          loadLocalTrackedRuns(session.user.id),
          HISTORY_LIMIT
        )
        persistLocalTrackedRuns(session.user.id, merged)
        upsertHistoryRecord(normalized)
        setStorageNotice(null)
      }
    },
    [session?.user?.id, setAuthMessage, supabase, upsertHistoryRecord]
  )

  const deleteRun = useCallback(
    async (runId: string) => {
      if (!session?.user?.id) return

      setDeletingRunId(runId)

      const deletedRun =
        historyItems.find((record) => record.id === runId) ?? null
      const localNext = removeLocalTrackedRun(session.user.id, runId)
      setHistoryItems(localNext)
      setSelectedHistoryRunId((current) => {
        if (current !== runId) return current
        return localNext[0]?.id ?? null
      })

      if (!supabase) {
        setDeletingRunId(null)
        return
      }

      if (deletedRun?.resume_file_path) {
        try {
          await removeResumeFile(supabase, deletedRun.resume_file_path)
        } catch (removeError) {
          console.error(
            "Failed to remove tracked run resume file before delete:",
            removeError
          )
        }
      }

      const { error: deleteError } = await supabase
        .from("tracked_runs")
        .delete()
        .eq("id", runId)
        .eq("user_id", session.user.id)

      if (deleteError && !isMissingTrackedRunsTable(deleteError)) {
        setAuthMessage(`Failed to remove saved history: ${deleteError.message}`)
      }

      setDeletingRunId(null)
    },
    [historyItems, session?.user?.id, setAuthMessage, supabase]
  )

  const upsertJobApplicationRecord = useCallback(
    async (record: JobApplicationRecord) => {
      if (!session?.user?.id) return

      setSavingJobApplicationId(record.id)

      if (!supabase) {
        setSavingJobApplicationId(null)
        return
      }

      const basePayload = {
        id: record.id,
        user_id: session.user.id,
        company: record.company.trim() || "",
        position: record.position?.trim() ? record.position.trim() : null,
        stage: record.stage,
        job_link: record.job_link?.trim() ? record.job_link.trim() : null,
        resume_file_name: record.resume_file_name?.trim()
          ? record.resume_file_name.trim()
          : null,
        resume_file_mime_type: record.resume_file_mime_type?.trim()
          ? record.resume_file_mime_type.trim()
          : null,
        applied_on: formatJobApplicationDateForStorage(record.applied_on),
      }

      const currentResumeDataUrl = record.resume_file_data_url?.trim() || null
      const currentResumeFilePath = record.resume_file_path?.trim() || null
      let resumeFilePath = currentResumeFilePath
      let payloadFileDataUrl =
        currentResumeFilePath || !currentResumeDataUrl
          ? null
          : currentResumeDataUrl

      if (!basePayload.resume_file_name && currentResumeFilePath) {
        try {
          await removeResumeFile(supabase, currentResumeFilePath)
        } catch (removeError) {
          console.error(
            "Failed to remove cleared job application resume file:",
            removeError
          )
        }

        resumeFilePath = null
      } else if (
        basePayload.resume_file_name &&
        currentResumeDataUrl &&
        isDataUrl(currentResumeDataUrl)
      ) {
        try {
          resumeFilePath = await uploadResumeDataUrl({
            supabase,
            userId: session.user.id,
            recordId: record.id,
            kind: "job-applications",
            fileName: basePayload.resume_file_name,
            mimeType: basePayload.resume_file_mime_type,
            dataUrl: currentResumeDataUrl,
            existingPath: currentResumeFilePath,
          })
          payloadFileDataUrl = null
        } catch (uploadError) {
          console.error(
            "Failed to upload job application resume file:",
            uploadError
          )
          setAuthMessage(
            "Saved the tracker entry, but the attached resume file stayed in browser storage."
          )
        }
      }

      const payload = {
        ...basePayload,
        resume_file_path: resumeFilePath,
        resume_file_data_url: resumeFilePath ? null : payloadFileDataUrl,
      }

      const { data, error: saveError } = await supabase
        .from("job_applications")
        .upsert(payload)
        .select("*")
        .single()

      if (saveError) {
        if (isMissingJobApplicationsTable(saveError)) {
          setJobApplicationsNotice(JOB_APPLICATIONS_STORAGE_NOTICE)
        } else {
          setAuthMessage(`Failed to save job application: ${saveError.message}`)
        }

        if (resumeFilePath && resumeFilePath !== currentResumeFilePath) {
          try {
            await removeResumeFile(supabase, resumeFilePath)
          } catch (cleanupError) {
            console.error(
              "Failed to clean up job application resume after save error:",
              cleanupError
            )
          }
        }

        setSavingJobApplicationId((current) =>
          current === record.id ? null : current
        )
        return
      }

      const normalized = normalizeJobApplication(
        data as Record<string, unknown>
      )
      const [hydratedRecord] = await hydrateJobApplicationResumeUrls(supabase, [
        normalized,
      ])
      const nextRecord = hydratedRecord ?? normalized
      setJobApplications((prev) => {
        const merged = mergeJobApplications([nextRecord], prev)
        persistLocalJobApplications(session.user.id, merged)
        return merged
      })
      setJobApplicationsNotice(null)
      setSavingJobApplicationId((current) =>
        current === record.id ? null : current
      )
    },
    [session?.user?.id, setAuthMessage, supabase]
  )

  const scheduleJobApplicationSave = useCallback(
    (record: JobApplicationRecord, delay = 450) => {
      if (typeof window === "undefined") return

      const existingTimer = jobApplicationSaveTimersRef.current[record.id]
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }

      jobApplicationSaveTimersRef.current[record.id] = window.setTimeout(() => {
        delete jobApplicationSaveTimersRef.current[record.id]
        void upsertJobApplicationRecord(record)
      }, delay)
    },
    [upsertJobApplicationRecord]
  )

  const addJobApplication = useCallback(() => {
    if (!session?.user?.id) return

    const draft = createJobApplicationDraft(session.user.id)
    setJobApplications((prev) => {
      const next = mergeJobApplications([draft], prev)
      persistLocalJobApplications(session.user.id, next)
      return next
    })
    scheduleJobApplicationSave(draft, 0)
  }, [scheduleJobApplicationSave, session?.user?.id])

  const updateJobApplication = useCallback(
    (
      applicationId: string,
      patch: Partial<
        Pick<
          JobApplicationRecord,
          | "company"
          | "position"
          | "stage"
          | "job_link"
          | "resume_file_name"
          | "resume_file_mime_type"
          | "resume_file_path"
          | "resume_file_data_url"
          | "applied_on"
        >
      >
    ) => {
      if (!session?.user?.id) return

      let nextRecord: JobApplicationRecord | null = null

      setJobApplications((prev) => {
        const next = sortJobApplications(
          prev.map((application) => {
            if (application.id !== applicationId) return application

            nextRecord = {
              ...application,
              ...patch,
              updated_at: new Date().toISOString(),
            }

            return nextRecord
          })
        )

        persistLocalJobApplications(session.user.id, next)
        return next
      })

      if (nextRecord) {
        scheduleJobApplicationSave(nextRecord)
      }
    },
    [scheduleJobApplicationSave, session?.user?.id]
  )

  const deleteJobApplication = useCallback(
    async (applicationId: string) => {
      if (!session?.user?.id) return

      const existingTimer = jobApplicationSaveTimersRef.current[applicationId]
      if (existingTimer) {
        window.clearTimeout(existingTimer)
        delete jobApplicationSaveTimersRef.current[applicationId]
      }

      setDeletingJobApplicationId(applicationId)

      const deletedApplication =
        jobApplications.find((record) => record.id === applicationId) ?? null
      const localNext = removeLocalJobApplication(
        session.user.id,
        applicationId
      )
      setJobApplications(localNext)

      if (!supabase) {
        setDeletingJobApplicationId(null)
        return
      }

      if (deletedApplication?.resume_file_path) {
        try {
          await removeResumeFile(supabase, deletedApplication.resume_file_path)
        } catch (removeError) {
          console.error(
            "Failed to remove job application resume file before delete:",
            removeError
          )
        }
      }

      const { error: deleteError } = await supabase
        .from("job_applications")
        .delete()
        .eq("id", applicationId)
        .eq("user_id", session.user.id)

      if (deleteError) {
        if (isMissingJobApplicationsTable(deleteError)) {
          setJobApplicationsNotice(JOB_APPLICATIONS_STORAGE_NOTICE)
        } else {
          setAuthMessage(
            `Failed to remove job application: ${deleteError.message}`
          )
        }
      } else {
        setJobApplicationsNotice(null)
      }

      setDeletingJobApplicationId(null)
    },
    [jobApplications, session?.user?.id, setAuthMessage, supabase]
  )

  const clearCachedRecords = useCallback((userId: string) => {
    clearLocalTrackedRuns(userId)
    clearLocalJobApplications(userId)
    Object.values(jobApplicationSaveTimersRef.current).forEach((timerId) => {
      window.clearTimeout(timerId)
    })
    jobApplicationSaveTimersRef.current = {}
    setHistoryItems([])
    setSelectedHistoryRunId(null)
    setJobApplications([])
  }, [])

  return {
    historyItems,
    historyLoading,
    selectedHistoryRunId,
    deletingRunId,
    storageNotice,
    jobApplications,
    jobApplicationsLoading,
    savingJobApplicationId,
    deletingJobApplicationId,
    jobApplicationsNotice,
    setSelectedHistoryRunId,
    saveTrackedRun,
    updateTrackedRunScore,
    deleteRun,
    addJobApplication,
    updateJobApplication,
    deleteJobApplication,
    clearCachedRecords,
  }
}
