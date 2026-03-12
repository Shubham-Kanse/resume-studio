"use client"

import { memo, useEffect, useMemo, useState, type ChangeEvent } from "react"

import {
  BriefcaseBusiness,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  JOB_APPLICATION_STAGES,
  formatJobApplicationDateForStorage,
  isJobApplicationDisplayDate,
  normalizeJobApplicationDateInput,
  type JobApplicationRecord,
  type JobApplicationStage,
} from "@/lib/job-applications"
import { cn } from "@/lib/utils"

interface JobApplicationsPanelProps {
  authAvailable: boolean
  isAuthenticated: boolean
  canTrackJobs: boolean
  canEditJobs: boolean
  storageNotice: string | null
  applications: JobApplicationRecord[]
  applicationsLoading: boolean
  savingApplicationId: string | null
  deletingApplicationId: string | null
  onAddApplication: () => void
  onUpgradeToPro: () => void
  onLockedInteraction: () => void
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
type JobApplicationSort = "newest" | "oldest" | "company"

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
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("Failed to read the uploaded file"))
    reader.readAsDataURL(file)
  })
}

function JobApplicationsPanelComponent({
  authAvailable,
  isAuthenticated,
  canTrackJobs,
  canEditJobs,
  storageNotice,
  applications,
  applicationsLoading,
  savingApplicationId,
  deletingApplicationId,
  onAddApplication,
  onUpgradeToPro,
  onLockedInteraction,
  onUpdateApplication,
  onDeleteApplication,
  onOpenAuth,
}: JobApplicationsPanelProps) {
  const totalApplications = applications.length
  const uniqueCompanies = new Set(
    applications
      .map((application) => normalizeCompany(application.company))
      .filter(Boolean)
  ).size
  const interviewCount = applications.filter(
    (application) => application.stage === "Interview"
  ).length
  const offerCount = applications.filter(
    (application) => application.stage === "Offer"
  ).length
  const stageCounts = JOB_APPLICATION_STAGES.map((stage) => ({
    stage,
    count: applications.filter((application) => application.stage === stage)
      .length,
  }))
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [stageFilter, setStageFilter] = useState<JobApplicationStage | "all">(
    "all"
  )
  const [sortOrder, setSortOrder] = useState<JobApplicationSort>("newest")
  const [pendingDeleteApplicationId, setPendingDeleteApplicationId] = useState<
    string | null
  >(null)
  const handleAddApplicationIntent = () => {
    if (!isAuthenticated) {
      onOpenAuth()
      return
    }

    if (!canTrackJobs) {
      onUpgradeToPro()
      return
    }

    onAddApplication()
  }
  const handleLockedInteraction = () => {
    if (!isAuthenticated) {
      onOpenAuth()
      return
    }

    onLockedInteraction()
  }

  const filteredApplications = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const nextItems = applications.filter((application) => {
      if (stageFilter !== "all" && application.stage !== stageFilter)
        return false
      if (!normalizedQuery) return true

      const haystack = [
        application.company,
        application.position,
        application.stage,
        application.job_link,
        application.resume_file_name,
        application.applied_on,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })

    nextItems.sort((left, right) => {
      if (sortOrder === "company") {
        const companyComparison = left.company.localeCompare(
          right.company,
          undefined,
          {
            sensitivity: "base",
          }
        )

        if (companyComparison !== 0) return companyComparison
      }

      const appliedLeft = formatJobApplicationDateForStorage(left.applied_on)
      const appliedRight = formatJobApplicationDateForStorage(right.applied_on)
      const leftTime = appliedLeft
        ? new Date(`${appliedLeft}T00:00:00Z`).getTime()
        : 0
      const rightTime = appliedRight
        ? new Date(`${appliedRight}T00:00:00Z`).getTime()
        : 0

      if (leftTime !== rightTime) {
        return sortOrder === "oldest"
          ? leftTime - rightTime
          : rightTime - leftTime
      }

      const updatedDelta =
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime()

      if (updatedDelta !== 0) {
        return sortOrder === "oldest" ? -updatedDelta : updatedDelta
      }

      return left.company.localeCompare(right.company, undefined, {
        sensitivity: "base",
      })
    })

    return nextItems
  }, [applications, searchQuery, sortOrder, stageFilter])

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    stageFilter !== "all" ||
    sortOrder !== "newest"

  useEffect(() => {
    if (!pendingDeleteApplicationId) return
    if (
      !applications.some(
        (application) => application.id === pendingDeleteApplicationId
      )
    ) {
      setPendingDeleteApplicationId(null)
    }
  }, [applications, pendingDeleteApplicationId])

  const handleResumeUpload = async (
    applicationId: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    if (!canEditJobs) {
      event.target.value = ""
      handleLockedInteraction()
      return
    }

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
    if (!canEditJobs) {
      handleLockedInteraction()
      return
    }

    setUploadError(null)
    onUpdateApplication(applicationId, {
      resume_file_name: "",
      resume_file_mime_type: "",
      resume_file_data_url: "",
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Job Application Tracker
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAuthenticated
              ? canTrackJobs
                ? "Keep your applications, stages, links, and resume files in one editable workspace."
                : "Preview the tracker layout now. Get Pro to track your jobs in one place."
              : "Preview the tracker layout now. Sign in when you want to save and manage applications."}
          </p>
        </div>
        {isAuthenticated && savingApplicationId ? (
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
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
              Overview
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-4xl font-semibold leading-none text-foreground">
                  {totalApplications}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Applications tracked
                </div>
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
                <span className="text-sm font-medium text-foreground">
                  {uniqueCompanies}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl px-2 py-2">
                <span className="text-sm text-muted-foreground">
                  Interviews
                </span>
                <span className="text-sm font-medium text-foreground">
                  {interviewCount}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl px-2 py-2">
                <span className="text-sm text-muted-foreground">Offers</span>
                <span className="text-sm font-medium text-foreground">
                  {offerCount}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/8 bg-black/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-2 px-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
              By Stage
            </div>
            <div className="space-y-1">
              {stageCounts.map(({ stage, count }) => (
                <div
                  key={stage}
                  className="flex items-center justify-between rounded-xl px-2 py-2"
                >
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
                {canEditJobs
                  ? "A clean editable grid. Changes are saved automatically."
                  : "A clean tracker preview. Get Pro to add, edit, and manage applications here."}
              </p>
            </div>
            <Button
              type="button"
              variant="cool"
              size="sm"
              className="rounded-full px-4"
              onClick={handleAddApplicationIntent}
              disabled={!authAvailable}
            >
              {isAuthenticated ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isAuthenticated
                ? canTrackJobs
                  ? "New application"
                  : "Get Pro to add"
                : authAvailable
                  ? "Sign in to add"
                  : "Supabase not configured"}
            </Button>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
              <Search className="h-3.5 w-3.5 text-primary" />
              Search & Filter
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search company, role, stage, link, or resume..."
                  aria-label="Search job applications"
                  className="h-10 w-full rounded-full border border-white/14 bg-black/30 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-white/35 focus:border-primary/40 focus:bg-white/[0.05]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStageFilter("all")}
                  aria-pressed={stageFilter === "all"}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    stageFilter === "all"
                      ? "border-primary/35 bg-primary/12 text-primary shadow-[0_8px_24px_rgba(34,197,94,0.12)]"
                      : "border-white/12 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  )}
                >
                  All
                </button>
                {JOB_APPLICATION_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setStageFilter(stage)}
                    aria-pressed={stageFilter === stage}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      stageFilter === stage
                        ? "border-primary/35 bg-primary/12 text-primary shadow-[0_8px_24px_rgba(34,197,94,0.12)]"
                        : "border-white/12 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-foreground"
                    )}
                  >
                    {stage}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-xs text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-white/35" />
                  <select
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value as JobApplicationSort)
                    }
                    className="bg-transparent text-xs text-foreground outline-none"
                    aria-label="Sort job applications"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="company">Company A-Z</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Showing {filteredApplications.length} of {applications.length}{" "}
                  applications
                </span>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("")
                      setStageFilter("all")
                      setSortOrder("newest")
                    }}
                    className="rounded-full border border-white/10 px-3 py-1 transition-colors hover:border-white/18 hover:text-foreground"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {applicationsLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/10 p-8 text-center">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  No applications yet
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {isAuthenticated
                    ? canTrackJobs
                      ? "Start with your first row and keep the company, role, date, and resume file attached to one place."
                      : "Get Pro to track your jobs in one place and keep every company, role, date, and resume file together."
                    : "Browse the tracker layout now. Sign in when you are ready to add and save your first application."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 rounded-full px-5"
                  onClick={handleAddApplicationIntent}
                  disabled={!authAvailable}
                >
                  {isAuthenticated ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isAuthenticated
                    ? canTrackJobs
                      ? "Add first application"
                      : "Get Pro to track your jobs"
                    : authAvailable
                      ? "Sign in to add your first application"
                      : "Supabase not configured"}
                </Button>
              </div>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/10 p-8 text-center">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  No matching applications
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  No job tracker rows match the current search or stage filter.
                </p>
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-5 rounded-full px-5"
                    onClick={() => {
                      setSearchQuery("")
                      setStageFilter("all")
                      setSortOrder("newest")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="scrollbar-dark flex-1 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/8 bg-black/[0.06]">
              <table className="w-full table-fixed border-collapse">
                <thead className="sticky top-0 z-10 bg-white/[0.04] backdrop-blur-[18px]">
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-white/40">
                    <th className="w-[11%] border-b border-white/8 px-4 py-3 font-medium">
                      Stage
                    </th>
                    <th className="w-[20%] border-b border-white/8 px-4 py-3 font-medium">
                      Company
                    </th>
                    <th className="w-[20%] border-b border-white/8 px-4 py-3 font-medium">
                      Position
                    </th>
                    <th className="w-[21%] border-b border-white/8 px-4 py-3 font-medium">
                      Link
                    </th>
                    <th className="w-[12%] border-b border-white/8 px-4 py-3 font-medium">
                      Resume
                    </th>
                    <th className="w-[10%] border-b border-white/8 px-4 py-3 font-medium">
                      Date
                    </th>
                    <th className="w-[6%] border-b border-white/8 px-2 py-3 font-medium text-center">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) =>
                    (() => {
                      const isPendingDelete =
                        pendingDeleteApplicationId === application.id

                      return (
                        <tr
                          key={application.id}
                          className="group align-top transition-colors hover:bg-white/[0.025]"
                        >
                          <td className="border-b border-white/8 px-4 py-2.5">
                            <div className="relative w-full min-w-0">
                              <select
                                value={application.stage}
                                disabled={!canEditJobs}
                                onChange={(event) =>
                                  onUpdateApplication(application.id, {
                                    stage: event.target
                                      .value as JobApplicationStage,
                                  })
                                }
                                className={cn(
                                  "h-9 w-full appearance-none bg-transparent px-0 pr-5 text-sm font-medium outline-none transition-colors",
                                  !canEditJobs && "cursor-pointer",
                                  stageMeta[application.stage].textClassName
                                )}
                                onClick={() => {
                                  if (!canEditJobs) {
                                    handleLockedInteraction()
                                  }
                                }}
                              >
                                {JOB_APPLICATION_STAGES.map((stage) => (
                                  <option
                                    key={stage}
                                    value={stage}
                                    className="bg-[#05080f] text-foreground"
                                  >
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
                              readOnly={!canEditJobs}
                              onChange={(event) =>
                                onUpdateApplication(application.id, {
                                  company: event.target.value,
                                })
                              }
                              onClick={() => {
                                if (!canEditJobs) {
                                  handleLockedInteraction()
                                }
                              }}
                              className={cn(
                                "h-10 w-full min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:bg-transparent",
                                !canEditJobs && "cursor-pointer"
                              )}
                              placeholder="Company"
                            />
                          </td>
                          <td className="border-b border-white/8 px-4 py-2.5">
                            <input
                              type="text"
                              value={application.position ?? ""}
                              readOnly={!canEditJobs}
                              onChange={(event) =>
                                onUpdateApplication(application.id, {
                                  position: event.target.value,
                                })
                              }
                              onClick={() => {
                                if (!canEditJobs) {
                                  handleLockedInteraction()
                                }
                              }}
                              className={cn(
                                "h-10 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus:bg-transparent",
                                !canEditJobs && "cursor-pointer"
                              )}
                              placeholder="Role / position"
                            />
                          </td>
                          <td className="border-b border-white/8 px-4 py-2.5">
                            <div className="relative h-10">
                              <input
                                type="url"
                                value={application.job_link ?? ""}
                                readOnly={!canEditJobs}
                                onChange={(event) =>
                                  onUpdateApplication(application.id, {
                                    job_link: event.target.value,
                                  })
                                }
                                onClick={() => {
                                  if (!canEditJobs) {
                                    handleLockedInteraction()
                                  }
                                }}
                                className={cn(
                                  "h-10 w-full min-w-0 bg-transparent pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:bg-transparent",
                                  !canEditJobs && "cursor-pointer"
                                )}
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
                                <label
                                  className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-white/10 bg-transparent text-sm text-foreground transition-colors",
                                    canEditJobs
                                      ? "cursor-pointer hover:border-primary/30 hover:bg-white/[0.03]"
                                      : "cursor-pointer"
                                  )}
                                  onClick={() => {
                                    if (!canEditJobs) {
                                      handleLockedInteraction()
                                    }
                                  }}
                                >
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt,.md,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json"
                                    className="hidden"
                                    disabled={!canEditJobs}
                                    onChange={(event) =>
                                      void handleResumeUpload(
                                        application.id,
                                        event
                                      )
                                    }
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
                                    application.resume_file_name
                                      ? "group-hover/file:opacity-100"
                                      : ""
                                  )}
                                >
                                  {application.resume_file_name ||
                                    "Upload resume file"}
                                </div>
                              </div>
                              <a
                                href={
                                  application.resume_file_data_url || undefined
                                }
                                download={
                                  application.resume_file_name || "resume"
                                }
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
                                onClick={() =>
                                  handleRemoveResume(application.id)
                                }
                                disabled={!canEditJobs}
                                className={cn(
                                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-white/28 transition-colors",
                                  application.resume_file_name && canEditJobs
                                    ? "hover:border-white/10 hover:bg-white/[0.04] hover:text-foreground"
                                    : application.resume_file_name
                                      ? "opacity-100"
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
                                readOnly={!canEditJobs}
                                onChange={(event) =>
                                  onUpdateApplication(application.id, {
                                    applied_on:
                                      normalizeJobApplicationDateInput(
                                        event.target.value
                                      ),
                                  })
                                }
                                inputMode="numeric"
                                maxLength={8}
                                pattern="^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/\\d{2}$"
                                onClick={() => {
                                  if (!canEditJobs) {
                                    handleLockedInteraction()
                                  }
                                }}
                                className={cn(
                                  "h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:bg-transparent",
                                  !canEditJobs && "cursor-pointer",
                                  application.applied_on &&
                                    !isJobApplicationDisplayDate(
                                      application.applied_on
                                    )
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
                              <button
                                type="button"
                                className={cn(
                                  "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-50",
                                  isPendingDelete
                                    ? "text-red-400 hover:text-red-300"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                disabled={
                                  deletingApplicationId === application.id
                                }
                                onClick={() => {
                                  if (!canEditJobs) {
                                    handleLockedInteraction()
                                    return
                                  }
                                  if (!isPendingDelete) {
                                    setPendingDeleteApplicationId(
                                      application.id
                                    )
                                    return
                                  }
                                  setPendingDeleteApplicationId(null)
                                  void onDeleteApplication(application.id)
                                }}
                                aria-label="Delete application"
                              >
                                {deletingApplicationId === application.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isPendingDelete ? (
                                  <Trash2 className="h-4 w-4" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })()
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export const JobApplicationsPanel = memo(JobApplicationsPanelComponent)
