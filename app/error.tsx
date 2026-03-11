"use client"

import { useEffect } from "react"

import { ErrorFallback } from "@/components/error-fallback"
import { reportClientError } from "@/lib/error-monitoring"
import { getUserFacingMessage } from "@/lib/errors"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, "app-error")
  }, [error])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#030712] px-4">
      <ErrorFallback
        title="Something went wrong"
        message={getUserFacingMessage(
          error,
          "The app hit an unexpected client-side error. You can retry the view without losing the rest of the workspace."
        )}
        onAction={reset}
      />
    </div>
  )
}
