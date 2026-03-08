"use client"

import { useState, type ChangeEvent } from "react"
import {
  BriefcaseBusiness,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  JOB_APPLICATION_STAGES,
  isJobApplicationDisplayDate,
  normalizeJobApplicationDateInput,
  type JobApplicationRecord,
  type JobApplicationStage,
} from "@/lib/job-applications"
import { cn } from "@/lib/utils"

interface JobApplicationsPanelProps {
  authAvailable: boolean
  isAuthenticated: boolean
  storageNotice: string | null
  applications: JobApplicationRecord[]
  applicationsLoading: boolean
  savingApplicationId: string | null
  deletingApplicationId: string | null
  onAddApplication: () => void
  onUpdateApplication: (
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
  ) => void
  onDeleteApplication: (applicationId: string) => Promise<void>
  onOpenAuth: () => void
}

const MAX_RESUME_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const stageMeta: Record<
  JobApplicationStage,
  {
    chartColor: string
    textClassName: string
  }
> = {
  Applied: {
    chartColor: "#60a5fa",
    textClassName: "text-sky-300",
  },
  Interview: {
    chartColor: "#f472b6",
    textClassName: "text-pink-300",
  },
  Offer: {
    chartColor: "#34d399",
    textClassName: "text-emerald-300",
  },
  Rejected: {
    chartColor: "#f87171",
    textClassName: "text-rose-300",
  },
  "No Answer": {
    chartColor: "#a1a1aa",
    textClassName: "text-zinc-300",
  },
}

function normalizeCompany(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("Failed to read the uploaded file"))
    reader.readAsDataURL(file)
  })
}

export function JobApplicationsPanel({
  authAvailable,
  isAuthenticated,
  storageNotice,
  applications,
  applicationsLoading,
  savingApplicationId,
  deletingApplicationId,
  onAddApplication,
  onUpdateApplication,
  onDeleteApplication,
  onOpenAuth,
}: JobApplicationsPanelProps) {
  const totalApplications = applications.length
  const uniqueCompanies = new Set(
    applications.map((application) => normalizeCompany(application.company)).filter(Boolean)
  ).size
  const interviewCount = applications.filter((application) => application.stage === "Interview").length
  const offerCount = applications.filter((application) => application.stage === "Offer").length
  const stageCounts = JOB_APPLICATION_STAGES.map((stage) => ({
    stage,
    count: applications.filter((application) => application.stage === stage).length,
  }))
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleResumeUpload = async (
    applicationId: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    if (file.size > MAX_RESUME_FILE_SIZE) {
      setUploadError("Resume file is too large. Use a file under 10MB.")
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setUploadError(null)

      onUpdateApplication(applicationId, {
        resume_file_name: file.name,
        resume_file_mime_type: file.type || "",
        resume_file_data_url: dataUrl,
      })
    } catch (error) {
      console.error("Failed to upload application resume:", error)
      setUploadError("Could not read the selected resume file. Try again.")
    }
  }

  const handleRemoveResume = (applicationId: string) => {
    setUploadError(null)
    onUpdateApplication(applicationId, {
      resume_file_name: "",
      resume_file_mime_type: "",
      resume_file_data_url: "",
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">Job Application Tracker</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the companies you have applied to, their current stage, and the exact resume file you used.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/8 bg-black/12 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <UserRound className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-foreground">Sign in to use the tracker</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Resume generation and ATS checks can stay in guest mode. The job application tracker is tied to your account so your application pipeline stays private and persistent.
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
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Job Application Tracker</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your applications, stages, links, and resume files in one editable workspace.
          </p>
        </div>
        {savingApplicationId ? (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Autosaving
            </span>
          </div>
        ) : null}
      </div>

      {storageNotice ? (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {storageNotice}
        </div>
      ) : null}
      {uploadError ? (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {uploadError}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-3">
          <section className="rounded-2xl border border-white/8 bg-black/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Overview</div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-semibold leading-none text-foreground">{totalApplications}</div>
                <div className="mt-2 text-sm text-muted-foreground">Applications tracked</div>
              </div>
              <div className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/45">
                Private
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/8 bg-black/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="space-y-1">
              <div className="flex items-center justify-between rounded-xl px-2 py-2">
                <span className="text-sm text-muted-foreground">Companies</span>
                <span className="text-sm font-medium text-foreground">{uniqueCompanies}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl px-2 py-2">
                <span className="text-sm text-muted-foreground">Interviews</span>
                <span className="text-sm font-medium text-foreground">{interviewCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl px-2 py-2">
                <span className="text-sm text-muted-foreground">Offers</span>
                <span className="text-sm font-medium text-foreground">{offerCount}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/8 bg-black/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-2 px-2 text-[11px] uppercase tracking-[0.18em] text-white/35">By Stage</div>
            <div className="space-y-1">
              {stageCounts.map(({ stage, count }) => (
                <div key={stage} className="flex items-center justify-between rounded-xl px-2 py-2">
                  <span className="inline-flex items-center gap-2 text-sm text-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stageMeta[stage].chartColor }}
                    />
                    {stage}
                  </span>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="flex min-h-0 flex-col rounded-2xl border border-white/8 bg-black/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-4 flex flex-col gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                <BriefcaseBusiness className="h-3.5 w-3.5 text-primary" />
                All applications
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                A clean editable grid. Changes are saved automatically.
              </p>
            </div>
            <Button
              type="button"
              variant="cool"
              size="sm"
              className="rounded-full px-4"
              onClick={onAddApplication}
            >
              <Plus className="h-4 w-4" />
              New application
            </Button>
          </div>

          {applicationsLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/10 p-8 text-center">
              <div>
                <h3 className="text-lg font-semibold text-foreground">No applications yet</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Start with your first row and keep the company, role, date, and resume file attached to one place.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 rounded-full px-5"
                  onClick={onAddApplication}
                >
                  <Plus className="h-4 w-4" />
                  Add first application
                </Button>
              </div>
            </div>
          ) : (
            <div className="scrollbar-dark flex-1 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/8 bg-black/[0.06]">
              <table className="w-full table-fixed border-collapse">
                <thead className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl">
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-white/40">
                    <th className="w-[11%] border-b border-white/8 px-4 py-3 font-medium">Stage</th>
                    <th className="w-[20%] border-b border-white/8 px-4 py-3 font-medium">Company</th>
                    <th className="w-[20%] border-b border-white/8 px-4 py-3 font-medium">Position</th>
                    <th className="w-[21%] border-b border-white/8 px-4 py-3 font-medium">Link</th>
                    <th className="w-[12%] border-b border-white/8 px-4 py-3 font-medium">Resume</th>
                    <th className="w-[10%] border-b border-white/8 px-4 py-3 font-medium">Date</th>
                    <th className="w-[6%] border-b border-white/8 px-2 py-3 font-medium text-center">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr
                      key={application.id}
                      className="group align-top transition-colors hover:bg-white/[0.025]"
                    >
                      <td className="border-b border-white/8 px-4 py-2.5">
                        <div className="relative w-full min-w-0">
                          <select
                            value={application.stage}
                            onChange={(event) =>
                              onUpdateApplication(application.id, {
                                stage: event.target.value as JobApplicationStage,
                              })
                            }
                            className={cn(
                              "h-9 w-full appearance-none bg-transparent px-0 pr-5 text-sm font-medium outline-none transition-colors",
                              stageMeta[application.stage].textClassName
                            )}
                          >
                            {JOB_APPLICATION_STAGES.map((stage) => (
                              <option key={stage} value={stage} className="bg-[#05080f] text-foreground">
                                {stage}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className={cn(
                              "pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 opacity-80",
                              stageMeta[application.stage].textClassName
                            )}
                          />
                        </div>
                      </td>
                      <td className="border-b border-white/8 px-4 py-2.5">
                        <input
                          type="text"
                          value={application.company}
                          onChange={(event) =>
                            onUpdateApplication(application.id, { company: event.target.value })
                          }
                          className="h-10 w-full min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:bg-transparent"
                          placeholder="Company"
                        />
                      </td>
                      <td className="border-b border-white/8 px-4 py-2.5">
                        <input
                          type="text"
                          value={application.position ?? ""}
                          onChange={(event) =>
                            onUpdateApplication(application.id, { position: event.target.value })
                          }
                          className="h-10 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus:bg-transparent"
                          placeholder="Role / position"
                        />
                      </td>
                      <td className="border-b border-white/8 px-4 py-2.5">
                        <div className="relative h-10">
                          <input
                            type="url"
                            value={application.job_link ?? ""}
                            onChange={(event) =>
                              onUpdateApplication(application.id, { job_link: event.target.value })
                            }
                            className="h-10 w-full min-w-0 bg-transparent pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:bg-transparent"
                            placeholder="https://company.com/jobs/..."
                          />
                          {application.job_link ? (
                            <a
                              href={application.job_link}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/28 transition-colors hover:text-primary"
                              aria-label="Open job link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-white/8 px-4 py-2.5">
                        <div className="flex h-10 items-center gap-1.5">
                          <div className="group/file relative">
                            <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/10 bg-transparent text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-white/[0.03]">
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.md,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json"
                                className="hidden"
                                onChange={(event) => void handleResumeUpload(application.id, event)}
                              />
                              {application.resume_file_name ? (
                                <FileText className="h-4 w-4 shrink-0 text-primary" />
                              ) : (
                                <Upload className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover/file:text-primary" />
                              )}
                            </label>
                            <div
                              className={cn(
                                "pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 rounded-lg border border-white/10 bg-black/92 px-2.5 py-1.5 text-xs text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.35)] whitespace-nowrap opacity-0 transition-opacity",
                                application.resume_file_name ? "group-hover/file:opacity-100" : ""
                              )}
                            >
                              {application.resume_file_name || "Upload resume file"}
                            </div>
                          </div>
                          <a
                            href={application.resume_file_data_url || undefined}
                            download={application.resume_file_name || "resume"}
                            className={cn(
                              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-white/28 transition-colors",
                              application.resume_file_data_url
                                ? "hover:border-white/10 hover:bg-white/[0.04] hover:text-primary"
                                : "pointer-events-none opacity-0"
                            )}
                            aria-label="Download uploaded resume"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveResume(application.id)}
                            className={cn(
                              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-white/28 transition-colors",
                              application.resume_file_name
                                ? "hover:border-white/10 hover:bg-white/[0.04] hover:text-foreground"
                                : "pointer-events-none opacity-0"
                            )}
                            aria-label="Remove uploaded resume"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="border-b border-white/8 px-4 py-2.5">
                        <div className="h-10 min-w-0">
                          <input
                            type="text"
                            value={application.applied_on ?? ""}
                            onChange={(event) =>
                              onUpdateApplication(application.id, {
                                applied_on: normalizeJobApplicationDateInput(event.target.value),
                              })
                            }
                            inputMode="numeric"
                            maxLength={8}
                            pattern="^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/\\d{2}$"
                            className={cn(
                              "h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:bg-transparent",
                              application.applied_on && !isJobApplicationDisplayDate(application.applied_on)
                                ? "text-amber-200"
                                : "text-foreground"
                            )}
                            placeholder="DD/MM/YY"
                            aria-label="Application date in DD/MM/YY format"
                            title="Use DD/MM/YY"
                          />
                        </div>
                      </td>
                      <td className="border-b border-white/8 px-2 py-2.5">
                        <div className="flex h-10 items-center justify-center gap-2">
                          {savingApplicationId === application.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 rounded-full p-0"
                            disabled={deletingApplicationId === application.id}
                            onClick={() => void onDeleteApplication(application.id)}
                            aria-label="Delete application"
                          >
                            {deletingApplicationId === application.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
