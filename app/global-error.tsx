"use client"

import { useEffect } from "react"

import { ErrorFallback } from "@/components/error-fallback"
import { reportClientError } from "@/lib/error-monitoring"
import { getUserFacingMessage } from "@/lib/errors"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, "global-error")
  }, [error])

  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#030712] font-sans antialiased">
        <div className="flex min-h-dvh items-center justify-center px-4">
          <ErrorFallback
            title="The app needs a reset"
            message={getUserFacingMessage(
              error,
              "A global error interrupted the current render. Try resetting the app state and loading the page again."
            )}
            actionLabel="Reset app"
            onAction={reset}
          />
        </div>
      </body>
    </html>
  )
}
