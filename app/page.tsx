"use client"

import dynamic from "next/dynamic"
import { memo, useCallback, useEffect, useRef, useState, type ComponentProps, type RefObject } from "react"
import type { Session } from "@supabase/supabase-js"
import { BriefcaseBusiness, ChevronDown, Crown, FileCode2, LayoutDashboard, LogOut, Target, UserRound } from "lucide-react"
import { ErrorBoundary } from "@/components/error-boundary"
import { BACKGROUND_THEMES, type BackgroundTheme } from "@/components/webgl-shader"
import { Button } from "@/components/ui/button"
import type { ATSScoreResponse } from "@/lib/ats-types"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import { getUserFacingMessage } from "@/lib/errors"
import {
  createJobApplicationDraft,
  formatJobApplicationDateForDisplay,
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
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  isMissingJobApplicationsTable,
  isMissingTrackedRunsTable,
  normalizeJobApplication,
  normalizeTrackedRun,
} from "@/lib/record-normalizers"
import {
  clearLocalTrackedRuns,
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
  TRACKED_RUN_MODE,
  type SaveTrackedRunInput,
  type TrackedRunRecord,
  type TrackedRunMode,
} from "@/lib/tracked-runs"
import {
  accountServiceClient,
  atsServiceClient,
  billingServiceClient,
  resumeServiceClient,
  ServiceClientError,
} from "@/lib/services/gateway-client"
import { reportClientError } from "@/lib/error-monitoring"
import {
  getFeatureUpgradeMessage,
  getGuestPlanSnapshot,
  getPlanEntitlements,
  isPlanSnapshot,
  PREMIUM_FEATURE,
  SUBSCRIPTION_PLAN,
  type PlanSnapshot,
  type PremiumFeature,
} from "@/lib/subscription"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ATS_LOADING_MIN_DURATION_MS = 11000
const HISTORY_LIMIT = 24
const PLAN_SNAPSHOT_STORAGE_KEY_PREFIX = "resume-studio:plan-snapshot:"
const TRACKED_RUNS_STORAGE_NOTICE =
  "Cloud dashboard storage needs the latest Supabase schema. Using local browser history for now."
const JOB_APPLICATIONS_STORAGE_NOTICE =
  "Job tracker cloud storage needs the latest Supabase schema. Using local browser history for now."

const APP_MODE = {
  DASHBOARD: "dashboard",
  JOB_TRACKER: "job-tracker",
} as const

type AppMode = (typeof APP_MODE)[keyof typeof APP_MODE] | TrackedRunMode

function getPlanSnapshotStorageKey(userId: string) {
  return `${PLAN_SNAPSHOT_STORAGE_KEY_PREFIX}${userId}`
}

function loadCachedPlanSnapshot(userId: string): PlanSnapshot | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(getPlanSnapshotStorageKey(userId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return isPlanSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

function persistPlanSnapshot(userId: string, snapshot: PlanSnapshot) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(getPlanSnapshotStorageKey(userId), JSON.stringify(snapshot))
}

const WebGLShader = dynamic(
  () => import("@/components/webgl-shader").then((mod) => mod.WebGLShader),
  { ssr: false, loading: () => null }
)

const DashboardPanel = dynamic(() => import("@/components/dashboard-panel").then((mod) => mod.DashboardPanel), {
  loading: () => null,
})

const JobApplicationsPanel = dynamic(
  () => import("@/components/job-applications-panel").then((mod) => mod.JobApplicationsPanel),
  { loading: () => null }
)

const ResumeInputPanel = dynamic(() => import("@/components/resume-input-panel").then((mod) => mod.ResumeInputPanel), {
  loading: () => null,
})

const ResumePreviewPanel = dynamic(
  () => import("@/components/resume-preview-panel").then((mod) => mod.ResumePreviewPanel),
  { loading: () => null }
)

const ATSScorePanel = dynamic(() => import("@/components/ats-score-panel").then((mod) => mod.ATSScorePanel), {
  loading: () => null,
})

const LatexSplitWorkspace = dynamic(
  () => import("@/components/latex-split-workspace").then((mod) => mod.LatexSplitWorkspace),
  { loading: () => null }
)

const AuthDialog = dynamic(() => import("@/components/auth-dialog").then((mod) => mod.AuthDialog), {
  loading: () => null,
})

const LegalDialog = dynamic(() => import("@/components/legal-dialog").then((mod) => mod.LegalDialog), {
  loading: () => null,
})

const PlanDialog = dynamic(() => import("@/components/plan-dialog").then((mod) => mod.PlanDialog), {
  loading: () => null,
})

const supabase = getSupabaseBrowserClient()

type DashboardPanelProps = ComponentProps<typeof DashboardPanel>
type JobApplicationsPanelProps = ComponentProps<typeof JobApplicationsPanel>
type ResumeInputPanelProps = ComponentProps<typeof ResumeInputPanel>
type ResumePreviewPanelProps = ComponentProps<typeof ResumePreviewPanel>
type ATSScorePanelProps = ComponentProps<typeof ATSScorePanel>
type LatexSplitWorkspaceProps = ComponentProps<typeof LatexSplitWorkspace>
type AuthDialogProps = ComponentProps<typeof AuthDialog>
type LegalDialogProps = ComponentProps<typeof LegalDialog>
type PlanDialogProps = ComponentProps<typeof PlanDialog>

const PageHeader = memo(function PageHeader({
  mode,
  userEmail,
  currentPlan,
  pageContainerClass,
  onModeChange,
  onOpenAuth,
  onOpenPlans,
  onSignOut,
}: {
  mode: AppMode
  userEmail: string | null
  currentPlan: PlanSnapshot["plan"]
  pageContainerClass: string
  onModeChange: (mode: AppMode) => void
  onOpenAuth: () => void
  onOpenPlans: () => void
  onSignOut: () => Promise<void>
}) {
  return (
    <div
      className={cn(
        "relative z-10 flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between lg:pt-5",
        pageContainerClass
      )}
    >
      <div className="w-full rounded-full border border-white/12 bg-black/25 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:w-fit">
        <div className="flex items-stretch gap-2">
          <Button
            type="button"
            variant="cool"
            size="sm"
            aria-pressed={mode === APP_MODE.DASHBOARD}
            onClick={() => onModeChange(APP_MODE.DASHBOARD)}
            className={cn(
              "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
              mode === APP_MODE.DASHBOARD
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
            aria-pressed={mode === TRACKED_RUN_MODE.GENERATE}
            onClick={() => onModeChange(TRACKED_RUN_MODE.GENERATE)}
            className={cn(
              "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
              mode === TRACKED_RUN_MODE.GENERATE
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
            aria-pressed={mode === TRACKED_RUN_MODE.ATS_SCORE}
            onClick={() => onModeChange(TRACKED_RUN_MODE.ATS_SCORE)}
            className={cn(
              "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
              mode === TRACKED_RUN_MODE.ATS_SCORE
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
            aria-pressed={mode === APP_MODE.JOB_TRACKER}
            onClick={() => onModeChange(APP_MODE.JOB_TRACKER)}
            className={cn(
              "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
              mode === APP_MODE.JOB_TRACKER
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenPlans}
            className={cn(
              "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
              currentPlan === SUBSCRIPTION_PLAN.PRO
                ? "border-sky-400/25 bg-sky-500/12 text-sky-50 hover:bg-sky-500/18"
                : "border-sky-400/25 bg-sky-500/12 text-sky-50 hover:bg-sky-500/18"
            )}
          >
            <Crown className="h-4 w-4" />
            <span className="text-xs font-medium sm:text-sm">
              {currentPlan === SUBSCRIPTION_PLAN.PRO ? "Pro" : "Upgrade"}
            </span>
          </Button>
          {userEmail ? (
            <>
              <Button
                type="button"
                variant="cool"
                size="sm"
                onClick={onOpenAuth}
                className="flex-1 rounded-full px-3 text-xs shadow-[0_10px_24px_rgba(34,197,94,0.28)] sm:flex-none sm:px-4 sm:text-sm"
              >
                <UserRound className="h-4 w-4" />
                <span className="text-xs font-medium sm:text-sm">Account</span>
              </Button>
              <Button
                type="button"
                variant="cool"
                size="sm"
                onClick={() => void onSignOut()}
                className="flex-1 rounded-full px-3 text-xs shadow-[0_10px_24px_rgba(34,197,94,0.28)] sm:flex-none sm:px-4 sm:text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-xs font-medium sm:text-sm">Logout</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="cool"
              size="sm"
              onClick={onOpenAuth}
              className="flex-1 rounded-full px-3 text-xs shadow-[0_10px_24px_rgba(34,197,94,0.28)] sm:flex-none sm:px-4 sm:text-sm"
            >
              <span className="text-xs font-medium sm:text-sm">Login</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})

const ErrorBanner = memo(function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string | null
  onDismiss: () => void
}) {
  if (!error) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-md items-start justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <p className="flex-1 text-sm leading-6 text-red-100">{error}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-0.5 text-red-200 transition-colors hover:text-red-50"
          aria-label="Close error"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
})

const MainContent = memo(function MainContent({
  mode,
  pageContainerClass,
  panelShellClass,
  outputPanelRef,
  dashboardProps,
  trackerProps,
  inputProps,
  previewProps,
  atsProps,
}: {
  mode: AppMode
  pageContainerClass: string
  panelShellClass: string
  outputPanelRef: RefObject<HTMLDivElement>
  dashboardProps: DashboardPanelProps
  trackerProps: JobApplicationsPanelProps
  inputProps: ResumeInputPanelProps
  previewProps: ResumePreviewPanelProps
  atsProps: ATSScorePanelProps
}) {
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 flex-1 min-w-0 flex-col gap-4 overflow-y-auto pb-4 pt-4 md:overflow-hidden lg:gap-6 lg:pb-6",
        pageContainerClass
      )}
    >
      {mode === APP_MODE.DASHBOARD ? (
        <div className={cn(panelShellClass, "md:basis-auto md:flex-auto")}>
          <ErrorBoundary
            context="dashboard-panel"
            fallbackTitle="Dashboard unavailable"
            fallbackMessage="The dashboard failed to render. You can reload just this section."
          >
            <DashboardPanel {...dashboardProps} />
          </ErrorBoundary>
        </div>
      ) : mode === APP_MODE.JOB_TRACKER ? (
        <div className={cn(panelShellClass, "md:basis-auto md:flex-auto")}>
          <ErrorBoundary
            context="job-applications-panel"
            fallbackTitle="Job tracker unavailable"
            fallbackMessage="The job tracker failed to render. Your data is still intact."
          >
            <JobApplicationsPanel {...trackerProps} />
          </ErrorBoundary>
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-stretch md:overflow-hidden">
          <div className={panelShellClass}>
            <ErrorBoundary
              context="resume-input-panel"
              fallbackTitle="Input panel unavailable"
              fallbackMessage="The input panel failed to render. Reload this section to continue."
            >
              <ResumeInputPanel {...inputProps} />
            </ErrorBoundary>
          </div>

          <div ref={outputPanelRef} className={panelShellClass}>
            {mode === TRACKED_RUN_MODE.GENERATE ? (
              <ErrorBoundary
                context="resume-preview-panel"
                fallbackTitle="Preview unavailable"
                fallbackMessage="The resume preview failed to render. You can reload just this panel."
              >
                <ResumePreviewPanel {...previewProps} />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary
                context="ats-score-panel"
                fallbackTitle="ATS results unavailable"
                fallbackMessage="The ATS results panel failed to render. Reload this section to continue."
              >
                <ATSScorePanel {...atsProps} />
              </ErrorBoundary>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

const SplitWorkspaceLayer = memo(function SplitWorkspaceLayer({
  mode,
  splitProps,
}: {
  mode: AppMode
  splitProps: LatexSplitWorkspaceProps
}) {
  if (mode !== TRACKED_RUN_MODE.GENERATE) return null

  return (
    <ErrorBoundary
      context="latex-split-workspace"
      fallbackTitle="Workspace unavailable"
      fallbackMessage="The side-by-side workspace failed to render. Close and reopen it to continue."
      compact
    >
      <LatexSplitWorkspace {...splitProps} />
    </ErrorBoundary>
  )
})

const DialogLayer = memo(function DialogLayer({
  authProps,
  legalProps,
  planProps,
}: {
  authProps: AuthDialogProps
  legalProps: LegalDialogProps
  planProps: PlanDialogProps
}) {
  return (
    <>
      <AuthDialog {...authProps} />
      <LegalDialog {...legalProps} />
      <PlanDialog {...planProps} />
    </>
  )
})

const PageFooter = memo(function PageFooter({
  hidden,
  backgroundTheme,
  onOpenPrivacy,
  onOpenTerms,
  onThemeChange,
}: {
  hidden: boolean
  backgroundTheme: BackgroundTheme
  onOpenPrivacy: () => void
  onOpenTerms: () => void
  onThemeChange: (theme: BackgroundTheme) => void
}) {
  if (hidden) return null

  return (
    <footer className="relative z-10 flex items-center justify-center gap-3 px-4 pb-4 text-[11px] text-white/24 md:pb-5">
      <button type="button" onClick={onOpenPrivacy} className="transition-colors hover:text-white/50">
        Privacy Policy
      </button>
      <span className="text-white/14">•</span>
      <button type="button" onClick={onOpenTerms} className="transition-colors hover:text-white/50">
        Terms of Service
      </button>
      <span className="text-white/14">•</span>
      <details className="group relative">
        <summary className="list-none">
          <span className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-white/45 transition-colors hover:text-white/70">
            Background
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" />
          </span>
        </summary>
        <div className="absolute bottom-[calc(100%+0.6rem)] right-0 min-w-40 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.1),rgba(3,7,18,0.03))] p-1.5 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
          {BACKGROUND_THEMES.map((theme) => {
            const active = backgroundTheme === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onThemeChange(theme.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] transition-colors",
                  active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/6 hover:text-white/80"
                )}
              >
                <span>{theme.label}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                  {active ? "Live" : "Theme"}
                </span>
              </button>
            )
          })}
        </div>
      </details>
    </footer>
  )
})

export default function HomePage() {
  const atsRequestIdRef = useRef(0)
  const jobApplicationSaveTimersRef = useRef<Record<string, number>>({})
  const outputPanelRef = useRef<HTMLDivElement>(null)
  const savedAtsRunIdRef = useRef<string | null>(null)

  const [mode, setMode] = useState<AppMode>(TRACKED_RUN_MODE.GENERATE)
  const [jobDescription, setJobDescription] = useState("")
  const [resumeContent, setResumeContent] = useState("")
  const [resumeFileName, setResumeFileName] = useState("")
  const [resumeFileMimeType, setResumeFileMimeType] = useState("")
  const [resumeFileDataUrl, setResumeFileDataUrl] = useState("")
  const [resumeArtifacts, setResumeArtifacts] = useState<DocumentArtifacts | null>(null)
  const [extraInstructions, setExtraInstructions] = useState("")
  const [latexContent, setLatexContent] = useState("")
  const [editableLatexContent, setEditableLatexContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [atsScore, setAtsScore] = useState<ATSScoreResponse | null>(null)
  const [isScoring, setIsScoring] = useState(false)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [hasLoadedAIInsights, setHasLoadedAIInsights] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [planSnapshot, setPlanSnapshot] = useState<PlanSnapshot>(() => getGuestPlanSnapshot())
  const [isPlanLoading, setIsPlanLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [planHighlightFeature, setPlanHighlightFeature] = useState<PremiumFeature | null>(null)
  const [isBillingActionLoading, setIsBillingActionLoading] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
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
  const [isSplitWorkspaceOpen, setIsSplitWorkspaceOpen] = useState(false)
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("current")

  const pageContainerClass = "mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-10 xl:px-12"
  const panelShellClass =
    "w-full min-w-0 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.16),rgba(3,7,18,0.06))] p-4 sm:rounded-[28px] sm:p-5 md:basis-0 md:flex-1 lg:p-6 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm flex flex-col overflow-hidden min-h-[34rem] sm:min-h-[38rem] md:min-h-0"
  const isSplitWorkspaceActive = mode === TRACKED_RUN_MODE.GENERATE && isSplitWorkspaceOpen
  const isAuthenticated = Boolean(session?.user?.id)
  const authAvailable = Boolean(supabase)
  const userEmail = session?.user?.email ?? null
  const entitlements = planSnapshot.entitlements ?? getPlanEntitlements(SUBSCRIPTION_PLAN.FREE)

  useEffect(() => {
    if (!authMessage) return

    const timer = window.setTimeout(() => setAuthMessage(null), 4500)
    return () => window.clearTimeout(timer)
  }, [authMessage])

  useEffect(() => {
    if (!error) return

    const timer = window.setTimeout(() => setError(null), 4500)
    return () => window.clearTimeout(timer)
  }, [error])

  useEffect(() => {
    const storedTheme =
      typeof window !== "undefined" ? window.localStorage.getItem("resume-studio:background-theme") : null
    if (storedTheme && BACKGROUND_THEMES.some((theme) => theme.id === storedTheme)) {
      setBackgroundTheme(storedTheme as BackgroundTheme)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("resume-studio:background-theme", backgroundTheme)
  }, [backgroundTheme])

  useEffect(() => {
    if (typeof window === "undefined") return

    const url = new URL(window.location.href)
    const billingStatus = url.searchParams.get("billing")
    const checkoutId = url.searchParams.get("checkoutId")

    if (billingStatus !== "success") return

    setAuthMessage(
      checkoutId
        ? "Checkout completed. Refreshing your Pro access..."
        : "Payment completed. Refreshing your Pro access..."
    )

    url.searchParams.delete("billing")
    url.searchParams.delete("checkoutId")
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  }, [])

  useEffect(() => {
    setEditableLatexContent(latexContent)
  }, [latexContent])

  useEffect(() => {
    if (mode !== TRACKED_RUN_MODE.GENERATE) {
      setIsSplitWorkspaceOpen(false)
    }
  }, [mode])

  useEffect(() => {
    const timerStoreRef = jobApplicationSaveTimersRef

    return () => {
      const pendingTimers = timerStoreRef.current
      Object.values(pendingTimers).forEach((timerId) => {
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

  useEffect(() => {
    if (!session?.user?.id) {
      setPlanSnapshot(getGuestPlanSnapshot())
      setIsPlanLoading(false)
      return
    }

    let active = true
    const cachedSnapshot = loadCachedPlanSnapshot(session.user.id)

    if (cachedSnapshot) {
      setPlanSnapshot(cachedSnapshot)
    }

    setIsPlanLoading(true)

    const loadPlan = async () => {
      try {
        const snapshot = await accountServiceClient.getPlan(session?.access_token)
        if (active) {
          setPlanSnapshot(snapshot)
          persistPlanSnapshot(session.user.id, snapshot)
          setIsPlanLoading(false)
        }
      } catch (error) {
        reportClientError(error, "subscription-plan")
        if (active) {
          if (!cachedSnapshot) {
            setPlanSnapshot(getGuestPlanSnapshot())
          }
          setIsPlanLoading(false)
          setAuthMessage("Failed to refresh your subscription plan.")
        }
      }
    }

    void loadPlan()

    return () => {
      active = false
    }
  }, [session?.access_token, session?.user])

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
    input: {
      jobDescription: string
      resumeContent: string
      extraInstructions: string
      extractionArtifacts?: DocumentArtifacts | null
    },
    requestId: number
  ) => {
    if (!entitlements.canUseAiInsights || !session?.access_token) {
      setIsLoadingInsights(false)
      return
    }

    setIsLoadingInsights(true)

    try {
      const data = await atsServiceClient.insights({
        jobDescription: input.jobDescription,
        resumeContent: input.resumeContent,
        extractionArtifacts: input.extractionArtifacts,
      }, session.access_token)

      if (atsRequestIdRef.current !== requestId) return

      setAtsScore(data)
      setHasLoadedAIInsights(true)

      if (savedAtsRunIdRef.current) {
        await updateTrackedRunScore(savedAtsRunIdRef.current, data)
      }
    } catch (prefetchError) {
      if (atsRequestIdRef.current !== requestId) return
      reportClientError(prefetchError, "ats-insights-prefetch")
      console.warn("ATS insights prefetch error:", prefetchError)
    } finally {
      if (atsRequestIdRef.current === requestId) {
        setIsLoadingInsights(false)
      }
    }
  }

  const handleGenerate = async (formData: FormData) => {
    if (isAuthenticated && isPlanLoading) {
      setAuthMessage("Checking your subscription plan...")
      return
    }

    if (!entitlements.canUseAiGenerator) {
      setError(getFeatureUpgradeMessage(PREMIUM_FEATURE.AI_GENERATOR))
      setPlanHighlightFeature(PREMIUM_FEATURE.AI_GENERATOR)
      setIsPlanDialogOpen(true)
      return
    }

    if (!session?.access_token) {
      setAuthMessage("Sign in to access Pro features.")
      setPlanHighlightFeature(PREMIUM_FEATURE.AI_GENERATOR)
      setIsPlanDialogOpen(true)
      return
    }

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

      const data = await resumeServiceClient.generate(formData, session.access_token)
      const latex = data?.latex || ""

      if (!latex) {
        throw new Error("AI returned empty response")
      }

      setLatexContent(latex)
      setStatusMessage(data?.validation?.repaired ? "Generated and auto-repaired successfully." : "")

      if (session?.user?.id) {
        const savedRunId = await saveTrackedRun({
          mode: TRACKED_RUN_MODE.GENERATE,
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
      reportClientError(generationError, "resume-generation")
      console.error("Generation error:", generationError)
      let message =
        getUserFacingMessage(generationError, "Failed to generate resume")

      if (generationError instanceof ServiceClientError) {
        const validationSummary = generationError.data?.validation?.summary
        const validationIssues = Array.isArray(generationError.data?.validation?.issues)
          ? (() => {
              const issues = generationError.data.validation.issues as Array<{
                message?: string
                severity?: "high" | "medium" | "low"
              }>
              const prioritized = [...issues].sort((left, right) => {
                const weight = { high: 3, medium: 2, low: 1 }
                return (weight[right?.severity || "low"] || 0) - (weight[left?.severity || "low"] || 0)
              })
              const uniqueMessages = Array.from(
                new Set(prioritized.map((issue) => issue?.message).filter(Boolean))
              )
              return uniqueMessages.slice(0, 2).join(" ")
            })()
          : ""
        const genericValidationSummary =
          validationSummary === "Local LaTeX validation found issues that may affect compilation or formatting." ||
          validationSummary === "pdflatex compilation failed."
        message =
          (!genericValidationSummary && validationSummary) ||
          validationIssues ||
          validationSummary ||
          generationError.message
      }

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

      const data = await atsServiceClient.score({
        jobDescription: jd,
        resumeContent: resume,
        extractionArtifacts: resumeArtifacts,
      })
      const input = { jobDescription: jd, resumeContent: resume, extraInstructions: additional }
      const elapsed = Date.now() - startedAt
      const remainingDelay = Math.max(0, ATS_LOADING_MIN_DURATION_MS - elapsed)

      if (remainingDelay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingDelay))
      }

      setAtsScore(data)

      if (session?.user?.id) {
        const savedRunId = await saveTrackedRun({
          mode: TRACKED_RUN_MODE.ATS_SCORE,
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

      if (entitlements.canUseAiInsights && session?.access_token) {
        void prefetchATSInsights({ ...input, extractionArtifacts: resumeArtifacts }, requestId)
      }
    } catch (scoringError) {
      reportClientError(scoringError, "ats-score")
      console.error("Scoring error:", scoringError)
      const message = getUserFacingMessage(scoringError, "Failed to score resume")
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

  const handleExportData = async () => {
    if (!session?.access_token) {
      setAuthMessage("Sign in to export your account data.")
      return
    }

    setIsExportingData(true)

    try {
      const blob = await accountServiceClient.exportAccount(session.access_token)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `resume-studio-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setAuthMessage("Your account export is downloading.")
    } catch (error) {
      reportClientError(error, "account-export")
      setAuthMessage(getUserFacingMessage(error, "Failed to export account data"))
    } finally {
      setIsExportingData(false)
    }
  }

  const handleDeleteAccount = async (confirmation: string) => {
    if (!session?.access_token) {
      setAuthMessage("Sign in to delete your account.")
      return
    }

    setIsDeletingAccount(true)

    try {
      await accountServiceClient.deleteAccount(session.access_token, confirmation)

      if (supabase) {
        await supabase.auth.signOut()
      }

      clearLocalTrackedRuns(session.user.id)
      clearLocalJobApplications(session.user.id)
      savedAtsRunIdRef.current = null
      setHistoryItems([])
      setSelectedHistoryRunId(null)
      setJobApplications([])
      setSession(null)
      setIsAuthDialogOpen(false)
      setAuthMessage("Your account has been deleted.")
    } catch (error) {
      reportClientError(error, "account-delete")
      setAuthMessage(getUserFacingMessage(error, "Failed to delete account"))
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleLoadRunFromDashboard = (run: TrackedRunRecord) => {
    setMode(run.mode)
    setJobDescription(run.job_description ?? "")
    setResumeContent(run.resume_content)
    setResumeFileName(run.resume_file_name ?? extractTrackedRunFileName(run.label) ?? "")
    setResumeFileMimeType(run.resume_file_mime_type ?? "")
    setResumeFileDataUrl(run.resume_file_data_url ?? "")
    setResumeArtifacts(null)
    setExtraInstructions(run.extra_instructions ?? "")
    setLatexContent(run.mode === TRACKED_RUN_MODE.GENERATE ? run.latex_content ?? "" : "")
    setAtsScore(run.mode === TRACKED_RUN_MODE.ATS_SCORE ? run.ats_score : null)
    setHasLoadedAIInsights(Boolean(run.mode === TRACKED_RUN_MODE.ATS_SCORE && run.ats_score))
    setIsLoadingInsights(false)
    setIsGenerating(false)
    setIsScoring(false)
    setStatusMessage("")
    setError(null)
    savedAtsRunIdRef.current = run.mode === TRACKED_RUN_MODE.ATS_SCORE ? run.id : null
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

  const handleOpenAuthDialog = useCallback(() => {
    setIsPlanDialogOpen(false)
    setIsAuthDialogOpen(true)
  }, [])

  const handleCloseAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(false)
  }, [])

  const handleOpenPlanDialog = useCallback((feature?: PremiumFeature | null) => {
    if (isAuthenticated && isPlanLoading) {
      setAuthMessage("Checking your subscription plan...")
      return
    }

    setPlanHighlightFeature(feature ?? null)
    setIsPlanDialogOpen(true)
  }, [isAuthenticated, isPlanLoading])

  const handleClosePlanDialog = useCallback(() => {
    if (isBillingActionLoading) return
    setIsPlanDialogOpen(false)
    setPlanHighlightFeature(null)
  }, [isBillingActionLoading])

  const handleBillingAction = useCallback(async () => {
    if (!session?.access_token) {
      setIsPlanDialogOpen(false)
      setIsAuthDialogOpen(true)
      return
    }

    setIsBillingActionLoading(true)

    try {
      const response =
        planSnapshot.plan === SUBSCRIPTION_PLAN.PRO
          ? await billingServiceClient.createCustomerPortalSession(session.access_token)
          : await billingServiceClient.createCheckoutSession(session.access_token)

      window.location.href = response.url
    } catch (error) {
      reportClientError(error, "billing-action")
      setAuthMessage(
        getUserFacingMessage(
          error,
          planSnapshot.plan === SUBSCRIPTION_PLAN.PRO
            ? "Failed to open billing portal."
            : "Failed to start Polar checkout."
        )
      )
    } finally {
      setIsBillingActionLoading(false)
    }
  }, [planSnapshot.plan, session?.access_token])

  const handleOpenPrivacyDialog = useCallback(() => {
    setLegalDialog("privacy")
  }, [])

  const handleOpenTermsDialog = useCallback(() => {
    setLegalDialog("terms")
  }, [])

  const handleCloseLegalDialog = useCallback(() => {
    setLegalDialog(null)
  }, [])

  const handleModeChange = useCallback((nextMode: AppMode) => {
    if (isAuthenticated && isPlanLoading && nextMode === APP_MODE.JOB_TRACKER) {
      setAuthMessage("Checking your subscription plan...")
      return
    }

    if (nextMode === APP_MODE.JOB_TRACKER && !entitlements.canUseJobTracker) {
      setError(getFeatureUpgradeMessage(PREMIUM_FEATURE.JOB_TRACKER))
      setPlanHighlightFeature(PREMIUM_FEATURE.JOB_TRACKER)
      setIsPlanDialogOpen(true)
      return
    }

    setMode(nextMode)
  }, [entitlements.canUseJobTracker, isAuthenticated, isPlanLoading])

  const handleBackgroundThemeChange = useCallback((nextTheme: BackgroundTheme) => {
    setBackgroundTheme(nextTheme)
  }, [])

  const handleDismissError = useCallback(() => {
    setError(null)
  }, [])

  const handleOpenSplitWorkspace = useCallback(() => {
    setIsSplitWorkspaceOpen(true)
  }, [])

  const handleCloseSplitWorkspace = useCallback(() => {
    setIsSplitWorkspaceOpen(false)
  }, [])

  const handleSelectHistoryRun = useCallback((runId: string) => {
    setSelectedHistoryRunId(runId)
  }, [])

  const dashboardProps: DashboardPanelProps = {
    authAvailable,
    isAuthenticated,
    userEmail,
    userName,
    historyItems,
    historyLoading,
    selectedRunId: selectedHistoryRunId,
    deletingRunId,
    onSelectRun: handleSelectHistoryRun,
    onLoadRun: handleLoadRunFromDashboard,
    onDeleteRun: handleDeleteRun,
    onOpenAuth: handleOpenAuthDialog,
    storageNotice,
  }

  const trackerProps: JobApplicationsPanelProps = {
    authAvailable,
    isAuthenticated,
    storageNotice: jobApplicationsNotice,
    applications: jobApplications,
    applicationsLoading: jobApplicationsLoading,
    savingApplicationId: savingJobApplicationId,
    deletingApplicationId: deletingJobApplicationId,
    onAddApplication: handleAddJobApplication,
    onUpdateApplication: handleUpdateJobApplication,
    onDeleteApplication: handleDeleteJobApplication,
    onOpenAuth: handleOpenAuthDialog,
  }

  const inputMode: NonNullable<ResumeInputPanelProps["mode"]> =
    mode === TRACKED_RUN_MODE.ATS_SCORE ? TRACKED_RUN_MODE.ATS_SCORE : TRACKED_RUN_MODE.GENERATE

  const inputProps: ResumeInputPanelProps = {
    onGenerate: mode === TRACKED_RUN_MODE.GENERATE ? handleGenerate : handleATSScore,
    isGenerating: mode === TRACKED_RUN_MODE.GENERATE ? isGenerating : isScoring,
    mode: inputMode,
    canUseAiGenerator: entitlements.canUseAiGenerator,
    jobDescription,
    resumeContent,
    resumeFileName,
    resumeFileMimeType,
    extraInstructions,
    onJobDescriptionChange: setJobDescription,
    onResumeContentChange: setResumeContent,
    onResumeFileNameChange: setResumeFileName,
    onResumeFileMimeTypeChange: setResumeFileMimeType,
    onResumeFileDataUrlChange: setResumeFileDataUrl,
    onResumeArtifactsChange: setResumeArtifacts,
    onExtraInstructionsChange: setExtraInstructions,
    onLockedGenerateAttempt: () => handleOpenPlanDialog(PREMIUM_FEATURE.AI_GENERATOR),
  }

  const previewProps: ResumePreviewPanelProps = {
    latexContent,
    editableLatex: editableLatexContent,
    isGenerating,
    onEditableLatexChange: setEditableLatexContent,
    onOpenSplitWorkspace: handleOpenSplitWorkspace,
    statusMessage,
  }

  const atsProps: ATSScorePanelProps = {
    scoreData: atsScore,
    isLoading: isScoring,
    isLoadingInsights,
    hasLoadedAIInsights,
    canUseAiInsights: entitlements.canUseAiInsights,
    onUpgradeToPro: () => handleOpenPlanDialog(PREMIUM_FEATURE.AI_ATS_INSIGHTS),
  }

  const splitProps: LatexSplitWorkspaceProps = {
    open: isSplitWorkspaceOpen,
    latexContent: editableLatexContent,
    isGenerating,
    statusMessage,
    onLatexChange: setEditableLatexContent,
    onClose: handleCloseSplitWorkspace,
  }

  const authDialogProps: AuthDialogProps = {
    open: isAuthDialogOpen,
    authAvailable,
    authLoading,
    authMessage,
    userEmail,
    isExportingData,
    isDeletingAccount,
    onClose: handleCloseAuthDialog,
    onGoogleAuth: handleSignInWithGoogle,
    onExportData: handleExportData,
    onDeleteAccount: handleDeleteAccount,
  }

  const legalDialogProps: LegalDialogProps = {
    open: legalDialog !== null,
    variant: legalDialog ?? "privacy",
    onClose: handleCloseLegalDialog,
  }

  const planDialogProps: PlanDialogProps = {
    open: isPlanDialogOpen,
    currentPlan: planSnapshot.plan,
    isAuthenticated,
    highlightedFeature: planHighlightFeature,
    isBillingActionLoading,
    onClose: handleClosePlanDialog,
    onOpenAuth: handleOpenAuthDialog,
    onBillingAction: handleBillingAction,
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#030712] md:h-screen md:overflow-hidden">
      <div className="fixed inset-0 h-full w-full">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#020202_0%,#050505_45%,#020202_100%)]" />
        <ErrorBoundary
          context="webgl-background"
          fallbackTitle="Background disabled"
          fallbackMessage="The animated background failed to initialize. The workspace is still available."
          compact
        >
          <WebGLShader theme={backgroundTheme} />
        </ErrorBoundary>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.38))]" />
      </div>

      {isSplitWorkspaceActive ? null : (
        <>
          <PageHeader
            mode={mode}
            userEmail={userEmail}
            currentPlan={planSnapshot.plan}
            pageContainerClass={pageContainerClass}
            onModeChange={handleModeChange}
            onOpenAuth={handleOpenAuthDialog}
            onOpenPlans={() => handleOpenPlanDialog()}
            onSignOut={handleSignOut}
          />

          <ErrorBanner error={error} onDismiss={handleDismissError} />

          <MainContent
            mode={mode}
            pageContainerClass={pageContainerClass}
            panelShellClass={panelShellClass}
            outputPanelRef={outputPanelRef}
            dashboardProps={dashboardProps}
            trackerProps={trackerProps}
            inputProps={inputProps}
            previewProps={previewProps}
            atsProps={atsProps}
          />
        </>
      )}

      <SplitWorkspaceLayer mode={mode} splitProps={splitProps} />

      <DialogLayer authProps={authDialogProps} legalProps={legalDialogProps} planProps={planDialogProps} />

      <PageFooter
        hidden={isSplitWorkspaceActive}
        backgroundTheme={backgroundTheme}
        onOpenPrivacy={handleOpenPrivacyDialog}
        onOpenTerms={handleOpenTermsDialog}
        onThemeChange={handleBackgroundThemeChange}
      />
    </div>
  )
}
