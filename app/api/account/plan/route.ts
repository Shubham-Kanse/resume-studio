import { NextRequest, NextResponse } from "next/server"

import { errorResponse } from "@/lib/api-response"
import { APP_PERMISSION, authorizeRequest } from "@/lib/authorization"
import { reportServerError } from "@/lib/error-monitoring"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { context, response } = await authorizeRequest(request, {
      permission: APP_PERMISSION.VIEW_PLAN,
      requireAuth: false,
    })
    if (response) {
      return response
    }

    return NextResponse.json(context.planSnapshot)
  } catch (error) {
    reportServerError(error, "account-plan")
    return errorResponse(error, "Failed to load subscription plan.")
  }
}
