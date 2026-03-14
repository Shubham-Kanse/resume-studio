import { cookies } from "next/headers"

import AppShell from "@/features/workspace/components/app-shell"
import {
  WORKSPACE_MODE_COOKIE_NAME,
  coerceAppMode,
} from "@/features/workspace/workspace-mode"

export default async function HomePage() {
  const cookieStore = await cookies()
  const initialMode = coerceAppMode(
    cookieStore.get(WORKSPACE_MODE_COOKIE_NAME)?.value
  )

  return <AppShell initialMode={initialMode} />
}
