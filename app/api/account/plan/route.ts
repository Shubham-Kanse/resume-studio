import { NextRequest, NextResponse } from "next/server"
import { errorResponse } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { getAuthenticatedUserFromRequest } from "@/lib/supabase-server"
import { resolvePlanSnapshotForUser } from "@/lib/services/subscription-service"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request.headers.get("authorization"))
    const snapshot = await resolvePlanSnapshotForUser(auth?.user, auth?.accessToken)

    return NextResponse.json(snapshot)
  } catch (error) {
    reportServerError(error, "account-plan")
    return errorResponse(error, "Failed to load subscription plan.")
  }
}
