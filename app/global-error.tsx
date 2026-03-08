"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { reportClientError } from "@/lib/error-monitoring"

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
          <div className="w-full max-w-xl rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.1),rgba(3,7,18,0.03))] p-8 text-center shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-300" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-foreground">The app needs a reset</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              A global error interrupted the current render. Try resetting the app state and loading the page again.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full border border-white/10 bg-black/20 px-5 py-2 text-sm text-foreground transition-colors hover:bg-white/8"
            >
              Reset app
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
