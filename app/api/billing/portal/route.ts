import { NextRequest, NextResponse } from "next/server"

import { createPolarPortalUrl } from "@/features/subscription/server/polar-service"
import { errorResponse } from "@/lib/api-response"
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
      unauthorizedMessage: "Sign in to manage billing.",
    })
    if (response) {
      return response
    }
    if (!context.user) {
      return errorResponse(
        new Error("Billing authorization context was incomplete."),
        "Failed to open billing portal."
      )
    }

    const url = await createPolarPortalUrl({
      request,
      externalCustomerId: context.user.id,
    })

    return NextResponse.json({ url })
  } catch (error) {
    reportServerError(error, "billing-portal")
    return errorResponse(error, "Failed to open billing portal.")
  }
}
