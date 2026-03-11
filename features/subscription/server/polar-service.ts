import type { NextRequest } from "next/server"

import {
  createPlanSnapshot,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
  type PlanSnapshot,
} from "@/features/subscription/types"
import { AppError, normalizeError } from "@/lib/errors"
import {
  BILLING_PROVIDER,
  createPolarClient,
  getPolarProProductId,
} from "@/lib/polar"
import { createSupabaseAdminClient } from "@/lib/supabase-server"

interface PolarCustomerStateLike {
  id: string
  email: string
  externalId?: string | null
  metadata?: Record<string, unknown>
  activeSubscriptions: Array<{
    id: string
    productId: string
    status: string
    currentPeriodEnd: Date
  }>
}

function getAppUserIdFromPolarCustomer(payload: PolarCustomerStateLike) {
  const externalCustomerId = payload.externalId?.trim()
  if (externalCustomerId) {
    return externalCustomerId
  }

  const metadataUserId = payload.metadata?.app_user_id
  if (typeof metadataUserId === "string" && metadataUserId.trim()) {
    return metadataUserId.trim()
  }

  return null
}

function getOrigin(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  return appUrl || request.nextUrl.origin
}

function buildCheckoutSuccessUrl(request: NextRequest) {
  const successUrl = new URL("/", getOrigin(request))
  successUrl.searchParams.set("billing", "success")
  successUrl.searchParams.set("checkoutId", "{CHECKOUT_ID}")
  return successUrl.toString()
}

function buildReturnUrl(request: NextRequest) {
  return new URL("/", getOrigin(request)).toString()
}

export async function createPolarCheckoutUrl(params: {
  request: NextRequest
  userId: string
  userEmail: string | null
  userName: string | null
}) {
  try {
    const polar = createPolarClient()
    const result = await polar.checkouts.create({
      products: [getPolarProProductId()],
      successUrl: buildCheckoutSuccessUrl(params.request),
      returnUrl: buildReturnUrl(params.request),
      externalCustomerId: params.userId,
      customerEmail: params.userEmail ?? undefined,
      customerName: params.userName ?? undefined,
      metadata: {
        app_user_id: params.userId,
        plan: SUBSCRIPTION_PLAN.PRO,
      },
      customerMetadata: {
        app_user_id: params.userId,
      },
    })

    return result.url
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const likelyServerMismatch =
      message.toLowerCase().includes("product") ||
      message.toLowerCase().includes("not found")

    throw normalizeError(error, {
      code: "UPSTREAM_ERROR",
      status: 502,
      userMessage: likelyServerMismatch
        ? "Polar checkout failed. Verify that POLAR_SERVER matches the environment where POLAR_PRO_PRODUCT_ID was created."
        : "Polar checkout failed. Verify your Polar access token and product configuration.",
      context: "polar-checkout",
    })
  }
}

export async function createPolarPortalUrl(params: {
  request: NextRequest
  externalCustomerId: string
}) {
  try {
    const polar = createPolarClient()
    const result = await polar.customerSessions.create({
      externalCustomerId: params.externalCustomerId,
      returnUrl: buildReturnUrl(params.request),
    })

    return result.customerPortalUrl
  } catch (error) {
    throw normalizeError(error, {
      code: "UPSTREAM_ERROR",
      status: 502,
      userMessage:
        "Polar billing portal failed. Verify your Polar customer sync and access token.",
      context: "polar-portal",
    })
  }
}

export async function syncSubscriptionFromPolarCustomerState(
  payload: PolarCustomerStateLike
): Promise<PlanSnapshot | null> {
  const appUserId = getAppUserIdFromPolarCustomer(payload)
  if (!appUserId) {
    return null
  }

  const proProductId = getPolarProProductId()
  const activeSubscription =
    payload.activeSubscriptions.find(
      (subscription) => subscription.productId === proProductId
    ) ?? null

  const admin = createSupabaseAdminClient()
  const nextPlan = activeSubscription
    ? SUBSCRIPTION_PLAN.PRO
    : SUBSCRIPTION_PLAN.FREE
  const nextStatus =
    activeSubscription?.status === SUBSCRIPTION_STATUS.TRIALING
      ? SUBSCRIPTION_STATUS.TRIALING
      : activeSubscription?.status === SUBSCRIPTION_STATUS.ACTIVE
        ? SUBSCRIPTION_STATUS.ACTIVE
        : SUBSCRIPTION_STATUS.INACTIVE
  const nextPeriodEnd = activeSubscription
    ? activeSubscription.currentPeriodEnd.toISOString()
    : null

  const { data, error } = await admin
    .from("user_subscriptions")
    .update({
      email: payload.email || null,
      plan: nextPlan,
      status: nextStatus,
      billing_provider: BILLING_PROVIDER.POLAR,
      provider_customer_id: payload.id,
      provider_subscription_id: activeSubscription?.id ?? null,
      current_period_end: nextPeriodEnd,
    })
    .eq("user_id", appUserId)
    .select("plan, status, current_period_end")
    .single()

  if (error) {
    throw normalizeError(error, {
      code: "UPSTREAM_ERROR",
      status: 500,
      userMessage: "Failed to sync your billing status.",
      context: "polar-sync",
    })
  }

  return createPlanSnapshot({
    plan: data.plan,
    status: data.status,
    current_period_end: data.current_period_end,
  })
}

export function getPolarBillingUnavailableError() {
  return new AppError("Billing is not configured yet.", {
    code: "CONFIGURATION_ERROR",
    status: 503,
    userMessage: "Billing is not configured yet.",
    context: "polar-config",
  })
}
