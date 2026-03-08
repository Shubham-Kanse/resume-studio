import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAnonServerClient, getAuthenticatedUserFromRequest } from "@/lib/supabase-server"
import { reportServerError } from "@/lib/error-monitoring"
import { unauthorized } from "@/lib/api-response"
import { enforceRateLimit } from "@/lib/api-rate-limit"

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("schema cache") ||
    false
  )
}

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "account-export",
    limit: 5,
    windowMs: 60_000,
  })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await getAuthenticatedUserFromRequest(request.headers.get("authorization"))
    if (!auth) {
      return unauthorized()
    }

    const supabase = createSupabaseAnonServerClient(auth.accessToken)

    const [trackedRunsResult, jobApplicationsResult] = await Promise.all([
      supabase.from("tracked_runs").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
      supabase
        .from("job_applications")
        .select("*")
        .eq("user_id", auth.user.id)
        .order("applied_on", { ascending: false })
        .order("updated_at", { ascending: false }),
    ])

    const warnings: string[] = []

    if (trackedRunsResult.error && !isMissingTableError(trackedRunsResult.error)) {
      throw trackedRunsResult.error
    }
    if (jobApplicationsResult.error && !isMissingTableError(jobApplicationsResult.error)) {
      throw jobApplicationsResult.error
    }
    if (trackedRunsResult.error && isMissingTableError(trackedRunsResult.error)) {
      warnings.push("tracked_runs table not available in this project.")
    }
    if (jobApplicationsResult.error && isMissingTableError(jobApplicationsResult.error)) {
      warnings.push("job_applications table not available in this project.")
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: auth.user.id,
        email: auth.user.email ?? null,
        user_metadata: auth.user.user_metadata ?? {},
      },
      trackedRuns: trackedRunsResult.data ?? [],
      jobApplications: jobApplicationsResult.data ?? [],
      warnings,
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="resume-studio-export.json"',
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    reportServerError(error, "account-export")
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to export account data",
      },
      { status: 500 }
    )
  }
}
