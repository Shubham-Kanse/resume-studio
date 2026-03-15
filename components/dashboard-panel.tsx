"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"

import { formatDistanceToNow } from "date-fns"
import {
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  X,
} from "lucide-react"

import { renderATSSection } from "@/components/ats/ats-panel-sections"
import { Button } from "@/components/ui/button"
import { extractTrackedRunFileName } from "@/lib/tracked-runs"
import type { TrackedRunRecord } from "@/lib/tracked-runs"
import { cn } from "@/lib/utils"

interface DashboardPanelProps {
  authAvailable: boolean
  isAuthenticated: boolean
  userEmail: string | null
  userName: string | null
  storageNotice: string | null
  historyItems: TrackedRunRecord[]
  historyLoading: boolean
  selectedRunId: string | null
  deletingRunId: string | null
  onSelectRun: (runId: string) => void
  onLoadRun: (run: TrackedRunRecord) => void
  onDeleteRun: (runId: string) => Promise<void>
  onOpenAuth: () => void
}

type HistoryFilter = "all" | "generate" | "ats-score"
type CopiedField = "jobDescription" | "latex" | null

function displayText(text: string | null | undefined) {
  const value = (text || "").trim()
  return value || "Not available"
}

function getTrackedRunDisplayAtsScore(run: TrackedRunRecord) {
  if (!run.ats_score) return null

  if (run.ats_score.analysisMode === "resume-with-jd") {
    return (
      run.ats_score.standaloneResumeScore ?? run.ats_score.resumeQualityScore
    )
  }

  return run.ats_score.standaloneResumeScore ?? run.ats_score.overallScore
}

function DashboardPanelComponent({
  authAvailable,
  isAuthenticated,
  storageNotice,
  historyItems,
  historyLoading,
  selectedRunId,
  deletingRunId,
  onSelectRun,
  onLoadRun,
  onDeleteRun,
  onOpenAuth,
}: DashboardPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all")
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState<string | null>(
    null
  )
  const [copiedField, setCopiedField] = useState<CopiedField>(null)
  const copyFeedbackTimerRef = useRef<number | null>(null)

  const filteredHistoryItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const nextItems = historyItems.filter((item) => {
      if (historyFilter !== "all" && item.mode !== historyFilter) return false
      if (!normalizedQuery) return true

      const haystack = [
        item.label,
        item.resume_file_name,
        item.job_description,
        item.extra_instructions,
        item.resume_content,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })

    nextItems.sort((left, right) => {
      return (
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime()
      )
    })

    return nextItems
  }, [historyFilter, historyItems, searchQuery])

  const selectedRun =
    filteredHistoryItems.find((item) => item.id === selectedRunId) ??
    filteredHistoryItems[0] ??
    null
  const selectedFileName = selectedRun
    ? selectedRun.resume_file_name ||
      extractTrackedRunFileName(selectedRun.label)
    : null

  useEffect(() => {
    if (!pendingDeleteRunId) return
    if (!historyItems.some((item) => item.id === pendingDeleteRunId)) {
      setPendingDeleteRunId(null)
    }
  }, [historyItems, pendingDeleteRunId])

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        window.clearTimeout(copyFeedbackTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async (
    field: Exclude<CopiedField, null>,
    text: string | null | undefined
  ) => {
    if (!text) return

    await navigator.clipboard.writeText(text)
    setCopiedField(field)

    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current)
    }

    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopiedField(null)
      copyFeedbackTimerRef.current = null
    }, 1200)
  }

  const downloadResumeFile = () => {
    if (!selectedRun?.resume_file_data_url) return

    const anchor = document.createElement("a")
    anchor.href = selectedRun.resume_file_data_url
    anchor.download = selectedFileName || "resume"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View your account details, saved resumes, LaTeX files, and ATS
            checks in one place.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/8 bg-black/12 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <UserRound className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-foreground">
              Sign in to open your dashboard
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Your generator and ATS tools still work without an account. Sign
              in with Google to keep your resume history, saved LaTeX outputs,
              and ATS score checks attached to your account.
            </p>
            <Button
              type="button"
              variant="cool"
              size="lg"
              className="mt-6 rounded-2xl px-8"
              onClick={onOpenAuth}
              disabled={!authAvailable}
            >
              <Sparkles className="h-4 w-4" />
              {authAvailable
                ? "Continue with Google"
                : "Supabase not configured"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View saved resumes, ATS checks, and recent activity.
          </p>
        </div>
      </div>

      {storageNotice ? (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {storageNotice}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/8 bg-black/10 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/55">
                <FileCode2 className="h-3.5 w-3.5 text-primary" />
                Saved history
              </div>
              <span className="text-[11px] text-muted-foreground">
                {filteredHistoryItems.length}/{historyItems.length}
              </span>
            </div>

            <div className="mb-3 space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ["all", "All"],
                    ["generate", "Resumes"],
                    ["ats-score", "ATS"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setHistoryFilter(value)}
                    aria-pressed={historyFilter === value}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      historyFilter === value
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-white/10 bg-transparent text-muted-foreground hover:border-white/18 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}

                {searchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("")
                    }}
                    className="ml-auto text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search runs..."
                  aria-label="Search saved history"
                  className="h-9 w-full rounded-full border border-white/12 bg-black/20 pl-9 pr-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-white/30 focus:border-primary/35 focus:bg-white/[0.04]"
                />
              </div>
            </div>

            {historyLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-muted-foreground">
                Your saved runs will appear here after you generate a resume or
                run an ATS check.
              </div>
            ) : filteredHistoryItems.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-muted-foreground">
                No saved runs match the current search or filters.
              </div>
            ) : (
              <div className="scrollbar-dark flex-1 space-y-3 overflow-y-auto pr-1">
                {filteredHistoryItems.map((run) => {
                  const active = selectedRun?.id === run.id
                  const historyTitle =
                    run.resume_file_name ||
                    extractTrackedRunFileName(run.label) ||
                    "Saved run"
                  const isPendingDelete = pendingDeleteRunId === run.id
                  return (
                    <div
                      key={run.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectRun(run.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onSelectRun(run.id)
                        }
                      }}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-colors outline-none",
                        active
                          ? "border-primary/28 bg-primary/8"
                          : "border-white/8 bg-black/8 hover:border-white/15 hover:bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {historyTitle}
                          </p>
                          <div className="mt-0.5 flex items-center justify-between gap-3">
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(run.created_at), {
                                addSuffix: true,
                              })}
                              {run.mode === "ats-score" &&
                              getTrackedRunDisplayAtsScore(run) !== null
                                ? ` • ATS ${getTrackedRunDisplayAtsScore(run)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={cn(
                            "flex h-full min-h-10 items-center self-stretch px-1 transition-colors disabled:opacity-50",
                            isPendingDelete
                              ? "text-red-400 hover:text-red-300"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          disabled={deletingRunId === run.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (!isPendingDelete) {
                              setPendingDeleteRunId(run.id)
                              return
                            }
                            setPendingDeleteRunId(null)
                            void onDeleteRun(run.id)
                          }}
                          aria-label="Remove saved history item"
                        >
                          {deletingRunId === run.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isPendingDelete ? (
                            <Trash2 className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/8 bg-black/10 p-4">
          {selectedRun ? (
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <div className="border-b border-white/8 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                    {selectedRun.mode === "generate" ? (
                      <FileCode2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Target className="h-3.5 w-3.5 text-primary" />
                    )}
                    {selectedRun.mode === "generate"
                      ? "Generated resume"
                      : "ATS analysis"}
                  </div>
                  <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <h3 className="min-w-0 text-xl font-semibold text-foreground">
                      {selectedRun.label}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full px-4 !bg-transparent !shadow-none !backdrop-blur-none hover:!bg-white/[0.05]"
                        onClick={() => onLoadRun(selectedRun)}
                      >
                        Open in workspace
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full px-4 !bg-transparent !shadow-none !backdrop-blur-none hover:!bg-white/[0.05]"
                        onClick={downloadResumeFile}
                        disabled={!selectedRun.resume_file_data_url}
                      >
                        <Download className="h-4 w-4" />
                        Download resume
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(selectedRun.created_at).toLocaleString()}
                    </span>
                    {selectedRun.ats_score ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 font-medium text-primary">
                        ATS {getTrackedRunDisplayAtsScore(selectedRun) ?? "--"}
                      </span>
                    ) : null}
                    {selectedRun.ats_score &&
                    selectedRun.ats_score.targetRoleScore !== null &&
                    selectedRun.ats_score.targetRoleScore !== undefined ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 font-medium text-primary">
                        Target {selectedRun.ats_score.targetRoleScore}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {selectedRun.mode === "generate" ? (
                <div className="scrollbar-dark mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                  <div className="rounded-xl border border-white/8 bg-black/8 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        Job description
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(
                            "jobDescription",
                            selectedRun.job_description
                          )
                        }
                        disabled={!selectedRun.job_description}
                        className={cn(
                          "rounded-full border p-2 transition-all duration-200 hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                          copiedField === "jobDescription"
                            ? "border-primary/35 bg-primary/10 text-primary scale-105"
                            : "border-white/10 text-muted-foreground"
                        )}
                        aria-label={
                          copiedField === "jobDescription"
                            ? "Job description copied"
                            : "Copy job description"
                        }
                        title={
                          copiedField === "jobDescription"
                            ? "Copied"
                            : "Copy job description"
                        }
                      >
                        {copiedField === "jobDescription" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="scrollbar-dark h-25 overflow-y-auto rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                        {displayText(selectedRun.job_description)}
                      </p>
                    </div>
                  </div>

                  {selectedRun.extra_instructions ? (
                    <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Additional info
                      </div>
                      <div className="scrollbar-dark max-h-40 overflow-y-auto rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                          {displayText(selectedRun.extra_instructions)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/8 bg-black/8 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileCode2 className="h-4 w-4 text-primary" />
                        LaTeX file
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy("latex", selectedRun.latex_content)
                        }
                        disabled={!selectedRun.latex_content}
                        className={cn(
                          "rounded-full border p-2 transition-all duration-200 hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                          copiedField === "latex"
                            ? "border-primary/35 bg-primary/10 text-primary scale-105"
                            : "border-white/10 text-muted-foreground"
                        )}
                        aria-label={
                          copiedField === "latex"
                            ? "LaTeX copied"
                            : "Copy LaTeX"
                        }
                        title={
                          copiedField === "latex" ? "Copied" : "Copy LaTeX"
                        }
                      >
                        {copiedField === "latex" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {selectedRun.latex_content
                        ? "This generated run includes a saved LaTeX output you can reopen, copy, or download."
                        : "No LaTeX file was saved for this run."}
                    </p>
                    <pre className="scrollbar-dark min-h-0 flex-1 overflow-auto rounded-xl border border-white/8 bg-black/20 p-4 text-xs text-muted-foreground">
                      {selectedRun.latex_content ||
                        "No LaTeX content available."}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="scrollbar-dark mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/8 bg-black/8 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        Job description
                      </div>
                      <div className="scrollbar-dark h-25 overflow-y-auto rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                          {displayText(selectedRun.job_description)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {selectedRun.extra_instructions ? (
                    <div className="rounded-xl border border-white/8 bg-black/8 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Additional info
                      </div>
                      <div className="scrollbar-dark max-h-64 overflow-y-auto rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                          {displayText(selectedRun.extra_instructions)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {selectedRun.ats_score ? (
                    <div className="rounded-xl border border-white/8 bg-black/8 p-4">
                      {renderATSSection("breakdown", {
                        scoreData: selectedRun.ats_score,
                        resumeContent: selectedRun.resume_content ?? "",
                        jobDescription: selectedRun.job_description ?? "",
                        nlpAnalysis: null,
                        spellMetrics: null,
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-muted-foreground">
                      No ATS details were saved for this run.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/8 bg-black/10 p-8 text-center text-sm text-muted-foreground">
              {historyItems.length === 0
                ? "No saved runs yet. Generate a resume or run an ATS check to populate your dashboard."
                : "No dashboard item matches the current search or filters."}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export const DashboardPanel = memo(DashboardPanelComponent)
