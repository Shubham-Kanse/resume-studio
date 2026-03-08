"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { BriefcaseBusiness, LayoutDashboard, FileCode2, LogOut, Target, UserRound } from "lucide-react"
import { ATSScorePanel } from "@/components/ats-score-panel"
import { AuthDialog } from "@/components/auth-dialog"
import { DashboardPanel } from "@/components/dashboard-panel"
import { JobApplicationsPanel } from "@/components/job-applications-panel"
import { LegalDialog } from "@/components/legal-dialog"
import { ResumeInputPanel } from "@/components/resume-input-panel"
import { ResumePreviewPanel } from "@/components/resume-preview-panel"
import { Button } from "@/components/ui/button"
import type { ATSScoreResponse } from "@/lib/ats-types"
import {
  createJobApplicationDraft,
  formatJobApplicationDateForDisplay,
  formatJobApplicationDateForStorage,
  normalizeJobApplicationStage,
  sortJobApplications,
  type JobApplicationRecord,
} from "@/lib/job-applications"
import {
  loadLocalJobApplications,
  mergeJobApplications,
  persistLocalJobApplications,
  removeLocalJobApplication,
} from "@/lib/job-applications-local"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  createLocalTrackedRunRecord,
  loadLocalTrackedRuns,
  mergeTrackedRuns,
  persistLocalTrackedRuns,
  removeLocalTrackedRun,
  updateTrackedRunScoreLocally,
} from "@/lib/tracked-runs-local"
import {
  buildTrackedRunLabel,
  extractTrackedRunFileName,
  type SaveTrackedRunInput,
  type TrackedRunRecord,
  type TrackedRunMode,
} from "@/lib/tracked-runs"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ATS_LOADING_MIN_DURATION_MS = 11000
const HISTORY_LIMIT = 24
const TRACKED_RUNS_STORAGE_NOTICE =
  "Cloud dashboard storage needs the latest Supabase schema. Using local browser history for now."
const JOB_APPLICATIONS_STORAGE_NOTICE =
  "Job tracker cloud storage needs the latest Supabase schema. Using local browser history for now."

type AppMode = "dashboard" | "job-tracker" | TrackedRunMode

const WebGLShader = dynamic(
  () => import("@/components/webgl-shader").then((mod) => mod.WebGLShader),
  { ssr: false, loading: () => null }
)

const supabase = getSupabaseBrowserClient()

function normalizeTrackedRun(record: Record<string, unknown>): TrackedRunRecord {
  return {
    id: String(record.id),
    user_id: String(record.user_id),
    mode: record.mode === "ats-score" ? "ats-score" : "generate",
    label: String(record.label),
    job_description: typeof record.job_description === "string" ? record.job_description : null,
    resume_content: typeof record.resume_content === "string" ? record.resume_content : "",
    resume_file_name:
      typeof record.resume_file_name === "string" ? record.resume_file_name : null,
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

function normalizeJobApplication(record: Record<string, unknown>): JobApplicationRecord {
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

function isMissingTrackedRunsTable(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("tracked_runs") ||
    error?.message?.includes("schema cache") ||
    false
  )
}

function isMissingJobApplicationsTable(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("job_applications") ||
    error?.message?.includes("schema cache") ||
    false
  )
}

export default function HomePage() {
  const atsRequestIdRef = useRef(0)
  const jobApplicationSaveTimersRef = useRef<Record<string, number>>({})
  const outputPanelRef = useRef<HTMLDivElement | null>(null)
  const savedAtsRunIdRef = useRef<string | null>(null)

  const [mode, setMode] = useState<AppMode>("generate")
  const [jobDescription, setJobDescription] = useState("")
  const [resumeContent, setResumeContent] = useState("")
  const [resumeFileName, setResumeFileName] = useState("")
  const [resumeFileMimeType, setResumeFileMimeType] = useState("")
  const [resumeFileDataUrl, setResumeFileDataUrl] = useState("")
  const [extraInstructions, setExtraInstructions] = useState("")
  const [latexContent, setLatexContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [atsScore, setAtsScore] = useState<ATSScoreResponse | null>(null)
  const [isScoring, setIsScoring] = useState(false)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [hasLoadedAIInsights, setHasLoadedAIInsights] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [legalDialog, setLegalDialog] = useState<"privacy" | "terms" | null>(null)
  const [historyItems, setHistoryItems] = useState<TrackedRunRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const [storageNotice, setStorageNotice] = useState<string | null>(null)
  const [jobApplications, setJobApplications] = useState<JobApplicationRecord[]>([])
  const [jobApplicationsLoading, setJobApplicationsLoading] = useState(false)
  const [savingJobApplicationId, setSavingJobApplicationId] = useState<string | null>(null)
  const [deletingJobApplicationId, setDeletingJobApplicationId] = useState<string | null>(null)
  const [jobApplicationsNotice, setJobApplicationsNotice] = useState<string | null>(null)

  const pageContainerClass = "mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-10 xl:px-12"
  const panelShellClass =
    "w-full min-w-0 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.16),rgba(3,7,18,0.06))] p-4 sm:rounded-[28px] sm:p-5 md:basis-0 md:flex-1 lg:p-6 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm flex flex-col overflow-hidden min-h-[34rem] sm:min-h-[38rem] md:min-h-0"

  useEffect(() => {
    if (!authMessage) return

    const timer = window.setTimeout(() => setAuthMessage(null), 4500)
    return () => window.clearTimeout(timer)
  }, [authMessage])

  useEffect(() => {
    return () => {
      Object.values(jobApplicationSaveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId)
      })
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let active = true

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return

        if (sessionError) {
          setAuthMessage(sessionError.message)
        }

        setSession(data.session ?? null)
        setAuthLoading(false)
      })
      .catch((sessionError: unknown) => {
        if (!active) return
        setAuthLoading(false)
        setAuthMessage(sessionError instanceof Error ? sessionError.message : "Failed to load session")
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const scrollToOutputOnMobile = () => {
    if (typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 767px)").matches) return

    window.requestAnimationFrame(() => {
      outputPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  const userName =
    (session?.user.user_metadata?.full_name as string | undefined) ||
    (session?.user.user_metadata?.name as string | undefined) ||
    null

  const upsertHistoryRecord = (record: TrackedRunRecord) => {
    setHistoryItems((prev) => {
      const next = [record, ...prev.filter((item) => item.id !== record.id)].slice(0, HISTORY_LIMIT)
      return next
    })
    setSelectedHistoryRunId(record.id)
  }

  const loadHistory = async (userId: string) => {
    const localHistory = loadLocalTrackedRuns(userId)
    if (localHistory.length > 0) {
      setHistoryItems(localHistory)
      setSelectedHistoryRunId((current) => current ?? localHistory[0]?.id ?? null)
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

    const normalized = ((data ?? []) as Record<string, unknown>[]).map(normalizeTrackedRun)
    const merged = mergeTrackedRuns(normalized, localHistory, HISTORY_LIMIT)
    persistLocalTrackedRuns(userId, merged)
    setHistoryItems(merged)
    setSelectedHistoryRunId((current) => current ?? merged[0]?.id ?? null)
    setHistoryLoading(false)
    setStorageNotice(null)
  }

  const loadJobApplications = async (userId: string) => {
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
        setAuthMessage(`Failed to load job tracker: ${applicationsError.message}`)
      }
      setJobApplicationsLoading(false)
      return
    }

    const normalized = sortJobApplications(
      ((data ?? []) as Record<string, unknown>[]).map(normalizeJobApplication)
    )
    const merged = mergeJobApplications(normalized, localApplications)
    persistLocalJobApplications(userId, merged)
    setJobApplications(merged)
    setJobApplicationsNotice(null)
    setJobApplicationsLoading(false)
  }

  useEffect(() => {
    if (!session?.user?.id) {
      savedAtsRunIdRef.current = null
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
  }, [session?.user?.id])

  const saveTrackedRun = async (input: SaveTrackedRunInput) => {
    if (!session?.user?.id) return null

    const label = buildTrackedRunLabel(input)
    const localRecord = createLocalTrackedRunRecord(session.user.id, input, label)

    const payload = {
      user_id: session.user.id,
      mode: input.mode,
      label,
      job_description: input.jobDescription || null,
      resume_content: input.resumeContent,
      resume_file_name: input.sourceFileName?.trim() || null,
      resume_file_mime_type: input.sourceFileMimeType?.trim() || null,
      resume_file_data_url: input.sourceFileDataUrl?.trim() || null,
      extra_instructions: input.extraInstructions?.trim() ? input.extraInstructions.trim() : null,
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

      const localOnlyHistory = mergeTrackedRuns(
        [localRecord],
        loadLocalTrackedRuns(session.user.id),
        HISTORY_LIMIT
      )
      persistLocalTrackedRuns(session.user.id, localOnlyHistory)
      upsertHistoryRecord(localRecord)
      return localRecord.id
    }

    const normalized = normalizeTrackedRun(data as Record<string, unknown>)
    const merged = mergeTrackedRuns([normalized], loadLocalTrackedRuns(session.user.id), HISTORY_LIMIT)
    persistLocalTrackedRuns(session.user.id, merged)
    upsertHistoryRecord(normalized)
    setStorageNotice(null)
    return normalized.id
  }

  const updateTrackedRunScore = async (runId: string, score: ATSScoreResponse) => {
    if (!session?.user?.id) return

    const localRecords = loadLocalTrackedRuns(session.user.id)
    const localUpdate = updateTrackedRunScoreLocally(localRecords, runId, score)

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
        setAuthMessage(`Saved score could not be refreshed: ${updateError.message}`)
      }
      return
    }

    if (data) {
      const normalized = normalizeTrackedRun(data as Record<string, unknown>)
      const merged = mergeTrackedRuns([normalized], loadLocalTrackedRuns(session.user.id), HISTORY_LIMIT)
      persistLocalTrackedRuns(session.user.id, merged)
      upsertHistoryRecord(normalized)
      setStorageNotice(null)
    }
  }

  const prefetchATSInsights = async (
    input: { jobDescription: string; resumeContent: string; extraInstructions: string },
    requestId: number
  ) => {
    setIsLoadingInsights(true)

    try {
      const response = await fetch("/api/ats-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: input.jobDescription,
          resumeContent: input.resumeContent,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || "Failed to load AI insights")
      }

      const data = (await response.json()) as ATSScoreResponse

      if (atsRequestIdRef.current !== requestId) return

      setAtsScore(data)
      setHasLoadedAIInsights(true)

      if (savedAtsRunIdRef.current) {
        await updateTrackedRunScore(savedAtsRunIdRef.current, data)
      }
    } catch (prefetchError) {
      if (atsRequestIdRef.current !== requestId) return
      console.warn("ATS insights prefetch error:", prefetchError)
    } finally {
      if (atsRequestIdRef.current === requestId) {
        setIsLoadingInsights(false)
      }
    }
  }

  const handleGenerate = async (formData: FormData) => {
    scrollToOutputOnMobile()
    setIsGenerating(true)
    setLatexContent("")
    setAtsScore(null)
    setHasLoadedAIInsights(false)
    setError(null)
    setStatusMessage("Preparing request...")
    savedAtsRunIdRef.current = null

    try {
      const jd = (formData.get("jobDescription") as string | null)?.trim() || ""
      const resume = (formData.get("resumeContent") as string | null)?.trim() || ""
      const additional = (formData.get("extraInstructions") as string | null)?.trim() || ""

      if (!jd || !resume) {
        throw new Error("Job description and resume content are required.")
      }

      if (resume.length > MAX_FILE_SIZE) {
        throw new Error("Resume content is too large. Please reduce the size.")
      }

      setStatusMessage("Generating optimized resume...")

      const response = await fetch("/api/generate-resume", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || "Failed to generate resume")
      }

      const data = await response.json()
      const latex = data?.latex || ""

      if (!latex) {
        throw new Error("AI returned empty response")
      }

      setLatexContent(latex)
      setStatusMessage("")

      if (session?.user?.id) {
        const savedRunId = await saveTrackedRun({
          mode: "generate",
          jobDescription: jd,
          resumeContent: resume,
          sourceFileName: resumeFileName,
          sourceFileMimeType: resumeFileMimeType,
          sourceFileDataUrl: resumeFileDataUrl,
          extraInstructions: additional,
          latexContent: latex,
        })

        if (savedRunId) {
          setAuthMessage("Resume saved to your account.")
        }
      }
    } catch (generationError) {
      console.error("Generation error:", generationError)
      const message =
        generationError instanceof Error ? generationError.message : "Failed to generate resume"
      setError(message)
      setLatexContent(`% Error: ${message}\n% Please try again`)
      setStatusMessage("")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleATSScore = async (formData: FormData) => {
    scrollToOutputOnMobile()
    const requestId = atsRequestIdRef.current + 1
    atsRequestIdRef.current = requestId
    savedAtsRunIdRef.current = null

    const startedAt = Date.now()

    setIsScoring(true)
    setIsLoadingInsights(false)
    setLatexContent("")
    setAtsScore(null)
    setError(null)
    setHasLoadedAIInsights(false)

    try {
      const jd = (formData.get("jobDescription") as string | null)?.trim() || ""
      const resume = (formData.get("resumeContent") as string | null)?.trim() || ""
      const additional = (formData.get("extraInstructions") as string | null)?.trim() || ""

      if (!resume) {
        throw new Error("Resume content is required.")
      }

      const response = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd, resumeContent: resume }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || "Failed to score resume")
      }

      const data = (await response.json()) as ATSScoreResponse
      const input = { jobDescription: jd, resumeContent: resume, extraInstructions: additional }
      const elapsed = Date.now() - startedAt
      const remainingDelay = Math.max(0, ATS_LOADING_MIN_DURATION_MS - elapsed)

      if (remainingDelay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingDelay))
      }

      setAtsScore(data)

      if (session?.user?.id) {
        const savedRunId = await saveTrackedRun({
          mode: "ats-score",
          jobDescription: jd,
          resumeContent: resume,
          sourceFileName: resumeFileName,
          sourceFileMimeType: resumeFileMimeType,
          sourceFileDataUrl: resumeFileDataUrl,
          extraInstructions: additional,
          atsScore: data,
        })

        savedAtsRunIdRef.current = savedRunId

        if (savedRunId) {
          setAuthMessage("ATS score saved to your account.")
        }
      }

      void prefetchATSInsights(input, requestId)
    } catch (scoringError) {
      console.error("Scoring error:", scoringError)
      const message = scoringError instanceof Error ? scoringError.message : "Failed to score resume"
      setError(message)
    } finally {
      setIsScoring(false)
    }
  }

  const handleSignInWithGoogle = async () => {
    if (!supabase) {
      setAuthMessage("Supabase is not configured yet.")
      return
    }

    setAuthLoading(true)
    setAuthMessage(null)

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : process.env.NEXT_PUBLIC_APP_URL

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })

    if (signInError) {
      setAuthLoading(false)
      setAuthMessage(signInError.message)
    }
  }

  const handleSignOut = async () => {
    if (!supabase) return

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setAuthMessage(signOutError.message)
      return
    }

    setAuthMessage("Signed out. Guest mode is still available.")
  }

  const handleLoadRunFromDashboard = (run: TrackedRunRecord) => {
    setMode(run.mode)
    setJobDescription(run.job_description ?? "")
    setResumeContent(run.resume_content)
    setResumeFileName(run.resume_file_name ?? extractTrackedRunFileName(run.label) ?? "")
    setResumeFileMimeType(run.resume_file_mime_type ?? "")
    setResumeFileDataUrl(run.resume_file_data_url ?? "")
    setExtraInstructions(run.extra_instructions ?? "")
    setLatexContent(run.mode === "generate" ? run.latex_content ?? "" : "")
    setAtsScore(run.mode === "ats-score" ? run.ats_score : null)
    setHasLoadedAIInsights(Boolean(run.mode === "ats-score" && run.ats_score))
    setIsLoadingInsights(false)
    setIsGenerating(false)
    setIsScoring(false)
    setStatusMessage("")
    setError(null)
    savedAtsRunIdRef.current = run.mode === "ats-score" ? run.id : null
    scrollToOutputOnMobile()
  }

  const handleDeleteRun = async (runId: string) => {
    if (!session?.user?.id) return

    setDeletingRunId(runId)

    const localNext = removeLocalTrackedRun(session.user.id, runId)
    setHistoryItems(localNext)
    setSelectedHistoryRunId((current) => {
      if (current !== runId) return current
      return localNext[0]?.id ?? null
    })

    if (savedAtsRunIdRef.current === runId) {
      savedAtsRunIdRef.current = null
    }

    if (!supabase) {
      setDeletingRunId(null)
      return
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
  }

  const upsertJobApplicationRecord = async (record: JobApplicationRecord) => {
    if (!session?.user?.id) return

    setSavingJobApplicationId(record.id)

    if (!supabase) {
      setSavingJobApplicationId(null)
      return
    }

    const payload = {
      id: record.id,
      user_id: session.user.id,
      company: record.company.trim() || "",
      position: record.position?.trim() ? record.position.trim() : null,
      stage: record.stage,
      job_link: record.job_link?.trim() ? record.job_link.trim() : null,
      resume_file_name: record.resume_file_name?.trim() ? record.resume_file_name.trim() : null,
      resume_file_mime_type:
        record.resume_file_mime_type?.trim() ? record.resume_file_mime_type.trim() : null,
      resume_file_data_url:
        record.resume_file_data_url?.trim() ? record.resume_file_data_url.trim() : null,
      applied_on: formatJobApplicationDateForStorage(record.applied_on),
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
      setSavingJobApplicationId((current) => (current === record.id ? null : current))
      return
    }

    const normalized = normalizeJobApplication(data as Record<string, unknown>)
    setJobApplications((prev) => {
      const merged = mergeJobApplications([normalized], prev)
      persistLocalJobApplications(session.user.id, merged)
      return merged
    })
    setJobApplicationsNotice(null)
    setSavingJobApplicationId((current) => (current === record.id ? null : current))
  }

  const scheduleJobApplicationSave = (record: JobApplicationRecord, delay = 450) => {
    if (typeof window === "undefined") return

    const existingTimer = jobApplicationSaveTimersRef.current[record.id]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }

    jobApplicationSaveTimersRef.current[record.id] = window.setTimeout(() => {
      delete jobApplicationSaveTimersRef.current[record.id]
      void upsertJobApplicationRecord(record)
    }, delay)
  }

  const handleAddJobApplication = () => {
    if (!session?.user?.id) {
      setIsAuthDialogOpen(true)
      return
    }

    const draft = createJobApplicationDraft(session.user.id)
    setJobApplications((prev) => {
      const next = mergeJobApplications([draft], prev)
      persistLocalJobApplications(session.user.id, next)
      return next
    })
    scheduleJobApplicationSave(draft, 0)
  }

  const handleUpdateJobApplication = (
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
  }

  const handleDeleteJobApplication = async (applicationId: string) => {
    if (!session?.user?.id) return

    const existingTimer = jobApplicationSaveTimersRef.current[applicationId]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
      delete jobApplicationSaveTimersRef.current[applicationId]
    }

    setDeletingJobApplicationId(applicationId)

    const localNext = removeLocalJobApplication(session.user.id, applicationId)
    setJobApplications(localNext)

    if (!supabase) {
      setDeletingJobApplicationId(null)
      return
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
        setAuthMessage(`Failed to remove job application: ${deleteError.message}`)
      }
    } else {
      setJobApplicationsNotice(null)
    }

    setDeletingJobApplicationId(null)
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#030712] md:h-screen md:overflow-hidden">
      <div className="fixed inset-0 h-full w-full">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#020202_0%,#050505_45%,#020202_100%)]" />
        <WebGLShader />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.38))]" />
      </div>

      <div className={cn("relative z-10 flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between lg:pt-5", pageContainerClass)}>
        <div className="w-full rounded-full border border-white/12 bg-black/25 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:w-fit">
          <div className="flex items-stretch gap-2">
            <Button
              type="button"
              variant="cool"
              size="sm"
              aria-pressed={mode === "dashboard"}
              onClick={() => setMode("dashboard")}
              className={cn(
                "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
                mode === "dashboard"
                  ? "shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                  : "opacity-60 saturate-50 shadow-none hover:opacity-100"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-xs font-medium sm:text-sm">Dashboard</span>
            </Button>
            <Button
              type="button"
              variant="cool"
              size="sm"
              aria-pressed={mode === "generate"}
              onClick={() => setMode("generate")}
              className={cn(
                "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
                mode === "generate"
                  ? "shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                  : "opacity-60 saturate-50 shadow-none hover:opacity-100"
              )}
            >
              <FileCode2 className="h-4 w-4" />
              <span className="text-xs font-medium sm:text-sm">LaTeX Generator</span>
            </Button>
            <Button
              type="button"
              variant="cool"
              size="sm"
              aria-pressed={mode === "ats-score"}
              onClick={() => setMode("ats-score")}
              className={cn(
                "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
                mode === "ats-score"
                  ? "shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                  : "opacity-60 saturate-50 shadow-none hover:opacity-100"
              )}
            >
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium sm:text-sm">ATS Score</span>
            </Button>
            <Button
              type="button"
              variant="cool"
              size="sm"
              aria-pressed={mode === "job-tracker"}
              onClick={() => setMode("job-tracker")}
              className={cn(
                "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
                mode === "job-tracker"
                  ? "shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                  : "opacity-60 saturate-50 shadow-none hover:opacity-100"
              )}
            >
              <BriefcaseBusiness className="h-4 w-4" />
              <span className="text-xs font-medium sm:text-sm">Job Tracker</span>
            </Button>
          </div>
        </div>

        <div className="w-full rounded-full border border-white/12 bg-black/25 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:w-fit">
          <div className="flex items-stretch gap-2">
            {session?.user?.email ? (
              <>
                <Button
                  type="button"
                  variant="cool"
                  size="sm"
                  onClick={() => setIsAuthDialogOpen(true)}
                  className="flex-1 rounded-full px-3 text-xs shadow-[0_10px_24px_rgba(34,197,94,0.28)] sm:flex-none sm:px-4 sm:text-sm"
                >
                  <UserRound className="h-4 w-4" />
                  <span className="text-xs font-medium sm:text-sm">Account</span>
                </Button>
                <Button
                  type="button"
                  variant="cool"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex-1 rounded-full px-3 text-xs shadow-[0_10px_24px_rgba(34,197,94,0.28)] sm:flex-none sm:px-4 sm:text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-xs font-medium sm:text-sm">Logout</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="cool"
                  size="sm"
                  onClick={() => setIsAuthDialogOpen(true)}
                  className="flex-1 rounded-full px-3 text-xs shadow-[0_10px_24px_rgba(34,197,94,0.28)] sm:flex-none sm:px-4 sm:text-sm"
                >
                  <span className="text-xs font-medium sm:text-sm">Login</span>
                </Button>
                <Button
                  type="button"
                  variant="cool"
                  size="sm"
                  onClick={() => setIsAuthDialogOpen(true)}
                  className="flex-1 rounded-full px-3 text-xs shadow-[0_10px_24px_rgba(34,197,94,0.28)] sm:flex-none sm:px-4 sm:text-sm"
                >
                  <span className="text-xs font-medium sm:text-sm">Signup</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className={cn("relative z-10 mt-3 flex items-start justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.2)] backdrop-blur-xl", pageContainerClass)}>
          <p className="flex-1 text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-300 transition-colors hover:text-red-200"
            aria-label="Close error"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      <div className={cn("relative z-10 flex min-h-0 flex-1 min-w-0 flex-col gap-4 overflow-y-auto pb-4 pt-4 md:overflow-hidden lg:gap-6 lg:pb-6", pageContainerClass)}>
        {mode === "dashboard" ? (
          <div className={cn(panelShellClass, "md:basis-auto md:flex-auto")}>
            <DashboardPanel
              authAvailable={Boolean(supabase)}
              isAuthenticated={Boolean(session?.user?.id)}
              userEmail={session?.user?.email ?? null}
              userName={userName}
              historyItems={historyItems}
              historyLoading={historyLoading}
              selectedRunId={selectedHistoryRunId}
              deletingRunId={deletingRunId}
              onSelectRun={setSelectedHistoryRunId}
              onLoadRun={handleLoadRunFromDashboard}
              onDeleteRun={handleDeleteRun}
              onOpenAuth={() => setIsAuthDialogOpen(true)}
              storageNotice={storageNotice}
            />
          </div>
        ) : mode === "job-tracker" ? (
          <div className={cn(panelShellClass, "md:basis-auto md:flex-auto")}>
            <JobApplicationsPanel
              authAvailable={Boolean(supabase)}
              isAuthenticated={Boolean(session?.user?.id)}
              storageNotice={jobApplicationsNotice}
              applications={jobApplications}
              applicationsLoading={jobApplicationsLoading}
              savingApplicationId={savingJobApplicationId}
              deletingApplicationId={deletingJobApplicationId}
              onAddApplication={handleAddJobApplication}
              onUpdateApplication={handleUpdateJobApplication}
              onDeleteApplication={handleDeleteJobApplication}
              onOpenAuth={() => setIsAuthDialogOpen(true)}
            />
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-stretch md:overflow-hidden">
            <div className={panelShellClass}>
              <ResumeInputPanel
                onGenerate={mode === "generate" ? handleGenerate : handleATSScore}
                isGenerating={mode === "generate" ? isGenerating : isScoring}
                mode={mode}
                jobDescription={jobDescription}
                resumeContent={resumeContent}
                resumeFileName={resumeFileName}
                resumeFileMimeType={resumeFileMimeType}
                extraInstructions={extraInstructions}
                onJobDescriptionChange={setJobDescription}
                onResumeContentChange={setResumeContent}
                onResumeFileNameChange={setResumeFileName}
                onResumeFileMimeTypeChange={setResumeFileMimeType}
                onResumeFileDataUrlChange={setResumeFileDataUrl}
                onExtraInstructionsChange={setExtraInstructions}
              />
            </div>

            <div ref={outputPanelRef} className={panelShellClass}>
              {mode === "generate" ? (
                <ResumePreviewPanel
                  latexContent={latexContent}
                  isGenerating={isGenerating}
                  statusMessage={statusMessage}
                />
              ) : (
                <ATSScorePanel
                  scoreData={atsScore}
                  isLoading={isScoring}
                  isLoadingInsights={isLoadingInsights}
                  hasLoadedAIInsights={hasLoadedAIInsights}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <AuthDialog
        open={isAuthDialogOpen}
        authAvailable={Boolean(supabase)}
        authLoading={authLoading}
        authMessage={authMessage}
        userEmail={session?.user?.email ?? null}
        onClose={() => setIsAuthDialogOpen(false)}
        onGoogleAuth={handleSignInWithGoogle}
      />

      <LegalDialog
        open={legalDialog !== null}
        variant={legalDialog ?? "privacy"}
        onClose={() => setLegalDialog(null)}
      />

      <footer
        className={cn(
          "relative z-10 flex items-center justify-center gap-3 px-4 pb-4 text-[11px] text-white/24 md:pb-5"
        )}
      >
        <button
          type="button"
          onClick={() => setLegalDialog("privacy")}
          className="transition-colors hover:text-white/50"
        >
          Privacy Policy
        </button>
        <span className="text-white/14">•</span>
        <button
          type="button"
          onClick={() => setLegalDialog("terms")}
          className="transition-colors hover:text-white/50"
        >
          Terms of Service
        </button>
      </footer>
    </div>
  )
}
