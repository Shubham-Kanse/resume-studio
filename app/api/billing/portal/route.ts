import { NextRequest, NextResponse } from "next/server"
import { errorResponse, unauthorized } from "@/lib/api-response"
import { reportServerError } from "@/lib/error-monitoring"
import { createPolarPortalUrl } from "@/lib/services/polar-service"
import { getAuthenticatedUserFromRequest } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request.headers.get("authorization"))
    if (!auth) {
      return unauthorized("Sign in to manage billing.")
    }

    const url = await createPolarPortalUrl({
      request,
      externalCustomerId: auth.user.id,
    })

    return NextResponse.json({ url })
  } catch (error) {
    reportServerError(error, "billing-portal")
    return errorResponse(error, "Failed to open billing portal.")
  }
}
