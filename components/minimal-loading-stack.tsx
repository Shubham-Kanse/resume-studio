"use client"

import { useEffect, useState } from "react"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface MinimalLoadingStackProps {
  title: string
  steps: string[]
  activeStep: number
  windowSize?: number
}

export function MinimalLoadingStack({
  title,
  steps,
  activeStep,
  windowSize = 3,
}: MinimalLoadingStackProps) {
  const safeActiveStep = Math.min(Math.max(activeStep, 0), steps.length - 1)
  const [tickVisibleStep, setTickVisibleStep] = useState<number | null>(null)
  const rowHeight = 28
  const rowGap = 16
  const viewportHeight = rowHeight * windowSize + rowGap * (windowSize - 1)

  useEffect(() => {
    setTickVisibleStep(null)
    const timeoutId = window.setTimeout(() => {
      setTickVisibleStep(safeActiveStep)
    }, 420)

    return () => window.clearTimeout(timeoutId)
  }, [safeActiveStep])

  return (
    <div className="flex h-full flex-col items-center justify-center p-4 sm:p-6">
      <div className="flex w-full justify-center">
        <div className="w-full max-w-md">
          <div className="mb-5 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">
              {title}
            </p>
          </div>

          <div
            className="relative mx-auto overflow-hidden"
            style={{ height: `${viewportHeight}px`, width: "100%" }}
          >
            {steps.map((step, index) => {
              const isCurrent = index === safeActiveStep
              const isFinished = index < safeActiveStep
              const showTick = isFinished || tickVisibleStep === index
              const offset = index - safeActiveStep
              const translateY = offset * (rowHeight + rowGap)
              const isVisible = offset >= -2 && offset <= 2

              return (
                <div
                  key={`${title}-${step}`}
                  className={cn(
                    "absolute inset-x-0 left-0 flex items-center justify-center gap-3 text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                    isCurrent
                      ? "scale-100 opacity-100"
                      : isFinished
                        ? "scale-[0.985] opacity-55"
                        : "scale-[0.975] opacity-28",
                    !isVisible && "pointer-events-none"
                  )}
                  style={{
                    top: "50%",
                    transform: `translateY(calc(-50% + ${translateY}px))`,
                    opacity: isVisible ? undefined : 0,
                  }}
                  aria-hidden={!isVisible}
                >
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <span
                        className={cn(
                          "absolute rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          isCurrent
                            ? "bg-primary shadow-[0_0_10px_rgba(34,197,94,0.35)]"
                            : "bg-white/28",
                          showTick
                            ? "h-1 w-1 scale-[0.35] opacity-0"
                            : isCurrent
                              ? "h-2.5 w-2.5 scale-100 opacity-100"
                              : "h-1.5 w-1.5 scale-100 opacity-100"
                        )}
                      />
                      <Check
                        className={cn(
                          "absolute h-4 w-4 text-primary transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          showTick
                            ? "scale-100 opacity-100"
                            : "scale-50 opacity-0"
                        )}
                      />
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm transition-all duration-500",
                        isCurrent
                          ? "font-medium text-foreground tracking-[0.01em]"
                          : isFinished
                            ? "text-white/60"
                            : "text-white/36"
                      )}
                    >
                      {step}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
