import { TRACKED_RUN_MODE, type TrackedRunMode } from "@/lib/tracked-runs"

export const WORKSPACE_MODE_COOKIE_NAME = "resume-studio:mode"

export const APP_MODE = {
  HOME: "home",
  DASHBOARD: "dashboard",
  JOB_TRACKER: "job-tracker",
} as const

export type AppMode = (typeof APP_MODE)[keyof typeof APP_MODE] | TrackedRunMode

export function isAppMode(value: unknown): value is AppMode {
  return (
    value === APP_MODE.HOME ||
    value === APP_MODE.DASHBOARD ||
    value === APP_MODE.JOB_TRACKER ||
    value === TRACKED_RUN_MODE.GENERATE ||
    value === TRACKED_RUN_MODE.ATS_SCORE
  )
}

export function coerceAppMode(value: unknown): AppMode {
  return isAppMode(value) ? value : APP_MODE.HOME
}
