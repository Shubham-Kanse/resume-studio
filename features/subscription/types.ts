export const SUBSCRIPTION_PLAN = {
  FREE: "free",
  PRO: "pro",
} as const

export const SUBSCRIPTION_STATUS = {
  INACTIVE: "inactive",
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
} as const

export const PREMIUM_FEATURE = {
  AI_GENERATOR: "ai_generator",
  AI_ATS_INSIGHTS: "ai_ats_insights",
  JOB_TRACKER: "job_tracker",
} as const

export type SubscriptionPlan =
  (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN]
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]
export type PremiumFeature =
  (typeof PREMIUM_FEATURE)[keyof typeof PREMIUM_FEATURE]

export interface PlanEntitlements {
  canUseAiGenerator: boolean
  canUseAiInsights: boolean
  canUseJobTracker: boolean
}

export interface PlanSnapshot {
  plan: SubscriptionPlan
  status: SubscriptionStatus
  entitlements: PlanEntitlements
  source: "guest" | "database"
  currentPeriodEnd: string | null
}

export interface UserSubscriptionRecord {
  user_id: string
  email: string | null
  plan: SubscriptionPlan
  status: SubscriptionStatus
  billing_provider: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

const SUBSCRIPTION_PLAN_VALUES = new Set<SubscriptionPlan>(
  Object.values(SUBSCRIPTION_PLAN)
)
const SUBSCRIPTION_STATUS_VALUES = new Set<SubscriptionStatus>(
  Object.values(SUBSCRIPTION_STATUS)
)

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
}

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return (
    typeof value === "string" &&
    SUBSCRIPTION_PLAN_VALUES.has(value as SubscriptionPlan)
  )
}

export function isSubscriptionStatus(
  value: unknown
): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    SUBSCRIPTION_STATUS_VALUES.has(value as SubscriptionStatus)
  )
}

export function isPlanSnapshot(value: unknown): value is PlanSnapshot {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<PlanSnapshot>
  return (
    isSubscriptionPlan(candidate.plan) &&
    isSubscriptionStatus(candidate.status) &&
    typeof candidate.entitlements?.canUseAiGenerator === "boolean" &&
    typeof candidate.entitlements?.canUseAiInsights === "boolean" &&
    typeof candidate.entitlements?.canUseJobTracker === "boolean" &&
    (candidate.source === "guest" || candidate.source === "database") &&
    (candidate.currentPeriodEnd === null ||
      isIsoDateTime(candidate.currentPeriodEnd))
  )
}

export function isUserSubscriptionRecord(
  value: unknown
): value is UserSubscriptionRecord {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<UserSubscriptionRecord>

  return (
    typeof candidate.user_id === "string" &&
    (candidate.email === null || typeof candidate.email === "string") &&
    isSubscriptionPlan(candidate.plan) &&
    isSubscriptionStatus(candidate.status) &&
    (candidate.billing_provider === null ||
      typeof candidate.billing_provider === "string") &&
    (candidate.provider_customer_id === null ||
      typeof candidate.provider_customer_id === "string") &&
    (candidate.provider_subscription_id === null ||
      typeof candidate.provider_subscription_id === "string") &&
    (candidate.current_period_end === null ||
      isIsoDateTime(candidate.current_period_end)) &&
    isIsoDateTime(candidate.created_at) &&
    isIsoDateTime(candidate.updated_at)
  )
}

export function isSubscriptionActive(
  plan: SubscriptionPlan,
  status: SubscriptionStatus
) {
  return (
    plan === SUBSCRIPTION_PLAN.PRO &&
    (status === SUBSCRIPTION_STATUS.ACTIVE ||
      status === SUBSCRIPTION_STATUS.TRIALING)
  )
}

export function getPlanEntitlements(
  plan: SubscriptionPlan,
  status: SubscriptionStatus = SUBSCRIPTION_STATUS.INACTIVE
): PlanEntitlements {
  if (isSubscriptionActive(plan, status)) {
    return {
      canUseAiGenerator: true,
      canUseAiInsights: true,
      canUseJobTracker: true,
    }
  }

  return {
    canUseAiGenerator: false,
    canUseAiInsights: false,
    canUseJobTracker: false,
  }
}

export function getGuestPlanSnapshot(): PlanSnapshot {
  return {
    plan: SUBSCRIPTION_PLAN.FREE,
    status: SUBSCRIPTION_STATUS.INACTIVE,
    entitlements: getPlanEntitlements(
      SUBSCRIPTION_PLAN.FREE,
      SUBSCRIPTION_STATUS.INACTIVE
    ),
    source: "guest",
    currentPeriodEnd: null,
  }
}

export function createPlanSnapshot(
  record: Pick<UserSubscriptionRecord, "plan" | "status" | "current_period_end">
): PlanSnapshot {
  return {
    plan: record.plan,
    status: record.status,
    entitlements: getPlanEntitlements(record.plan, record.status),
    source: "database",
    currentPeriodEnd: record.current_period_end,
  }
}

export function canAccessFeature(
  snapshot: PlanSnapshot,
  feature: PremiumFeature
) {
  switch (feature) {
    case PREMIUM_FEATURE.AI_GENERATOR:
      return snapshot.entitlements.canUseAiGenerator
    case PREMIUM_FEATURE.AI_ATS_INSIGHTS:
      return snapshot.entitlements.canUseAiInsights
    case PREMIUM_FEATURE.JOB_TRACKER:
      return snapshot.entitlements.canUseJobTracker
    default:
      return false
  }
}

export function getFeatureUpgradeMessage(feature: PremiumFeature) {
  switch (feature) {
    case PREMIUM_FEATURE.AI_GENERATOR:
      return "AI LaTeX generation is available on Pro."
    case PREMIUM_FEATURE.AI_ATS_INSIGHTS:
      return "AI ATS insights are available on Pro."
    case PREMIUM_FEATURE.JOB_TRACKER:
      return "Job Tracker is available on Pro."
    default:
      return "This feature is available on Pro."
  }
}
