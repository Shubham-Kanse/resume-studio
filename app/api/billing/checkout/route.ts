import { NextRequest, NextResponse } from "next/server"

import { createPolarCheckoutUrl } from "@/features/subscription/server/polar-service"
import { SUBSCRIPTION_PLAN } from "@/features/subscription/types"
import { errorResponse, forbidden } from "@/lib/api-response"
import { APP_PERMISSION, authorizeRequest } from "@/lib/authorization"
import { verifyCsrfRequest } from "@/lib/csrf"
import { reportServerError } from "@/lib/error-monitoring"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const csrfError = verifyCsrfRequest(request)
  if (csrfError) return csrfError

  try {
    const { context, response } = await authorizeRequest(request, {
      permission: APP_PERMISSION.MANAGE_BILLING,
      unauthorizedMessage: "Sign in to upgrade to Pro.",
    })
    if (response) {
      return response
    }
    if (!context.user) {
      return errorResponse(
        new Error("Billing authorization context was incomplete."),
        "Failed to start checkout."
      )
    }

    const planSnapshot = context.planSnapshot
    if (
      planSnapshot.plan === SUBSCRIPTION_PLAN.PRO &&
      planSnapshot.entitlements.canUseAiGenerator
    ) {
      return forbidden("Your account already has Pro access.")
    }

    const userName =
      (context.user.user_metadata?.full_name as string | undefined) ||
      (context.user.user_metadata?.name as string | undefined) ||
      null

    const url = await createPolarCheckoutUrl({
      request,
      userId: context.user.id,
      userEmail: context.user.email ?? null,
      userName,
    })

    return NextResponse.json({ url })
  } catch (error) {
    reportServerError(error, "billing-checkout")
    return errorResponse(error, "Failed to start checkout.")
  }
}
