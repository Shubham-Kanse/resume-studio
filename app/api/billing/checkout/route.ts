import { NextRequest, NextResponse } from "next/server"
import { errorResponse, forbidden, unauthorized } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { createPolarCheckoutUrl } from "@/lib/services/polar-service"
import { resolvePlanSnapshotForUser } from "@/lib/services/subscription-service"
import { getAuthenticatedUserFromRequest } from "@/lib/supabase-server"
import { SUBSCRIPTION_PLAN } from "@/lib/subscription"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request.headers.get("authorization"))
    if (!auth) {
      return unauthorized("Sign in to upgrade to Pro.")
    }

    const planSnapshot = await resolvePlanSnapshotForUser(auth.user, auth.accessToken)
    if (planSnapshot.plan === SUBSCRIPTION_PLAN.PRO && planSnapshot.entitlements.canUseAiGenerator) {
      return forbidden("Your account already has Pro access.")
    }

    const userName =
      (auth.user.user_metadata?.full_name as string | undefined) ||
      (auth.user.user_metadata?.name as string | undefined) ||
      null

    const url = await createPolarCheckoutUrl({
      request,
      userId: auth.user.id,
      userEmail: auth.user.email ?? null,
      userName,
    })

    return NextResponse.json({ url })
  } catch (error) {
    reportServerError(error, "billing-checkout")
    return errorResponse(error, "Failed to start checkout.")
  }
}
