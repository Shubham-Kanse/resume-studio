"use client"

import { AlertTriangle } from "lucide-react"

interface ErrorFallbackProps {
  title?: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}

export function ErrorFallback({
  title = "Something went wrong",
  message = "This part of the app failed to load. You can retry without losing the rest of the page.",
  actionLabel = "Try again",
  onAction,
  compact = false,
}: ErrorFallbackProps) {
  return (
    <div
      className={`flex w-full items-center justify-center ${compact ? "min-h-[10rem] p-4" : "min-h-[18rem] p-6"}`}
      role="alert"
    >
      <div className="w-full max-w-xl rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.1),rgba(3,7,18,0.03))] p-6 text-center shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-300" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 rounded-full border border-white/10 bg-black/20 px-5 py-2 text-sm text-foreground transition-colors hover:bg-white/8"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
