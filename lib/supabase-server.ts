import { createClient } from "@supabase/supabase-js"

import {
  APP_SESSION_COOKIE_NAME,
  getSessionCookieValue,
} from "@/lib/auth-session"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  return { url, anonKey, serviceRoleKey }
}

export function createSupabaseAnonServerClient(accessToken?: string) {
  const { url, anonKey } = getSupabaseConfig()

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured.")
  }

  return createClient(url, anonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseConfig()

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.")
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function getAuthenticatedUserFromRequest(
  authorizationHeader: string | null,
  cookieAccessToken?: string | null
) {
  const headerAccessToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : null
  const accessToken = headerAccessToken || cookieAccessToken?.trim() || null
  if (!accessToken) return null

  const supabase = createSupabaseAnonServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken)

  if (error || !user) {
    return null
  }

  return { accessToken, user }
}

export function getSessionTokenFromCookie(
  cookie:
    | {
        value?: string | null
      }
    | null
    | undefined
) {
  return getSessionCookieValue(cookie)
}

export { APP_SESSION_COOKIE_NAME }
