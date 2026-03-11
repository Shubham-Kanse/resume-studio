import type { NextRequest } from "next/server"

import { resolvePlanSnapshotForUser } from "@/features/subscription/server/subscription-service"
import {
  canAccessFeature,
  getGuestPlanSnapshot,
  PREMIUM_FEATURE,
  type PlanSnapshot,
} from "@/features/subscription/types"
import { forbidden, unauthorized } from "@/lib/api-response"
import {
  getAuthenticatedUserFromRequest,
  getSessionTokenFromCookie,
} from "@/lib/supabase-server"

import type { User } from "@supabase/supabase-js"

export const APP_ROLE = {
  ADMIN: "admin",
  GUEST: "guest",
  MEMBER: "member",
} as const

export type AppRole = (typeof APP_ROLE)[keyof typeof APP_ROLE]

export const APP_PERMISSION = {
  MANAGE_ACCOUNT: "manage_account",
  MANAGE_BILLING: "manage_billing",
  USE_AI_ATS_INSIGHTS: "use_ai_ats_insights",
  USE_AI_GENERATOR: "use_ai_generator",
  VIEW_PLAN: "view_plan",
} as const

export type AppPermission = (typeof APP_PERMISSION)[keyof typeof APP_PERMISSION]

interface AuthorizationOptions {
  permission?: AppPermission
  unauthorizedMessage?: string
  forbiddenMessage?: string
  requireAuth?: boolean
}

interface AuthenticatedRequestContext {
  accessToken: string
  planSnapshot: PlanSnapshot
  role: AppRole
  user: User
}

interface GuestRequestContext {
  accessToken: null
  planSnapshot: PlanSnapshot
  role: AppRole
  user: null
}

export type RequestAuthorizationContext =
  | AuthenticatedRequestContext
  | GuestRequestContext

function isAppRole(value: unknown): value is AppRole {
  return (
    value === APP_ROLE.ADMIN ||
    value === APP_ROLE.MEMBER ||
    value === APP_ROLE.GUEST
  )
}

function resolveUserRole(user: User | null | undefined): AppRole {
  if (!user) {
    return APP_ROLE.GUEST
  }

  const metadataRole = user.user_metadata?.role
  return isAppRole(metadataRole) ? metadataRole : APP_ROLE.MEMBER
}

function hasPermission(
  context: RequestAuthorizationContext,
  permission: AppPermission
) {
  if (context.role === APP_ROLE.ADMIN) {
    return true
  }

  switch (permission) {
    case APP_PERMISSION.VIEW_PLAN:
      return true
    case APP_PERMISSION.MANAGE_ACCOUNT:
    case APP_PERMISSION.MANAGE_BILLING:
      return Boolean(context.user)
    case APP_PERMISSION.USE_AI_GENERATOR:
      return canAccessFeature(
        context.planSnapshot,
        PREMIUM_FEATURE.AI_GENERATOR
      )
    case APP_PERMISSION.USE_AI_ATS_INSIGHTS:
      return canAccessFeature(
        context.planSnapshot,
        PREMIUM_FEATURE.AI_ATS_INSIGHTS
      )
    default:
      return false
  }
}

export async function resolveAuthorizationContext(
  request: NextRequest
): Promise<RequestAuthorizationContext> {
  const auth = await getAuthenticatedUserFromRequest(
    request.headers.get("authorization"),
    getSessionTokenFromCookie(request.cookies.get("resume-studio-session"))
  )

  if (!auth) {
    return {
      accessToken: null,
      planSnapshot: getGuestPlanSnapshot(),
      role: APP_ROLE.GUEST,
      user: null,
    }
  }

  return {
    accessToken: auth.accessToken,
    planSnapshot: await resolvePlanSnapshotForUser(auth.user, auth.accessToken),
    role: resolveUserRole(auth.user),
    user: auth.user,
  }
}

export async function authorizeRequest(
  request: NextRequest,
  options: AuthorizationOptions = {}
) {
  const context = await resolveAuthorizationContext(request)

  if (options.requireAuth !== false && !context.user) {
    return {
      context,
      response: unauthorized(options.unauthorizedMessage),
    }
  }

  if (options.permission && !hasPermission(context, options.permission)) {
    return {
      context,
      response: forbidden(
        options.forbiddenMessage || "You do not have access to this resource."
      ),
    }
  }

  return {
    context,
    response: null,
  }
}
