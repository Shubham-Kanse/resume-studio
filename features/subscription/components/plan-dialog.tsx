"use client"

import {
  Crown,
  Sparkles,
  Target,
  X,
  FileCode2,
  LayoutDashboard,
  BriefcaseBusiness,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  PREMIUM_FEATURE,
  SUBSCRIPTION_PLAN,
  type PremiumFeature,
  type SubscriptionPlan,
} from "@/features/subscription/types"
import { cn } from "@/lib/utils"

interface PlanDialogProps {
  open: boolean
  currentPlan: SubscriptionPlan
  isAuthenticated: boolean
  highlightedFeature: PremiumFeature | null
  isBillingActionLoading: boolean
  onClose: () => void
  onOpenAuth: () => void
  onBillingAction: () => Promise<void>
}

const FREE_FEATURES = [
  { label: "LaTeX Editor", icon: FileCode2 },
  { label: "ATS Score", icon: Target },
  { label: "Dashboard", icon: LayoutDashboard },
]

const PRO_FEATURES = [
  { label: "AI LaTeX Generator", icon: Sparkles },
  { label: "AI ATS Insights", icon: Target },
  { label: "Job Tracker", icon: BriefcaseBusiness },
]

function featureHeadline(feature: PremiumFeature | null) {
  switch (feature) {
    case PREMIUM_FEATURE.AI_GENERATOR:
      return "Pro unlocks AI-powered LaTeX generation."
    case PREMIUM_FEATURE.AI_ATS_INSIGHTS:
      return "Pro unlocks the AI insights tab for ATS analysis."
    case PREMIUM_FEATURE.JOB_TRACKER:
      return "Pro unlocks the job tracker workspace."
    default:
      return "Choose the plan that fits your workflow."
  }
}

export function PlanDialog({
  open,
  currentPlan,
  isAuthenticated,
  highlightedFeature,
  isBillingActionLoading,
  onClose,
  onOpenAuth,
  onBillingAction,
}: PlanDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[6px]">
      <div className="w-full max-w-4xl rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.18),rgba(3,7,18,0.08))] p-6 shadow-[0_18px_56px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">
              Plans
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {featureHeadline(highlightedFeature)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close plans dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-[28px] border border-white/8 bg-black/12 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">
                  Free
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-foreground">
                  $0
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Core resume tooling for manual editing and scoring.
                </p>
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
                {currentPlan === SUBSCRIPTION_PLAN.FREE
                  ? "Current plan"
                  : "Available"}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {FREE_FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.label}
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/12 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">
                      {feature.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          <section
            className={cn(
              "rounded-[28px] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
              currentPlan === SUBSCRIPTION_PLAN.PRO
                ? "border-sky-400/30 bg-sky-500/10"
                : "border-sky-400/30 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(8,12,24,0.12))]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-sky-200/80">
                  <Crown className="h-3.5 w-3.5" />
                  Pro
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-foreground">
                  Premium workflow
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  AI-assisted resume creation, deeper ATS guidance, and
                  application tracking.
                </p>
              </div>
              <div
                className={cn(
                  "text-[11px] font-medium uppercase tracking-[0.2em]",
                  currentPlan === SUBSCRIPTION_PLAN.PRO
                    ? "text-sky-100"
                    : "text-sky-200/75"
                )}
              >
                {currentPlan === SUBSCRIPTION_PLAN.PRO
                  ? "Current plan"
                  : "Upgrade"}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {PRO_FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.label}
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/12 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                      <Icon className="h-4 w-4 text-sky-300" />
                    </div>
                    <span className="text-sm text-foreground">
                      {feature.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="cool"
                className="rounded-2xl px-5"
                onClick={() =>
                  void (isAuthenticated ? onBillingAction() : onOpenAuth())
                }
                disabled={isBillingActionLoading}
              >
                {currentPlan === SUBSCRIPTION_PLAN.PRO
                  ? isBillingActionLoading
                    ? "Opening Portal..."
                    : "Manage Billing"
                  : isAuthenticated
                    ? isBillingActionLoading
                      ? "Opening Checkout..."
                      : "Upgrade to Pro"
                    : "Sign in to Continue"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl px-5"
                onClick={onClose}
              >
                Continue with{" "}
                {currentPlan === SUBSCRIPTION_PLAN.PRO ? "Pro" : "Free"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
