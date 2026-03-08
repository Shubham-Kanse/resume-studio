"use client"

import { formatDistanceToNow } from "date-fns"
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Copy,
  Trash2,
  Download,
  FileCode2,
  FileText,
  History,
  Loader2,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react"
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

function initialsFromUser(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "RS"
  const parts = source.split(/[\s@._-]+/).filter(Boolean)

  if (parts.length === 0) return "RS"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function clip(text: string | null | undefined, max = 220) {
  const value = (text || "").replace(/\s+/g, " ").trim()
  if (!value) return "Not available"
  if (value.length <= max) return value
  return `${value.slice(0, max - 3)}...`
}

export function DashboardPanel({
  authAvailable,
  isAuthenticated,
  userEmail,
  userName,
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
  const selectedRun = historyItems.find((item) => item.id === selectedRunId) ?? historyItems[0] ?? null
  const generatedRuns = historyItems.filter((item) => item.mode === "generate")
  const atsRuns = historyItems.filter((item) => item.mode === "ats-score")
  const selectedFileName = selectedRun
    ? selectedRun.resume_file_name || extractTrackedRunFileName(selectedRun.label)
    : null
  const avgAtsScore =
    atsRuns.length > 0
      ? Math.round(
          atsRuns.reduce((sum, item) => sum + (item.ats_score?.overallScore ?? 0), 0) / atsRuns.length
        )
      : null

  const copyLatex = async () => {
    if (!selectedRun?.latex_content) return
    await navigator.clipboard.writeText(selectedRun.latex_content)
  }

  const downloadLatex = () => {
    if (!selectedRun?.latex_content) return

    const blob = new Blob([selectedRun.latex_content], { type: "text/x-latex" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "resume.tex"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
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
            View your account details, saved resumes, LaTeX files, and ATS checks in one place.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/8 bg-black/12 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <UserRound className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-foreground">Sign in to open your dashboard</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Your generator and ATS tools still work without an account. Sign in with Google to keep your resume history, saved LaTeX outputs, and ATS score checks attached to your account.
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
              {authAvailable ? "Continue with Google" : "Supabase not configured"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review account details, past resume generations, saved LaTeX outputs, and ATS score history.
        </p>
        {storageNotice ? (
          <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {storageNotice}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <section className="rounded-2xl border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-foreground">
                {initialsFromUser(userName, userEmail)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{userName || "Resume Studio User"}</p>
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                <FileCode2 className="h-3.5 w-3.5 text-primary" />
                Resumes
              </div>
              <p className="mt-3 text-3xl font-semibold text-foreground">{generatedRuns.length}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                <Target className="h-3.5 w-3.5 text-primary" />
                ATS Checks
              </div>
              <p className="mt-3 text-3xl font-semibold text-foreground">{atsRuns.length}</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Average ATS
              </div>
              <p className="mt-3 text-3xl font-semibold text-foreground">{avgAtsScore ?? "--"}</p>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Saved history</h3>
            </div>

            {historyLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-muted-foreground">
                Your saved runs will appear here after you generate a resume or run an ATS check.
              </div>
            ) : (
              <div className="scrollbar-dark flex-1 space-y-3 overflow-y-auto pr-1">
                {historyItems.map((run) => {
                  const active = selectedRun?.id === run.id
                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => onSelectRun(run.id)}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition-colors",
                        active
                          ? "border-primary/30 bg-primary/10 shadow-[0_10px_24px_rgba(34,197,94,0.14)]"
                          : "border-white/8 bg-black/8 hover:border-white/15 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{run.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[11px] text-foreground/80">
                          {run.mode === "generate" ? "Resume" : "ATS"}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-full p-0"
                          disabled={deletingRunId === run.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            void onDeleteRun(run.id)
                          }}
                          aria-label="Remove saved history item"
                        >
                          {deletingRunId === run.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <section className="flex min-h-0 flex-col rounded-2xl border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {selectedRun ? (
            <>
              <div className="flex flex-col gap-4 border-b border-white/8 pb-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                    {selectedRun.mode === "generate" ? (
                      <FileCode2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Target className="h-3.5 w-3.5 text-primary" />
                    )}
                    {selectedRun.mode === "generate" ? "Generated resume" : "ATS analysis"}
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">{selectedRun.label}</h3>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(selectedRun.created_at).toLocaleString()}
                    </span>
                    {selectedRun.ats_score ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 font-medium text-primary">
                        ATS {selectedRun.ats_score.overallScore}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="cool"
                    size="sm"
                    className="rounded-full px-4"
                    onClick={() => onLoadRun(selectedRun)}
                  >
                    Open in workspace
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {selectedRun.latex_content ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={() => void copyLatex()}
                      >
                        <Copy className="h-4 w-4" />
                        Copy LaTeX
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full px-4"
                        onClick={downloadLatex}
                      >
                        <Download className="h-4 w-4" />
                        Download .tex
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

                <div className="scrollbar-dark mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      Resume file
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {selectedFileName || "No uploaded file name was saved for this run."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 rounded-full px-4"
                      onClick={downloadResumeFile}
                      disabled={!selectedRun.resume_file_data_url}
                    >
                      <Download className="h-4 w-4" />
                      Download resume
                    </Button>
                    {!selectedRun.resume_file_data_url ? (
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        This saved run does not include the original uploaded file, so only its metadata is available.
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      Job description
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{clip(selectedRun.job_description)}</p>
                  </div>
                  {selectedRun.extra_instructions ? (
                    <div className="rounded-2xl border border-white/8 bg-black/10 p-4 xl:col-span-2">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Additional info
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {clip(selectedRun.extra_instructions, 320)}
                      </p>
                    </div>
                  ) : null}
                </div>

                {selectedRun.mode === "generate" ? (
                  <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileCode2 className="h-4 w-4 text-primary" />
                      LaTeX file
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      {selectedRun.latex_content
                        ? "This generated run includes a saved LaTeX output you can reopen, copy, or download."
                        : "No LaTeX file was saved for this run."}
                    </p>
                    <pre className="scrollbar-dark max-h-80 overflow-auto rounded-xl border border-white/8 bg-black/20 p-4 text-xs text-muted-foreground">
                      {selectedRun.latex_content || "No LaTeX content available."}
                    </pre>
                  </div>
                ) : selectedRun.ats_score ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">Overall</div>
                        <div className="mt-3 text-3xl font-semibold text-foreground">
                          {selectedRun.ats_score.overallScore}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">Resume ATS</div>
                        <div className="mt-3 text-3xl font-semibold text-foreground">
                          {selectedRun.ats_score.resumeQualityScore}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">Target role</div>
                        <div className="mt-3 text-3xl font-semibold text-foreground">
                          {selectedRun.ats_score.targetRoleScore ?? "--"}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Target className="h-4 w-4 text-primary" />
                          Strengths
                        </div>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {selectedRun.ats_score.keyFindings.strengths.slice(0, 5).map((item, index) => (
                            <li key={`${item}-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          Weaknesses
                        </div>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {selectedRun.ats_score.keyFindings.weaknesses.slice(0, 5).map((item, index) => (
                            <li key={`${item}-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-muted-foreground">
                    No ATS details were saved for this run.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/8 bg-black/10 p-8 text-center text-sm text-muted-foreground">
              No saved runs yet. Generate a resume or run an ATS check to populate your dashboard.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
