"use client"

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react"

import dynamic from "next/dynamic"

import {
  BriefcaseBusiness,
  ChevronDown,
  FileCode2,
  Gauge,
  Gem,
  House,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react"

import { computeOverviewStandaloneScore } from "@/components/ats/ats-panel-sections"
import { ErrorBoundary } from "@/components/error-boundary"
import { Button } from "@/components/ui/button"
import {
  accountServiceClient,
  billingServiceClient,
} from "@/features/subscription/client/service-client"
import {
  getFeatureUpgradeMessage,
  getGuestPlanSnapshot,
  getPlanEntitlements,
  isPlanSnapshot,
  PREMIUM_FEATURE,
  SUBSCRIPTION_PLAN,
  type PlanSnapshot,
  type PremiumFeature,
} from "@/features/subscription/types"
import {
  BACKGROUND_THEMES,
  type BackgroundTheme,
} from "@/features/workspace/background-themes"
import { useUIState } from "@/features/workspace/hooks/use-ui-state"
import { useWorkspacePersistence } from "@/features/workspace/hooks/use-workspace-persistence"
import {
  type AppMode,
  useWorkspaceState,
} from "@/features/workspace/hooks/use-workspace-state"
import {
  APP_MODE,
  WORKSPACE_MODE_COOKIE_NAME,
  coerceAppMode,
} from "@/features/workspace/workspace-mode"
import { trackEvent } from "@/lib/analytics"
import { clearATSAnalysisCaches } from "@/lib/ats-analysis-cache"
import type { ATSNLPAnalysis } from "@/lib/ats-nlp-analysis-types"
import type { RuntimeSpellCheckMetrics } from "@/lib/ats-runtime-spell-check"
import {
  clearServerSession,
  syncServerSession,
} from "@/lib/auth-session-client"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import { reportClientError } from "@/lib/error-monitoring"
import { getUserFacingMessage } from "@/lib/errors"
import { type JobApplicationRecord } from "@/lib/job-applications"
import { latexToPlainText } from "@/lib/latex-text"
import {
  atsServiceClient,
  documentServiceClient,
  resumeServiceClient,
  ServiceClientError,
} from "@/lib/services/gateway-client"
import {
  extractTrackedRunFileName,
  TRACKED_RUN_MODE,
  type TrackedRunRecord,
} from "@/lib/tracked-runs"
import { cn } from "@/lib/utils"
import type { ATSScoreResponse } from "@/types/ats"

import type { Session, SupabaseClient } from "@supabase/supabase-js"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ATS_LOADING_MIN_DURATION_MS = 3200
const ATS_AI_INSIGHTS_ENABLED = false
const PLAN_SNAPSHOT_STORAGE_KEY_PREFIX = "resume-studio:plan-snapshot:"
const WORKSPACE_DRAFT_STORAGE_KEY_PREFIX = "resume-studio:workspace-draft:"

type WorkspaceDraft = {
  mode: AppMode
  jobDescription: string
  resumeContent: string
  resumeFileName: string
  resumeFileMimeType: string
  resumeFileDataUrl: string
  extraInstructions: string
  latexContent: string
  editableLatexContent: string
  atsScore: ATSScoreResponse | null
  atsNlpAnalysis: ATSNLPAnalysis | null
  atsRuntimeSpellMetrics: RuntimeSpellCheckMetrics | null
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("Failed to read generated PDF."))
    reader.readAsDataURL(blob)
  })
}

function buildGeneratedPdfFileName(
  sourceFileName: string,
  jobDescription: string
) {
  const source = sourceFileName.trim()
  if (source) {
    const normalized = source.replace(/\.[^.]+$/, "")
    return `${normalized || "generated-resume"}.pdf`
  }

  const jdTitle = jobDescription
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)

  return `${jdTitle || "generated-resume"}.pdf`
}

function getPlanSnapshotStorageKey(userId: string) {
  return `${PLAN_SNAPSHOT_STORAGE_KEY_PREFIX}${userId}`
}

function getWorkspaceDraftStorageKey(userId: string) {
  return `${WORKSPACE_DRAFT_STORAGE_KEY_PREFIX}${userId}`
}

function loadWorkspaceDraft(userId: string): WorkspaceDraft | null {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(getWorkspaceDraftStorageKey(userId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceDraft>
    if (!parsed || typeof parsed !== "object") return null

    const mode = coerceAppMode(parsed.mode)

    return {
      mode,
      jobDescription:
        typeof parsed.jobDescription === "string" ? parsed.jobDescription : "",
      resumeContent:
        typeof parsed.resumeContent === "string" ? parsed.resumeContent : "",
      resumeFileName:
        typeof parsed.resumeFileName === "string" ? parsed.resumeFileName : "",
      resumeFileMimeType:
        typeof parsed.resumeFileMimeType === "string"
          ? parsed.resumeFileMimeType
          : "",
      resumeFileDataUrl:
        typeof parsed.resumeFileDataUrl === "string"
          ? parsed.resumeFileDataUrl
          : "",
      extraInstructions:
        typeof parsed.extraInstructions === "string"
          ? parsed.extraInstructions
          : "",
      latexContent:
        typeof parsed.latexContent === "string" ? parsed.latexContent : "",
      editableLatexContent:
        typeof parsed.editableLatexContent === "string"
          ? parsed.editableLatexContent
          : "",
      atsScore:
        (parsed.atsScore as ATSScoreResponse | null | undefined) ?? null,
      atsNlpAnalysis:
        (parsed.atsNlpAnalysis as ATSNLPAnalysis | null | undefined) ?? null,
      atsRuntimeSpellMetrics:
        (parsed.atsRuntimeSpellMetrics as
          | RuntimeSpellCheckMetrics
          | null
          | undefined) ?? null,
    }
  } catch {
    return null
  }
}

function persistWorkspaceDraft(userId: string, draft: WorkspaceDraft) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(
    getWorkspaceDraftStorageKey(userId),
    JSON.stringify(draft)
  )
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
  window.localStorage.setItem(
    getPlanSnapshotStorageKey(userId),
    JSON.stringify(snapshot)
  )
}

function getValidationPayload(value: Record<string, unknown> | null) {
  const validation = value?.validation
  return validation && typeof validation === "object"
    ? (validation as {
        summary?: string
        issues?: Array<{
          message?: string
          severity?: "high" | "medium" | "low"
        }>
      })
    : null
}

const preloadWebglShader = () => import("@/components/webgl-shader")
const preloadDashboardPanel = () => import("@/components/dashboard-panel")
const preloadJobApplicationsPanel = () =>
  import("@/components/job-applications-panel")
const preloadResumeInputPanel = () => import("@/components/resume-input-panel")
const preloadResumePreviewPanel = () =>
  import("@/components/resume-preview-panel")
const preloadATSScorePanel = () => import("@/components/ats-score-panel")
const preloadLatexSplitWorkspace = () =>
  import("@/components/latex-split-workspace")
const preloadAuthDialog = () => import("@/components/auth-dialog")
const preloadLegalDialog = () => import("@/components/legal-dialog")
const preloadPlanDialog = () =>
  import("@/features/subscription/components/plan-dialog")

const WebGLShader = dynamic(
  () => preloadWebglShader().then((mod) => mod.WebGLShader),
  { ssr: false, loading: () => null }
)

const DashboardPanel = dynamic(
  () => preloadDashboardPanel().then((mod) => mod.DashboardPanel),
  {
    loading: () => null,
  }
)

const JobApplicationsPanel = dynamic(
  () => preloadJobApplicationsPanel().then((mod) => mod.JobApplicationsPanel),
  { loading: () => null }
)

const ResumeInputPanel = dynamic(
  () => preloadResumeInputPanel().then((mod) => mod.ResumeInputPanel),
  {
    loading: () => null,
  }
)

const ResumePreviewPanel = dynamic(
  () => preloadResumePreviewPanel().then((mod) => mod.ResumePreviewPanel),
  { loading: () => null }
)

const ATSScorePanel = dynamic(
  () => preloadATSScorePanel().then((mod) => mod.ATSScorePanel),
  {
    loading: () => null,
  }
)

const LatexSplitWorkspace = dynamic(
  () => preloadLatexSplitWorkspace().then((mod) => mod.LatexSplitWorkspace),
  { loading: () => null }
)

const AuthDialog = dynamic(
  () => preloadAuthDialog().then((mod) => mod.AuthDialog),
  {
    loading: () => null,
  }
)

const LegalDialog = dynamic(
  () => preloadLegalDialog().then((mod) => mod.LegalDialog),
  {
    loading: () => null,
  }
)

const PlanDialog = dynamic(
  () => preloadPlanDialog().then((mod) => mod.PlanDialog),
  {
    loading: () => null,
  }
)

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
            aria-pressed={mode === APP_MODE.HOME}
            onClick={() => onModeChange(APP_MODE.HOME)}
            className={cn(
              "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
              mode === APP_MODE.HOME
                ? "shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                : "opacity-60 saturate-50 shadow-none hover:opacity-100"
            )}
          >
            <House className="h-4 w-4" />
            <span className="text-xs font-medium sm:text-sm">Home</span>
          </Button>
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
            <span className="text-xs font-medium sm:text-sm">
              LaTeX Generator
            </span>
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
            <Gauge className="h-4 w-4" />
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
            <Gem className="h-4 w-4" />
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
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
})

const HomePanel = memo(function HomePanel({
  panelShellClass,
  onModeChange,
}: {
  panelShellClass: string
  onModeChange: (mode: AppMode) => void
}) {
  return (
    <div
      className={cn(
        panelShellClass,
        "justify-center overflow-visible px-5 py-8 sm:px-8 sm:py-10 lg:px-10"
      )}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/60">
            <FileCode2 className="h-3.5 w-3.5 text-primary" />
            Resume Studio
          </div>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Build stronger applications from one workspace.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
              Resume Studio helps you generate tailored LaTeX resumes and review
              ATS compatibility before you apply, while keeping account access
              and the rest of the workspace available from the same UI.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="cool"
            size="lg"
            onClick={() => onModeChange(TRACKED_RUN_MODE.GENERATE)}
            className="h-11 rounded-full px-6 text-sm"
          >
            <FileCode2 className="h-4 w-4" />
            Try LaTeX Generator
          </Button>
          <Button
            type="button"
            variant="cool"
            size="lg"
            onClick={() => onModeChange(TRACKED_RUN_MODE.ATS_SCORE)}
            className="h-11 rounded-full px-6 text-sm"
          >
            <Gauge className="h-4 w-4" />
            Get ATS Score
          </Button>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-white">Tailored output</p>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Generate role-specific LaTeX resumes without leaving the app.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-white">ATS review</p>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Check structure and keyword alignment before submitting.
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/18 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-white">
              Dashboard and tracking
            </p>
            <p className="mt-2 text-sm leading-6 text-white/58">
              Review saved runs in the dashboard and stay on top of your
              applications with the built-in job tracker.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

const MainContent = memo(function MainContent({
  mode,
  pageContainerClass,
  panelShellClass,
  outputPanelRef,
  onModeChange,
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
  onModeChange: (mode: AppMode) => void
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
      {mode === APP_MODE.HOME ? (
        <HomePanel
          panelShellClass={cn(panelShellClass, "md:basis-auto md:flex-auto")}
          onModeChange={onModeChange}
        />
      ) : mode === APP_MODE.DASHBOARD ? (
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
      ) : mode === TRACKED_RUN_MODE.ATS_SCORE ? (
        <div
          ref={outputPanelRef}
          className={cn(panelShellClass, "md:basis-auto md:flex-auto")}
        >
          <ErrorBoundary
            context="ats-score-panel"
            fallbackTitle="ATS results unavailable"
            fallbackMessage="The ATS results panel failed to render. Reload this section to continue."
          >
            <ATSScorePanel {...atsProps} />
          </ErrorBoundary>
        </div>
      ) : (
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col gap-4 md:items-stretch md:overflow-hidden",
            "md:flex-row"
          )}
        >
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
            <ErrorBoundary
              context="resume-preview-panel"
              fallbackTitle="Preview unavailable"
              fallbackMessage="The resume preview failed to render. You can reload just this panel."
            >
              <ResumePreviewPanel {...previewProps} />
            </ErrorBoundary>
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
      <button
        type="button"
        onClick={onOpenPrivacy}
        className="transition-colors hover:text-white/50"
      >
        Privacy Policy
      </button>
      <span className="text-white/14">•</span>
      <button
        type="button"
        onClick={onOpenTerms}
        className="transition-colors hover:text-white/50"
      >
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
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/6 hover:text-white/80"
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

export default function AppShell({ initialMode }: { initialMode?: AppMode }) {
  const atsRequestIdRef = useRef(0)
  const outputPanelRef = useRef<HTMLDivElement>(null)
  const savedAtsRunIdRef = useRef<string | null>(null)

  const {
    APP_MODE,
    mode,
    setMode,
    jobDescription,
    setJobDescription,
    resumeContent,
    setResumeContent,
    resumeFileName,
    setResumeFileName,
    resumeFileMimeType,
    setResumeFileMimeType,
    resumeFileDataUrl,
    setResumeFileDataUrl,
    resumeArtifacts,
    setResumeArtifacts,
    extraInstructions,
    setExtraInstructions,
    latexContent,
    setLatexContent,
    editableLatexContent,
    setEditableLatexContent,
    isGenerating,
    setIsGenerating,
    statusMessage,
    setStatusMessage,
    error,
    setError,
    atsScore,
    setAtsScore,
    atsNlpAnalysis,
    setAtsNlpAnalysis,
    atsRuntimeSpellMetrics,
    setAtsRuntimeSpellMetrics,
    isScoring,
    setIsScoring,
    isLoadingInsights,
    setIsLoadingInsights,
    hasLoadedAIInsights,
    setHasLoadedAIInsights,
  } = useWorkspaceState(coerceAppMode(initialMode))

  const invalidateATSRequests = useCallback(() => {
    atsRequestIdRef.current += 1
    savedAtsRunIdRef.current = null
    setAtsNlpAnalysis(null)
    setAtsRuntimeSpellMetrics(null)
    setIsLoadingInsights(false)
    setHasLoadedAIInsights(false)
  }, [
    setAtsNlpAnalysis,
    setAtsRuntimeSpellMetrics,
    setHasLoadedAIInsights,
    setIsLoadingInsights,
  ])
  const [session, setSession] = useState<Session | null>(null)
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [isSupabaseReady, setIsSupabaseReady] = useState(false)
  const [isBackgroundReady, setIsBackgroundReady] = useState(false)
  const [planSnapshot, setPlanSnapshot] = useState<PlanSnapshot>(() =>
    getGuestPlanSnapshot()
  )
  const [isPlanLoading, setIsPlanLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const {
    authMessage,
    setAuthMessage,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isPlanDialogOpen,
    setIsPlanDialogOpen,
    planHighlightFeature,
    setPlanHighlightFeature,
    isBillingActionLoading,
    setIsBillingActionLoading,
    isExportingData,
    setIsExportingData,
    isDeletingAccount,
    setIsDeletingAccount,
    legalDialog,
    setLegalDialog,
    isSplitWorkspaceOpen,
    setIsSplitWorkspaceOpen,
    backgroundTheme,
    setBackgroundTheme,
  } = useUIState()
  const pageContainerClass =
    "mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-10 xl:px-12"
  const panelShellClass =
    "w-full min-w-0 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.16),rgba(3,7,18,0.06))] p-4 sm:rounded-[28px] sm:p-5 md:basis-0 md:flex-1 lg:p-6 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm flex flex-col overflow-hidden min-h-[34rem] sm:min-h-[38rem] md:min-h-0"
  const isSplitWorkspaceActive =
    mode === TRACKED_RUN_MODE.GENERATE && isSplitWorkspaceOpen
  const isAuthenticated = Boolean(session?.user?.id)
  const hasRestoredWorkspaceRef = useRef(false)
  const hasLoadedWorkspaceDraftRef = useRef(false)
  const [isWorkspaceRestoreReady, setIsWorkspaceRestoreReady] = useState(false)
  const authAvailable = Boolean(supabase)
  const userEmail = session?.user?.email ?? null
  const entitlements =
    planSnapshot.entitlements ?? getPlanEntitlements(SUBSCRIPTION_PLAN.FREE)
  const {
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
    refreshHistory,
  } = useWorkspacePersistence({
    session,
    supabase,
    setAuthMessage,
  })

  useEffect(() => {
    let active = true

    void import("@/lib/supabase-browser")
      .then((mod) => {
        if (!active) return
        setSupabase(mod.getSupabaseBrowserClient())
        setIsSupabaseReady(true)
      })
      .catch(() => {
        if (!active) return
        setSupabase(null)
        setIsSupabaseReady(true)
        setAuthLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    if ("requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(() => {
        setIsBackgroundReady(true)
      })

      return () => window.cancelIdleCallback(idleCallbackId)
    }

    const timeoutId = globalThis.setTimeout(() => {
      setIsBackgroundReady(true)
    }, 250)

    return () => globalThis.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!error) return

    const timer = window.setTimeout(() => setError(null), 4500)
    return () => window.clearTimeout(timer)
  }, [error, setError])

  useEffect(() => {
    if (typeof document === "undefined") return

    document.cookie = `${WORKSPACE_MODE_COOKIE_NAME}=${encodeURIComponent(mode)}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [mode])

  useEffect(() => {
    void preloadResumeInputPanel()

    if (mode === APP_MODE.DASHBOARD) {
      void preloadDashboardPanel()
      return
    }

    if (mode === APP_MODE.JOB_TRACKER) {
      void preloadJobApplicationsPanel()
      return
    }

    if (mode === TRACKED_RUN_MODE.GENERATE) {
      void preloadResumePreviewPanel()
      if (isSplitWorkspaceOpen) {
        void preloadLatexSplitWorkspace()
      }
      return
    }

    if (mode === TRACKED_RUN_MODE.ATS_SCORE) {
      void preloadATSScorePanel()
    }
  }, [APP_MODE, isSplitWorkspaceOpen, mode])

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!isAuthenticated) {
      void preloadAuthDialog()
      return
    }

    void preloadDashboardPanel()

    if (entitlements.canUseJobTracker) {
      void preloadJobApplicationsPanel()
    }

    if (!entitlements.canUseAiGenerator || !entitlements.canUseAiInsights) {
      void preloadPlanDialog()
    }
  }, [
    entitlements.canUseAiGenerator,
    entitlements.canUseAiInsights,
    entitlements.canUseJobTracker,
    isAuthenticated,
  ])

  useEffect(() => {
    if (legalDialog) {
      void preloadLegalDialog()
    }
  }, [legalDialog])

  useEffect(() => {
    if (isAuthDialogOpen) {
      void preloadAuthDialog()
    }
  }, [isAuthDialogOpen])

  useEffect(() => {
    if (isPlanDialogOpen) {
      void preloadPlanDialog()
    }
  }, [isPlanDialogOpen])

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
    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}${url.hash}`
    )
  }, [setAuthMessage])

  useEffect(() => {
    if (mode !== TRACKED_RUN_MODE.GENERATE) {
      setIsSplitWorkspaceOpen(false)
    }
  }, [mode, setIsSplitWorkspaceOpen])

  useEffect(() => {
    if (!supabase) {
      if (isSupabaseReady) {
        setAuthLoading(false)
      }
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
        setAuthMessage(
          sessionError instanceof Error
            ? sessionError.message
            : "Failed to load session"
        )
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
  }, [isSupabaseReady, setAuthMessage, supabase])

  useEffect(() => {
    let active = true

    if (!session?.access_token) {
      void clearServerSession().catch(() => undefined)
      return () => {
        active = false
      }
    }

    void syncServerSession(session.access_token).catch((error) => {
      if (!active) return
      reportClientError(error, "auth-session-sync")
    })

    return () => {
      active = false
    }
  }, [session?.access_token])

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
        const snapshot = await accountServiceClient.getPlan(
          session?.access_token
        )
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
  }, [session?.access_token, session?.user, setAuthMessage])

  useEffect(() => {
    if (!session?.user?.id) return

    setIsAuthDialogOpen(false)
  }, [session?.user?.id, setIsAuthDialogOpen])

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

  useEffect(() => {
    if (!authLoading && !session?.user?.id) {
      savedAtsRunIdRef.current = null
      hasRestoredWorkspaceRef.current = false
      hasLoadedWorkspaceDraftRef.current = false
      setIsWorkspaceRestoreReady(true)
    }
  }, [authLoading, session?.user?.id])

  useEffect(() => {
    if (authLoading) {
      setIsWorkspaceRestoreReady(false)
      return
    }

    if (!session?.user?.id) {
      setIsWorkspaceRestoreReady(true)
      return
    }

    if (!hasLoadedWorkspaceDraftRef.current) return
    setIsWorkspaceRestoreReady(true)
  }, [authLoading, session?.user?.id])

  useLayoutEffect(() => {
    if (!session?.user?.id) return
    if (hasLoadedWorkspaceDraftRef.current) return

    hasLoadedWorkspaceDraftRef.current = true
    const draft = loadWorkspaceDraft(session.user.id)
    if (!draft) return

    setMode(draft.mode)
    setJobDescription(draft.jobDescription)
    setResumeContent(draft.resumeContent)
    setResumeFileName(draft.resumeFileName)
    setResumeFileMimeType(draft.resumeFileMimeType)
    setResumeFileDataUrl(draft.resumeFileDataUrl)
    setExtraInstructions(draft.extraInstructions)
    setLatexContent(draft.latexContent)
    setEditableLatexContent(draft.editableLatexContent)
    setAtsScore(draft.atsScore)
    setAtsNlpAnalysis(draft.atsNlpAnalysis)
    setAtsRuntimeSpellMetrics(draft.atsRuntimeSpellMetrics)
    setHasLoadedAIInsights(
      Boolean(draft.mode === TRACKED_RUN_MODE.ATS_SCORE && draft.atsScore)
    )
    setIsLoadingInsights(false)
    setIsGenerating(false)
    setIsScoring(false)
    setStatusMessage("")
    setError(null)
    hasRestoredWorkspaceRef.current = true
    setIsWorkspaceRestoreReady(true)
  }, [
    session?.user?.id,
    setAtsNlpAnalysis,
    setAtsScore,
    setAtsRuntimeSpellMetrics,
    setEditableLatexContent,
    setError,
    setExtraInstructions,
    setHasLoadedAIInsights,
    setIsGenerating,
    setIsLoadingInsights,
    setIsScoring,
    setJobDescription,
    setLatexContent,
    setMode,
    setResumeContent,
    setResumeFileDataUrl,
    setResumeFileMimeType,
    setResumeFileName,
    setStatusMessage,
  ])

  useEffect(() => {
    if (!session?.user?.id) return
    if (!hasLoadedWorkspaceDraftRef.current) return

    persistWorkspaceDraft(session.user.id, {
      mode,
      jobDescription,
      resumeContent,
      resumeFileName,
      resumeFileMimeType,
      resumeFileDataUrl,
      extraInstructions,
      latexContent,
      editableLatexContent,
      atsScore,
      atsNlpAnalysis,
      atsRuntimeSpellMetrics,
    })
  }, [
    atsNlpAnalysis,
    atsRuntimeSpellMetrics,
    atsScore,
    editableLatexContent,
    extraInstructions,
    jobDescription,
    latexContent,
    mode,
    resumeContent,
    resumeFileDataUrl,
    resumeFileMimeType,
    resumeFileName,
    session?.user?.id,
  ])

  const prefetchATSInsights = async (
    input: {
      jobDescription: string
      resumeContent: string
      extraInstructions: string
      extractionArtifacts?: DocumentArtifacts | null
    },
    requestId: number
  ) => {
    if (
      !ATS_AI_INSIGHTS_ENABLED ||
      !entitlements.canUseAiInsights ||
      !session?.access_token
    ) {
      setIsLoadingInsights(false)
      return
    }

    setIsLoadingInsights(true)

    try {
      const data = await atsServiceClient.insights(
        {
          jobDescription: input.jobDescription,
          resumeContent: input.resumeContent,
          extractionArtifacts: input.extractionArtifacts,
        },
        session.access_token
      )

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

  const loadFrozenATSAnalysis = useCallback(
    async (input: { resumeContent: string }) => {
      const [spellResponse, nlpResponse] = await Promise.all([
        fetch("/api/ats-spell-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: input.resumeContent }),
        }).catch(() => null),
        fetch("/api/ats-nlp-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeContent: input.resumeContent,
          }),
        }).catch(() => null),
      ])

      const [spellMetrics, nlpAnalysis] = await Promise.all([
        spellResponse?.ok
          ? (spellResponse.json() as Promise<RuntimeSpellCheckMetrics>)
          : Promise.resolve(null),
        nlpResponse?.ok
          ? (nlpResponse.json() as Promise<ATSNLPAnalysis>)
          : Promise.resolve(null),
      ])

      return {
        spellMetrics,
        nlpAnalysis,
      }
    },
    []
  )

  const handleGenerate = async (formData: FormData) => {
    invalidateATSRequests()

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

    try {
      const jd = (formData.get("jobDescription") as string | null)?.trim() || ""
      const resume =
        (formData.get("resumeContent") as string | null)?.trim() || ""
      const additional =
        (formData.get("extraInstructions") as string | null)?.trim() || ""

      if (!jd || !resume) {
        throw new Error("Job description and resume content are required.")
      }

      if (resume.length > MAX_FILE_SIZE) {
        throw new Error("Resume content is too large. Please reduce the size.")
      }

      setStatusMessage("Generating optimized resume...")

      const data = await resumeServiceClient.generate(
        formData,
        session.access_token
      )
      const latex = data?.latex || ""

      if (!latex) {
        throw new Error("AI returned empty response")
      }

      setLatexContent(latex)
      setStatusMessage(
        data?.validation?.repaired
          ? "Generated and auto-repaired successfully."
          : ""
      )
      trackEvent("resume_generated", {
        authenticated: Boolean(session?.user?.id),
        repaired: Boolean(data?.validation?.repaired),
      })

      if (session?.user?.id) {
        let generatedPdfDataUrl = ""
        let generatedPdfFileName = ""

        try {
          setStatusMessage("Compiling generated PDF for dashboard save...")
          const generatedPdfResponse = await documentServiceClient.compileLatex(
            {
              latex,
              preview: false,
            }
          )
          const generatedPdfBlob = await generatedPdfResponse.blob()
          generatedPdfDataUrl = await readBlobAsDataUrl(generatedPdfBlob)
          generatedPdfFileName = buildGeneratedPdfFileName(resumeFileName, jd)
        } catch (savePdfError) {
          reportClientError(savePdfError, "generated-pdf-save")
          console.warn("Generated PDF save preparation failed:", savePdfError)
          setAuthMessage(
            "Generated resume saved without PDF attachment. LaTeX output is still available."
          )
        }

        const savedRunId = await saveTrackedRun({
          mode: TRACKED_RUN_MODE.GENERATE,
          jobDescription: jd,
          resumeContent: latexToPlainText(latex),
          sourceFileName: generatedPdfFileName || undefined,
          sourceFileMimeType: generatedPdfDataUrl
            ? "application/pdf"
            : undefined,
          sourceFileDataUrl: generatedPdfDataUrl || undefined,
          extraInstructions: additional,
          latexContent: latex,
        })

        if (savedRunId) {
          setAuthMessage(
            generatedPdfDataUrl
              ? "Resume saved to your account."
              : "Resume saved to your account without PDF attachment."
          )
        }
      }
    } catch (generationError) {
      reportClientError(generationError, "resume-generation")
      console.error("Generation error:", generationError)
      let message = getUserFacingMessage(
        generationError,
        "Failed to generate resume"
      )

      if (generationError instanceof ServiceClientError) {
        const validation = getValidationPayload(generationError.data)
        const validationSummary = validation?.summary
        const validationIssues = Array.isArray(validation?.issues)
          ? (() => {
              const issues = validation.issues
              const prioritized = [...issues].sort((left, right) => {
                const weight = { high: 3, medium: 2, low: 1 }
                return (
                  (weight[right?.severity || "low"] || 0) -
                  (weight[left?.severity || "low"] || 0)
                )
              })
              const uniqueMessages = Array.from(
                new Set(
                  prioritized.map((issue) => issue?.message).filter(Boolean)
                )
              )
              return uniqueMessages.slice(0, 2).join(" ")
            })()
          : ""
        const genericValidationSummary =
          validationSummary ===
            "Local LaTeX validation found issues that may affect compilation or formatting." ||
          validationSummary === "pdflatex compilation failed."
        message =
          (!genericValidationSummary && validationSummary) ||
          validationIssues ||
          validationSummary ||
          generationError.message
      }

      setError(message)
      setLatexContent("")
      setStatusMessage("")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleATSScore = async (formData: FormData) => {
    clearATSAnalysisCaches()
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
      const resume =
        (formData.get("resumeContent") as string | null)?.trim() || ""
      const additional =
        (formData.get("extraInstructions") as string | null)?.trim() || ""

      if (!resume) {
        throw new Error("Resume content is required.")
      }

      const [data, frozenAnalysis] = await Promise.all([
        atsServiceClient.score({
          jobDescription: jd,
          resumeContent: resume,
          extractionArtifacts: resumeArtifacts,
        }),
        loadFrozenATSAnalysis({
          resumeContent: resume,
        }),
      ])
      const input = {
        jobDescription: jd,
        resumeContent: resume,
        extraInstructions: additional,
      }
      const elapsed = Date.now() - startedAt
      const remainingDelay = Math.max(0, ATS_LOADING_MIN_DURATION_MS - elapsed)

      if (remainingDelay > 0) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, remainingDelay)
        )
      }

      if (atsRequestIdRef.current !== requestId) {
        return
      }

      const normalizedScore: ATSScoreResponse = {
        ...data,
        standaloneResumeScore: computeOverviewStandaloneScore({
          scoreData: data,
          resumeContent: resume,
          runtimeSpellMetrics: frozenAnalysis.spellMetrics,
          // Keep the saved standalone score aligned with the
          // exact Overview metric computation shown in the ATS panel.
          nlpAnalysis: null,
        }),
      }

      setAtsRuntimeSpellMetrics(frozenAnalysis.spellMetrics)
      setAtsNlpAnalysis(frozenAnalysis.nlpAnalysis)

      if (session?.user?.id) {
        const savedRunId = await saveTrackedRun({
          mode: TRACKED_RUN_MODE.ATS_SCORE,
          jobDescription: jd,
          resumeContent: resume,
          sourceFileName: resumeFileName,
          sourceFileMimeType: resumeFileMimeType,
          sourceFileDataUrl: resumeFileDataUrl,
          extraInstructions: additional,
          atsScore: normalizedScore,
        })

        if (atsRequestIdRef.current !== requestId) {
          return
        }

        savedAtsRunIdRef.current = savedRunId

        if (savedRunId) {
          await refreshHistory()
          setAuthMessage("ATS score saved to your account.")
        }
      }

      setAtsScore(normalizedScore)

      if (
        ATS_AI_INSIGHTS_ENABLED &&
        entitlements.canUseAiInsights &&
        session?.access_token
      ) {
        void prefetchATSInsights(
          { ...input, extractionArtifacts: resumeArtifacts },
          requestId
        )
      }

      trackEvent("ats_scored", {
        authenticated: Boolean(session?.user?.id),
        ai_insights_available:
          ATS_AI_INSIGHTS_ENABLED && entitlements.canUseAiInsights,
      })
    } catch (scoringError) {
      reportClientError(scoringError, "ats-score")
      console.error("Scoring error:", scoringError)
      const message = getUserFacingMessage(
        scoringError,
        "Failed to score resume"
      )
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
      trackEvent("signin_failed", { provider: "google" })
      return
    }

    trackEvent("signin_started", { provider: "google" })
  }

  const handleEmailSignIn = async (email: string, password: string) => {
    if (!supabase) {
      setAuthMessage("Supabase is not configured yet.")
      return
    }

    setAuthLoading(true)
    setAuthMessage(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setAuthLoading(false)
      setAuthMessage(signInError.message)
      trackEvent("signin_failed", { provider: "password" })
      return
    }

    setAuthLoading(false)
    setAuthMessage("Signed in successfully.")
    trackEvent("signin_completed", { provider: "password" })
  }

  const handleEmailSignUp = async (input: {
    firstName: string
    lastName: string
    email: string
    password: string
  }) => {
    if (!supabase) {
      setAuthMessage("Supabase is not configured yet.")
      return false
    }

    setAuthLoading(true)
    setAuthMessage(null)

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : process.env.NEXT_PUBLIC_APP_URL

    const fullName = `${input.firstName} ${input.lastName}`.trim()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          full_name: fullName,
          name: fullName,
        },
      },
    })

    if (signUpError) {
      setAuthLoading(false)
      setAuthMessage(signUpError.message)
      trackEvent("signup_failed", { provider: "password" })
      return false
    }

    setAuthLoading(false)
    setAuthMessage(
      data.session
        ? "Account created and signed in."
        : "Account created. Check your email to confirm your address before signing in."
    )
    trackEvent("signup_completed", {
      provider: "password",
      session_created: Boolean(data.session),
    })
    return true
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
      const blob = await accountServiceClient.exportAccount(
        session.access_token
      )
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `resume-studio-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setAuthMessage("Your account export is downloading.")
      trackEvent("account_exported")
    } catch (error) {
      reportClientError(error, "account-export")
      setAuthMessage(
        getUserFacingMessage(error, "Failed to export account data")
      )
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
      await accountServiceClient.deleteAccount(
        session.access_token,
        confirmation
      )

      if (supabase) {
        await supabase.auth.signOut()
      }

      clearCachedRecords(session.user.id)
      savedAtsRunIdRef.current = null
      setSession(null)
      setIsAuthDialogOpen(false)
      setAuthMessage("Your account has been deleted.")
      trackEvent("account_deleted")
    } catch (error) {
      reportClientError(error, "account-delete")
      setAuthMessage(getUserFacingMessage(error, "Failed to delete account"))
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleLoadRunFromDashboard = useCallback(
    (run: TrackedRunRecord) => {
      clearATSAnalysisCaches()
      invalidateATSRequests()
      setMode(run.mode)
      setJobDescription(run.job_description ?? "")
      setResumeContent(run.resume_content)
      setResumeFileName(
        run.resume_file_name ?? extractTrackedRunFileName(run.label) ?? ""
      )
      setResumeFileMimeType(run.resume_file_mime_type ?? "")
      setResumeFileDataUrl(run.resume_file_data_url ?? "")
      setResumeArtifacts(null)
      setExtraInstructions(run.extra_instructions ?? "")
      setLatexContent(
        run.mode === TRACKED_RUN_MODE.GENERATE ? (run.latex_content ?? "") : ""
      )
      setAtsScore(
        run.mode === TRACKED_RUN_MODE.ATS_SCORE ? run.ats_score : null
      )
      setAtsNlpAnalysis(null)
      setAtsRuntimeSpellMetrics(null)
      setIsGenerating(false)
      setIsScoring(false)
      setStatusMessage("")
      setError(null)
      savedAtsRunIdRef.current =
        run.mode === TRACKED_RUN_MODE.ATS_SCORE ? run.id : null
      scrollToOutputOnMobile()
    },
    [
      setMode,
      setJobDescription,
      setResumeContent,
      setResumeFileName,
      setResumeFileMimeType,
      setResumeFileDataUrl,
      setResumeArtifacts,
      setExtraInstructions,
      setLatexContent,
      setAtsNlpAnalysis,
      setAtsScore,
      setAtsRuntimeSpellMetrics,
      setIsGenerating,
      setIsScoring,
      setStatusMessage,
      setError,
      invalidateATSRequests,
    ]
  )

  useEffect(() => {
    if (!session?.user?.id) return
    if (historyLoading) return
    if (hasRestoredWorkspaceRef.current) return
    if (historyItems.length === 0) return

    const workspaceHasUserState = Boolean(
      jobDescription.trim() ||
      resumeContent.trim() ||
      extraInstructions.trim() ||
      latexContent.trim() ||
      editableLatexContent.trim() ||
      atsScore
    )

    hasRestoredWorkspaceRef.current = true

    if (workspaceHasUserState) return

    const selectedRun =
      historyItems.find((item) => item.id === selectedHistoryRunId) ??
      historyItems[0]

    if (!selectedRun) return

    handleLoadRunFromDashboard(selectedRun)
  }, [
    atsScore,
    editableLatexContent,
    extraInstructions,
    handleLoadRunFromDashboard,
    historyItems,
    historyLoading,
    jobDescription,
    latexContent,
    resumeContent,
    selectedHistoryRunId,
    session?.user?.id,
  ])

  const handleRescoreCV = () => {
    clearATSAnalysisCaches()
    invalidateATSRequests()
    setAtsScore(null)
    setAtsNlpAnalysis(null)
    setAtsRuntimeSpellMetrics(null)
    setIsScoring(false)
    setJobDescription("")
    setResumeContent("")
    setResumeFileName("")
    setResumeFileMimeType("")
    setResumeFileDataUrl("")
    setResumeArtifacts(null)
    setStatusMessage("")
    setError(null)
  }

  const handleDeleteRun = async (runId: string) => {
    if (savedAtsRunIdRef.current === runId) {
      savedAtsRunIdRef.current = null
    }

    await deleteRun(runId)
  }

  const handleAddJobApplication = () => {
    if (!session?.user?.id) {
      setIsAuthDialogOpen(true)
      return
    }

    if (!entitlements.canUseJobTracker) {
      setError(getFeatureUpgradeMessage(PREMIUM_FEATURE.JOB_TRACKER))
      setPlanHighlightFeature(PREMIUM_FEATURE.JOB_TRACKER)
      setIsPlanDialogOpen(true)
      return
    }

    addJobApplication()
    trackEvent("job_application_created")
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
        | "resume_file_path"
        | "resume_file_data_url"
        | "applied_on"
      >
    >
  ) => {
    if (!session?.user?.id) {
      setIsAuthDialogOpen(true)
      return
    }

    if (!entitlements.canUseJobTracker) {
      setError(getFeatureUpgradeMessage(PREMIUM_FEATURE.JOB_TRACKER))
      setPlanHighlightFeature(PREMIUM_FEATURE.JOB_TRACKER)
      setIsPlanDialogOpen(true)
      return
    }

    updateJobApplication(applicationId, patch)
  }

  const handleDeleteJobApplication = async (applicationId: string) => {
    if (!session?.user?.id) {
      setIsAuthDialogOpen(true)
      return
    }

    if (!entitlements.canUseJobTracker) {
      setError(getFeatureUpgradeMessage(PREMIUM_FEATURE.JOB_TRACKER))
      setPlanHighlightFeature(PREMIUM_FEATURE.JOB_TRACKER)
      setIsPlanDialogOpen(true)
      return
    }

    await deleteJobApplication(applicationId)
  }

  const handleOpenAuthDialog = useCallback(() => {
    setIsPlanDialogOpen(false)
    setIsAuthDialogOpen(true)
  }, [setIsAuthDialogOpen, setIsPlanDialogOpen])

  const handleCloseAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(false)
  }, [setIsAuthDialogOpen])

  const handleOpenPlanDialog = useCallback(
    (feature?: PremiumFeature | null) => {
      if (isAuthenticated && isPlanLoading) {
        setAuthMessage("Checking your subscription plan...")
        return
      }

      setPlanHighlightFeature(feature ?? null)
      setIsPlanDialogOpen(true)
    },
    [
      isAuthenticated,
      isPlanLoading,
      setAuthMessage,
      setIsPlanDialogOpen,
      setPlanHighlightFeature,
    ]
  )

  const handleClosePlanDialog = useCallback(() => {
    if (isBillingActionLoading) return
    setIsPlanDialogOpen(false)
    setPlanHighlightFeature(null)
  }, [isBillingActionLoading, setIsPlanDialogOpen, setPlanHighlightFeature])

  const handleBillingAction = useCallback(async () => {
    if (!session?.access_token) {
      setIsPlanDialogOpen(false)
      setIsAuthDialogOpen(true)
      return
    }

    setIsBillingActionLoading(true)

    try {
      trackEvent(
        planSnapshot.plan === SUBSCRIPTION_PLAN.PRO
          ? "billing_portal_opened"
          : "checkout_started",
        {
          current_plan: planSnapshot.plan,
        }
      )
      const response =
        planSnapshot.plan === SUBSCRIPTION_PLAN.PRO
          ? await billingServiceClient.createCustomerPortalSession(
              session.access_token
            )
          : await billingServiceClient.createCheckoutSession(
              session.access_token
            )

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
  }, [
    planSnapshot.plan,
    session?.access_token,
    setAuthMessage,
    setIsAuthDialogOpen,
    setIsBillingActionLoading,
    setIsPlanDialogOpen,
  ])

  const handleOpenPrivacyDialog = useCallback(() => {
    setLegalDialog("privacy")
  }, [setLegalDialog])

  const handleOpenTermsDialog = useCallback(() => {
    setLegalDialog("terms")
  }, [setLegalDialog])

  const handleCloseLegalDialog = useCallback(() => {
    setLegalDialog(null)
  }, [setLegalDialog])

  const handleModeChange = useCallback(
    (nextMode: AppMode) => {
      setMode(nextMode)
    },
    [setMode]
  )

  const handleBackgroundThemeChange = useCallback(
    (nextTheme: BackgroundTheme) => {
      setBackgroundTheme(nextTheme)
    },
    [setBackgroundTheme]
  )

  const handleDismissError = useCallback(() => {
    setError(null)
  }, [setError])

  const handleOpenSplitWorkspace = useCallback(() => {
    setIsSplitWorkspaceOpen(true)
  }, [setIsSplitWorkspaceOpen])

  const handleCloseSplitWorkspace = useCallback(() => {
    setIsSplitWorkspaceOpen(false)
  }, [setIsSplitWorkspaceOpen])

  const handleSelectHistoryRun = useCallback(
    (runId: string) => {
      setSelectedHistoryRunId(runId)
    },
    [setSelectedHistoryRunId]
  )

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
    canTrackJobs: entitlements.canUseJobTracker,
    canEditJobs: entitlements.canUseJobTracker,
    storageNotice: jobApplicationsNotice,
    applications: jobApplications,
    applicationsLoading: jobApplicationsLoading,
    savingApplicationId: savingJobApplicationId,
    deletingApplicationId: deletingJobApplicationId,
    onAddApplication: handleAddJobApplication,
    onUpgradeToPro: () => handleOpenPlanDialog(PREMIUM_FEATURE.JOB_TRACKER),
    onLockedInteraction: () =>
      handleOpenPlanDialog(PREMIUM_FEATURE.JOB_TRACKER),
    onUpdateApplication: handleUpdateJobApplication,
    onDeleteApplication: handleDeleteJobApplication,
    onOpenAuth: handleOpenAuthDialog,
  }

  const inputMode: NonNullable<ResumeInputPanelProps["mode"]> =
    mode === TRACKED_RUN_MODE.ATS_SCORE
      ? TRACKED_RUN_MODE.ATS_SCORE
      : TRACKED_RUN_MODE.GENERATE

  const inputProps: ResumeInputPanelProps = {
    onGenerate:
      mode === TRACKED_RUN_MODE.GENERATE ? handleGenerate : handleATSScore,
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
    onLockedGenerateAttempt: () =>
      handleOpenPlanDialog(PREMIUM_FEATURE.AI_GENERATOR),
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
    runtimeSpellMetrics: atsRuntimeSpellMetrics,
    nlpAnalysis: atsNlpAnalysis,
    resumeContent,
    jobDescription,
    resumeFileName,
    isLoading: isScoring,
    isLoadingInsights,
    hasLoadedAIInsights,
    canUseAiInsights: ATS_AI_INSIGHTS_ENABLED && entitlements.canUseAiInsights,
    onUpgradeToPro: () => handleOpenPlanDialog(PREMIUM_FEATURE.AI_ATS_INSIGHTS),
    onRescoreMyCV: handleRescoreCV,
    onJobDescriptionChange: setJobDescription,
    onResumeContentChange: setResumeContent,
    onResumeFileNameChange: setResumeFileName,
    onResumeFileMimeTypeChange: setResumeFileMimeType,
    onResumeFileDataUrlChange: setResumeFileDataUrl,
    onResumeArtifactsChange: setResumeArtifacts,
    onRuntimeSpellMetricsChange: setAtsRuntimeSpellMetrics,
    onNlpAnalysisChange: setAtsNlpAnalysis,
    onGetATSScore: () => {
      const formData = new FormData()
      formData.append("jobDescription", jobDescription)
      formData.append("resumeContent", resumeContent)
      if (extraInstructions.trim()) {
        formData.append("extraInstructions", extraInstructions)
      }

      void handleATSScore(formData)
    },
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
    onEmailSignIn: handleEmailSignIn,
    onEmailSignUp: handleEmailSignUp,
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

  if (!isWorkspaceRestoreReady) {
    return null
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
          {isBackgroundReady ? <WebGLShader theme={backgroundTheme} /> : null}
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
            onModeChange={handleModeChange}
            dashboardProps={dashboardProps}
            trackerProps={trackerProps}
            inputProps={inputProps}
            previewProps={previewProps}
            atsProps={atsProps}
          />
        </>
      )}

      <SplitWorkspaceLayer mode={mode} splitProps={splitProps} />

      <DialogLayer
        authProps={authDialogProps}
        legalProps={legalDialogProps}
        planProps={planDialogProps}
      />

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
