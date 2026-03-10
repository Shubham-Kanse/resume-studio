import { createSupabaseAdminClient, createSupabaseAnonServerClient, getAuthenticatedUserFromRequest } from "@/lib/supabase-server"

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.message?.includes("schema cache") ||
    false
  )
}

export async function exportAccountData(authorizationHeader: string | null) {
  const auth = await getAuthenticatedUserFromRequest(authorizationHeader)
  if (!auth) {
    return null
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

  return {
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
}

export async function deleteAccount(authorizationHeader: string | null) {
  const auth = await getAuthenticatedUserFromRequest(authorizationHeader)
  if (!auth) {
    return null
  }

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(auth.user.id)
  if (error) {
    throw error
  }

  return { success: true }
}
