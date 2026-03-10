import type { User } from "@supabase/supabase-js"
import { AppError, normalizeError } from "@/lib/errors"
import { createSupabaseAdminClient, createSupabaseAnonServerClient } from "@/lib/supabase-server"
import {
  createPlanSnapshot,
  getGuestPlanSnapshot,
  isUserSubscriptionRecord,
  type PlanSnapshot,
  type UserSubscriptionRecord,
} from "@/lib/subscription"

export function normalizeUserSubscription(record: Record<string, unknown>): UserSubscriptionRecord {
  if (!isUserSubscriptionRecord(record)) {
    throw new AppError("Subscription record validation failed.", {
      code: "VALIDATION_ERROR",
      status: 500,
      userMessage: "Your subscription data could not be validated.",
      details: null,
      context: "subscription-normalize",
    })
  }

  return record
}

export function isMissingUserSubscriptionsTable(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("user_subscriptions") ||
    error?.message?.includes("schema cache") ||
    false
  )
}

async function ensureSubscriptionRecord(user: User) {
  const admin = createSupabaseAdminClient()
  const payload = {
    user_id: user.id,
    email: user.email ?? null,
  }

  const { data, error } = await admin
    .from("user_subscriptions")
    .insert(payload)
    .select("*")
    .single()

  if (!error && data) {
    return normalizeUserSubscription(data as Record<string, unknown>)
  }

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (existingError) {
      throw existingError
    }

    return normalizeUserSubscription(existing as Record<string, unknown>)
  }

  if (error) {
    throw normalizeError(error, {
      code: "UPSTREAM_ERROR",
      status: 500,
      userMessage: "Failed to initialize your subscription.",
      context: "subscription-ensure",
    })
  }

  throw new AppError("Subscription creation returned no data.", {
    code: "UPSTREAM_ERROR",
    status: 500,
    userMessage: "Failed to initialize your subscription.",
    context: "subscription-ensure",
  })
}

export async function getUserSubscriptionRecord(user: User | null | undefined, accessToken?: string) {
  if (!user) {
    return null
  }

  const supabase = accessToken ? createSupabaseAnonServerClient(accessToken) : createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    throw normalizeError(error, {
      code: "UPSTREAM_ERROR",
      status: 500,
      userMessage: "Failed to load your subscription.",
      context: "subscription-fetch",
    })
  }

  if (data) {
    return normalizeUserSubscription(data as Record<string, unknown>)
  }

  return ensureSubscriptionRecord(user)
}

export async function resolvePlanSnapshotForUser(
  user: User | null | undefined,
  accessToken?: string
): Promise<PlanSnapshot> {
  if (!user) {
    return getGuestPlanSnapshot()
  }

  const record = await getUserSubscriptionRecord(user, accessToken)
  if (!record) {
    return getGuestPlanSnapshot()
  }

  return createPlanSnapshot(record)
}
