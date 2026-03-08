"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Target,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  FileSearch,
  BarChart3,
  Wrench,
} from "lucide-react"
import type {
  ATSDebugSection,
  ATSIssue,
  ATSRecommendation,
  ATSScoreResponse,
  ATSSectionReview,
} from "@/lib/ats-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ATSScorePanelProps {
  scoreData: ATSScoreResponse | null
  isLoading: boolean
  isLoadingInsights: boolean
  hasLoadedAIInsights: boolean
}

type ColorBand = "red" | "yellow" | "green" | "blue" | "gray"

const getScoreBand = (score: number): Exclude<ColorBand, "gray"> => {
  if (score >= 90) return "blue"
  if (score >= 60) return "green"
  if (score >= 30) return "yellow"
  return "red"
}

const getBandTextColor = (band: ColorBand) => {
  switch (band) {
    case "red":
      return "text-red-500"
    case "yellow":
      return "text-yellow-500"
    case "green":
      return "text-green-500"
    case "blue":
      return "text-blue-500"
    default:
      return "text-gray-500"
  }
}

const getBandBadgeColor = (band: ColorBand) => {
  switch (band) {
    case "red":
      return "border-red-500/30 bg-red-500/15 text-red-400"
    case "yellow":
      return "border-yellow-500/30 bg-yellow-500/15 text-yellow-400"
    case "green":
      return "border-green-500/30 bg-green-500/15 text-green-400"
    case "blue":
      return "border-blue-500/30 bg-blue-500/15 text-blue-400"
    default:
      return "border-gray-500/30 bg-gray-500/15 text-gray-400"
  }
}

const getBandCardColor = (band: ColorBand) => {
  switch (band) {
    case "red":
      return "text-red-500 bg-red-500/10 border-red-500/20"
    case "yellow":
      return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20"
    case "green":
      return "text-green-500 bg-green-500/10 border-green-500/20"
    case "blue":
      return "text-blue-500 bg-blue-500/10 border-blue-500/20"
    default:
      return "text-gray-500 bg-gray-500/10 border-gray-500/20"
  }
}

const getBandBarColor = (band: ColorBand) => {
  switch (band) {
    case "red":
      return "bg-red-500"
    case "yellow":
      return "bg-yellow-500"
    case "green":
      return "bg-green-500"
    case "blue":
      return "bg-blue-500"
    default:
      return "bg-gray-500"
  }
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return getBandBadgeColor("red")
    case "high":
      return getBandBadgeColor("yellow")
    case "medium":
      return getBandBadgeColor("green")
    case "low":
      return getBandBadgeColor("blue")
    default:
      return getBandBadgeColor("gray")
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return getBandBadgeColor("red")
    case "medium":
      return getBandBadgeColor("yellow")
    case "low":
      return getBandBadgeColor("green")
    default:
      return getBandBadgeColor("gray")
  }
}

const getScoreColor = (score: number) => {
  return getBandTextColor(getScoreBand(score))
}

const getRatingBadgeColor = (score: number) => {
  return getBandBadgeColor(getScoreBand(score))
}

const getBarColor = (score: number) => {
  return getBandBarColor(getScoreBand(score))
}

const getSectionStatusLabel = (status: ATSSectionReview["status"]) => {
  switch (status) {
    case "strong":
      return "Strong"
    case "good":
      return "Good"
    case "needs-work":
      return "Needs work"
    case "weak":
      return "Weak"
    default:
      return "Review"
  }
}

const getSectionStatusColor = (status: ATSSectionReview["status"]) => {
  switch (status) {
    case "strong":
      return getBandBadgeColor("blue")
    case "good":
      return getBandBadgeColor("green")
    case "needs-work":
      return getBandBadgeColor("yellow")
    case "weak":
      return getBandBadgeColor("red")
    default:
      return getBandBadgeColor("gray")
  }
}

const getDebugSeverityClasses = (severity: ATSDebugSection["items"][number]["severity"]) => {
  switch (severity) {
    case "good":
      return getBandBadgeColor("green")
    case "info":
      return getBandBadgeColor("blue")
    case "warning":
      return getBandBadgeColor("yellow")
    case "critical":
      return getBandBadgeColor("red")
    default:
      return getBandBadgeColor("gray")
  }
}

const ATS_LOADING_STEPS = [
  { title: "Parsing the resume" },
  { title: "Checking ATS structure" },
  { title: "Scoring role alignment" },
  { title: "Auditing impact signals" },
  { title: "Building recommendations" },
]

const ATS_LOADING_STEP_DURATIONS = [800, 900, 2800, 2800, 2600]

function ATSLoadingPanel() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    setActiveStep(0)
    let cancelled = false
    let timeoutId: number | undefined

    const advance = (stepIndex: number) => {
      if (cancelled || stepIndex >= ATS_LOADING_STEPS.length - 1) return

      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        const nextStep = stepIndex + 1
        setActiveStep(nextStep)
        advance(nextStep)
      }, ATS_LOADING_STEP_DURATIONS[stepIndex] ?? 1600)
    }

    advance(0)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [])

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="flex w-full justify-center">
        <div className="relative w-full max-w-[17rem] pl-5">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />

          <div className="space-y-2.5">
            {ATS_LOADING_STEPS.map((step, index) => {
              const isComplete = index < activeStep
              const isCurrent = index === activeStep

              return (
                <div key={step.title} className="relative flex items-center gap-3">
                  <div
                    className={`absolute -left-[1.05rem] top-1.5 z-10 flex h-3 w-3 items-center justify-center rounded-full border ${
                      isCurrent
                        ? "border-primary bg-primary shadow-[0_0_0_4px_rgba(34,197,94,0.10)]"
                        : isComplete
                          ? "border-primary/30 bg-primary/15"
                          : "border-white/15 bg-background"
                    }`}
                  >
                    {isComplete ? (
                      <div className="h-1 w-1 rounded-full bg-primary" />
                    ) : isCurrent ? (
                      <div className="h-1 w-1 rounded-full bg-primary-foreground" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={`text-sm transition-colors ${
                          isCurrent
                            ? "font-medium text-foreground"
                            : isComplete
                              ? "text-foreground/75"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.title}
                      </p>
                      {isCurrent && (
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function PillButton({
  active,
  label,
  onClick,
  badge,
}: {
  active: boolean
  label: string
  onClick: () => void
  badge?: string | number
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      size="sm"
      variant={active ? "cool" : "outline"}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-full px-3 text-xs whitespace-nowrap sm:px-4 sm:text-sm",
        active
          ? "shadow-[0_10px_24px_rgba(34,197,94,0.24)]"
          : "border-white/8 bg-black/12 text-muted-foreground hover:bg-white/8 hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {badge !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px]",
            active ? "bg-black/15 text-primary-foreground" : "bg-white/10 text-muted-foreground"
          )}
        >
          {badge}
        </span>
      ) : null}
    </Button>
  )
}

function SubPillButton({
  active,
  label,
  onClick,
  badge,
}: {
  active: boolean
  label: string
  onClick: () => void
  badge?: string | number
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      size="sm"
      variant={active ? "cool" : "outline"}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 rounded-full px-3 text-xs whitespace-nowrap sm:h-8",
        active
          ? "shadow-[0_8px_18px_rgba(34,197,94,0.2)]"
          : "border-white/8 bg-black/10 text-muted-foreground hover:border-white/15 hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {badge !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px]",
            active ? "bg-black/15 text-primary-foreground" : "bg-white/8 text-muted-foreground"
          )}
        >
          {badge}
        </span>
      ) : null}
    </Button>
  )
}

function SubnavRow({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = element
      setCanScrollLeft(scrollLeft > 4)
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
    }

    updateScrollState()
    element.addEventListener("scroll", updateScrollState, { passive: true })

    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener("scroll", updateScrollState)
      resizeObserver.disconnect()
    }
  }, [children])

  const scrollByAmount = (direction: "left" | "right") => {
    const element = scrollRef.current
    if (!element) return
    const amount = Math.max(120, Math.floor(element.clientWidth * 0.55))
    element.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative min-w-0">
      {canScrollLeft ? (
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          className="absolute left-0 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/70 backdrop-blur-sm transition-colors hover:border-white/20 hover:text-white sm:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          className="absolute right-0 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/70 backdrop-blur-sm transition-colors hover:border-white/20 hover:text-white sm:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div ref={scrollRef} className="scrollbar-hide flex min-w-0 gap-2 overflow-x-auto px-0 pb-1">
        {children}
      </div>
    </div>
  )
}

function IssueCard({ issue }: { issue: ATSIssue }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-white/8 bg-black/10 p-3 sm:p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full text-left"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${getSeverityColor(issue.severity)}`}
              >
                {issue.severity}
              </span>
              <span className="text-xs text-muted-foreground">{issue.category}</span>
            </div>
            <h4 className="mb-1 text-sm font-semibold text-foreground">{issue.issue}</h4>
            <p className="mb-2 text-xs text-muted-foreground">{issue.impact}</p>
          </div>
          <span className="self-end rounded p-1 transition-colors hover:bg-white/8 sm:self-auto">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-foreground">How to Fix:</p>
            <p className="text-xs text-muted-foreground">{issue.howToFix}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-foreground">Example:</p>
            <div className="rounded bg-black/12 p-2 font-mono text-xs text-muted-foreground">{issue.example}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function RecommendationCard({ rec }: { rec: ATSRecommendation }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-white/8 bg-black/10 p-3 sm:p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full text-left"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${getPriorityColor(rec.priority)}`}
              >
                {rec.priority} Priority
              </span>
            </div>
            <h4 className="mb-1 text-sm font-semibold text-foreground">{rec.action}</h4>
            <p className="text-xs text-muted-foreground">{rec.benefit}</p>
          </div>
          <span className="self-end rounded p-1 transition-colors hover:bg-white/8 sm:self-auto">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </button>

      {expanded && (
          <div className="mt-3 border-t border-white/8 pt-3">
          <p className="mb-1 text-xs font-semibold text-foreground">Implementation:</p>
          <p className="text-xs text-muted-foreground">{rec.implementation}</p>
        </div>
      )}
    </div>
  )
}

function SectionBreakdown({
  sectionReviews,
  expandedMetric,
  setExpandedMetric,
}: {
  sectionReviews: ATSSectionReview[]
  expandedMetric: string | null
  setExpandedMetric: (value: string | null) => void
}) {
  return (
    <div className="space-y-2 min-w-0">
      {sectionReviews.map((section) => {
        const isExpanded = expandedMetric === section.id

        return (
          <div key={section.id} className="min-w-0 overflow-hidden rounded-lg border border-white/8 bg-black/10">
            <button
              type="button"
              onClick={() => setExpandedMetric(isExpanded ? null : section.id)}
              aria-expanded={isExpanded}
              className="w-full min-w-0 px-3 py-3 text-left"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-sm font-medium text-foreground sm:truncate">{section.title}</span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getSectionStatusColor(section.status)}`}
                    >
                      {getSectionStatusLabel(section.status)}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground break-words">{section.diagnosis}</div>
                </div>
                <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
                  <span className={`text-sm font-bold ${getScoreColor(section.score)}`}>{section.score}%</span>
                  <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full transition-all ${getBarColor(section.score)}`} style={{ width: `${section.score}%` }} />
              </div>
            </button>

            {isExpanded && (
              <div className="min-w-0 px-3 pb-3 pt-0">
                <div className="min-w-0 space-y-3 border-t border-white/10 pt-3">
                  <p className="text-xs text-muted-foreground break-words">{section.diagnosis}</p>

                  {section.whatWorks.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">What&apos;s Working</p>
                      <ul className="space-y-1">
                        {section.whatWorks.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-green-500">•</span>
                            <span className="break-words">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {section.gaps.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-yellow-400">Gaps</p>
                      <ul className="space-y-1">
                        {section.gaps.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-yellow-500">•</span>
                            <span className="break-words">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {section.actions.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">How to Improve</p>
                      <ul className="space-y-1">
                        {section.actions.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-0.5 text-primary">•</span>
                            <span className="break-words">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DebugSectionCard({ section }: { section: ATSDebugSection }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/10 p-3 sm:p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{section.summary}</p>
      </div>
        <div className="space-y-2">
        {section.items.map((item) => (
          <div key={`${section.id}-${item.label}`} className="rounded-lg border border-white/8 bg-black/10 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{item.label}</p>
                <p className="mt-1 text-sm text-foreground">{item.detail}</p>
                {item.suggestion ? <p className="mt-2 text-xs text-muted-foreground">{item.suggestion}</p> : null}
              </div>
              <span
                className={`self-end shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:self-auto ${getDebugSeverityClasses(item.severity)}`}
              >
                {item.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ATSScorePanel({
  scoreData,
  isLoading,
  isLoadingInsights,
  hasLoadedAIInsights,
}: ATSScorePanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "insights">("overview")
  const [activeOverviewDebug, setActiveOverviewDebug] = useState<string | null>(null)
  const [activeInsightView, setActiveInsightView] = useState<"sections" | "keywords" | "issues" | "tips">("sections")
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const [isScoreVisible, setIsScoreVisible] = useState(false)

  useEffect(() => {
    if (!hasLoadedAIInsights && activeTab === "insights") {
      setActiveTab("overview")
    }
  }, [activeTab, hasLoadedAIInsights])

  useEffect(() => {
    setActiveTab("overview")
    setExpandedMetric(null)
    setActiveInsightView("sections")
    setActiveOverviewDebug(scoreData?.debugAnalysis?.[0]?.id || null)
  }, [scoreData])

  useEffect(() => {
    if (!scoreData || isLoading) {
      setIsScoreVisible(false)
      return
    }

    const timeoutId = window.setTimeout(() => setIsScoreVisible(true), 120)
    return () => window.clearTimeout(timeoutId)
  }, [isLoading, scoreData])

  const activeDebugSection = useMemo(() => {
    if (!scoreData?.debugAnalysis?.length) return null
    return scoreData.debugAnalysis.find((section) => section.id === activeOverviewDebug) || scoreData.debugAnalysis[0]
  }, [activeOverviewDebug, scoreData])

  if (isLoading) {
    return <ATSLoadingPanel />
  }

  if (!scoreData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center sm:p-6">
        <FileSearch className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No ATS Score Yet</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Enter your resume and job description, then click "Get ATS Score" to receive a comprehensive analysis.
        </p>
      </div>
    )
  }

  const data = scoreData
  const isResumeOnly = data.analysisMode === "resume-only"
  const hasKeywordAnalysis = data.keywordAnalysis !== null
  const hasTargetRoleScore = data.targetRoleScore !== null
  const primaryScore = hasTargetRoleScore ? (data.targetRoleScore ?? 0) : data.resumeQualityScore

  return (
    <div
      className={`flex h-full w-full max-w-full min-h-0 min-w-0 flex-col overflow-hidden overflow-x-hidden transition-all duration-300 ${
        isScoreVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      }`}
    >
      <div className="mb-3 flex-shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
              <Target className="h-5 w-5 text-primary" />
              ATS Score Analysis
            </h2>
            <p className="text-sm text-muted-foreground">Comprehensive resume evaluation</p>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between rounded-xl border border-white/8 bg-black/10 px-3 py-2 sm:w-auto sm:justify-start sm:gap-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
            <div className={`text-3xl font-bold leading-none sm:text-4xl ${getScoreColor(primaryScore)}`}>
              {primaryScore}
            </div>
            <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRatingBadgeColor(primaryScore)}`}>
              {data.rating}
            </div>
          </div>
        </div>
      </div>

      <div className="scrollbar-dark mb-3 flex min-w-0 flex-shrink-0 gap-2 overflow-x-auto pb-1">
        <PillButton active={activeTab === "overview"} label="Overview" onClick={() => setActiveTab("overview")} />
        {hasLoadedAIInsights ? (
          <PillButton
            active={activeTab === "insights"}
            label="AI Insights"
            onClick={() => setActiveTab("insights")}
            badge={data.detailedIssues.length + data.recommendations.length}
          />
        ) : (
          <Button
            type="button"
            disabled
            size="sm"
            variant="outline"
            className="h-9 rounded-full border-white/8 bg-black/12 px-3 text-xs whitespace-nowrap text-muted-foreground/90 disabled:cursor-default disabled:opacity-100 sm:px-4 sm:text-sm"
          >
            <Lightbulb className={`h-4 w-4 ${isLoadingInsights ? "animate-pulse" : ""}`} />
            {isLoadingInsights ? "AI Insights Loading..." : "AI Insights"}
          </Button>
        )}
      </div>

      <div className="scrollbar-dark flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pr-0 sm:pr-2">
        {activeTab === "overview" && (
          <div className="w-full max-w-full min-w-0 space-y-4">
            {hasTargetRoleScore ? (
              <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                <div className="min-w-0 overflow-hidden rounded-xl border border-white/8 bg-black/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-muted-foreground">Resume ATS Score</div>
                    <div className={`text-2xl font-bold leading-none ${getScoreColor(data.resumeQualityScore)}`}>
                      {data.resumeQualityScore}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">How strong your resume is on its own</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full transition-all ${getBarColor(data.resumeQualityScore)}`} style={{ width: `${data.resumeQualityScore}%` }} />
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-xl border border-primary/15 bg-black/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-muted-foreground">Target Role Score</div>
                    <div className={`text-2xl font-bold leading-none ${getScoreColor(data.targetRoleScore || 0)}`}>
                      {data.targetRoleScore}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">How well the resume fits this job description</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full transition-all ${getBarColor(data.targetRoleScore || 0)}`} style={{ width: `${data.targetRoleScore || 0}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-w-0 overflow-hidden rounded-xl border border-white/8 bg-black/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-muted-foreground">Resume ATS Score</div>
                  <div className={`text-2xl font-bold leading-none ${getScoreColor(data.resumeQualityScore)}`}>
                    {data.resumeQualityScore}
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">Standalone ATS strength of the uploaded resume</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full transition-all ${getBarColor(data.resumeQualityScore)}`} style={{ width: `${data.resumeQualityScore}%` }} />
                </div>
              </div>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 overflow-hidden rounded-lg border border-white/8 bg-black/10 p-3 sm:p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  What Works Well
                </h3>
                <ul className="space-y-2">
                  {data.keyFindings.strengths.map((strength, idx) => (
                    <li key={idx} className="min-w-0 flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-0.5 text-green-500">•</span>
                      <span className="break-words">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0 overflow-hidden rounded-lg border border-white/8 bg-black/10 p-3 sm:p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <XCircle className="h-4 w-4 text-red-500" />
                  What Needs Work
                </h3>
                <ul className="space-y-2">
                  {data.keyFindings.weaknesses.map((weakness, idx) => (
                    <li key={idx} className="min-w-0 flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-0.5 text-red-500">•</span>
                      <span className="break-words">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {data.debugAnalysis.length > 0 && activeDebugSection ? (
              <div className="min-w-0 overflow-hidden rounded-lg border border-white/8 bg-black/10 p-3 sm:p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Wrench className="h-4 w-4 text-primary" />
                      Scorer Debug
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deterministic checks from the local ATS scorer for this specific resume.
                    </p>
                  </div>
                </div>
                <div className="mb-4">
                  <SubnavRow>
                  {data.debugAnalysis.map((section) => (
                    <SubPillButton
                      key={section.id}
                      active={activeDebugSection.id === section.id}
                      label={section.title}
                      onClick={() => setActiveOverviewDebug(section.id)}
                      badge={section.items.length}
                    />
                  ))}
                  </SubnavRow>
                </div>
                <DebugSectionCard section={activeDebugSection} />
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "insights" && hasLoadedAIInsights && (
          <div className="space-y-4">
            <SubnavRow>
              <SubPillButton active={activeInsightView === "sections"} label="Section Breakdown" onClick={() => setActiveInsightView("sections")} />
              {hasKeywordAnalysis ? (
                <SubPillButton active={activeInsightView === "keywords"} label="Keyword Analysis" onClick={() => setActiveInsightView("keywords")} />
              ) : null}
              <SubPillButton active={activeInsightView === "issues"} label="Issues" onClick={() => setActiveInsightView("issues")} badge={data.detailedIssues.length} />
              <SubPillButton active={activeInsightView === "tips"} label="Tips" onClick={() => setActiveInsightView("tips")} badge={data.recommendations.length} />
            </SubnavRow>

            {activeInsightView === "sections" && (
              <SectionBreakdown
                sectionReviews={data.sectionReviews}
                expandedMetric={expandedMetric}
                setExpandedMetric={setExpandedMetric}
              />
            )}

            {activeInsightView === "keywords" && hasKeywordAnalysis && data.keywordAnalysis && (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/8 bg-black/10 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Keyword Analysis</h3>
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Match Rate</p>
                      <p className="text-2xl font-bold text-foreground">{data.keywordAnalysis.matchPercentage.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">
                        {data.keywordAnalysis.matchedKeywords} of {data.keywordAnalysis.totalKeywordsInJD} keywords
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Keyword Density</p>
                      <p className="text-2xl font-bold text-foreground">{data.keywordAnalysis.keywordDensity.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Target: 2-4%</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/8 bg-black/10 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-green-400">Present Keywords</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.keyFindings.presentKeywords?.map((kw, idx) => (
                        <span key={idx} className="rounded border border-green-500/30 bg-green-500/20 px-2 py-1 text-xs text-green-400">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/8 bg-black/10 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-red-400">Missing Keywords</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.keyFindings.missingKeywords?.map((kw, idx) => (
                        <span key={idx} className="rounded border border-red-500/30 bg-red-500/20 px-2 py-1 text-xs text-red-400">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeInsightView === "issues" && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Issues</h3>
                {data.detailedIssues.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
                    <p className="font-medium text-foreground">No major issues found</p>
                    <p className="text-sm text-muted-foreground">Your resume looks good.</p>
                  </div>
                ) : (
                  data.detailedIssues.map((issue, idx) => <IssueCard key={idx} issue={issue} />)
                )}
              </div>
            )}

            {activeInsightView === "tips" && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Tips And Fixes</h3>
                {data.recommendations.map((rec, idx) => (
                  <RecommendationCard key={idx} rec={rec} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
