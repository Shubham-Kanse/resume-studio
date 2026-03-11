"use client"

import { useEffect } from "react"

import { reportClientError } from "@/lib/error-monitoring"

export function ClientRuntimeGuard() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError(
        event.error || event.message || "Unhandled window error",
        "window-error"
      )
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportClientError(
        event.reason || "Unhandled promise rejection",
        "window-rejection"
      )
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return null
}
