"use client"

import dynamic from "next/dynamic"
import { useRef, useState } from "react"
import { ResumeInputPanel } from "@/components/resume-input-panel"
import { ResumePreviewPanel } from "@/components/resume-preview-panel"
import { ATSScorePanel } from "@/components/ats-score-panel"
import { Button } from "@/components/ui/button"
import { FileCode2, Target } from "lucide-react"
import type { ATSScoreResponse } from "@/lib/ats-types"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type AppMode = "generate" | "ats-score"

const ATS_LOADING_MIN_DURATION_MS = 11000
const WebGLShader = dynamic(
  () => import("@/components/webgl-shader").then((mod) => mod.WebGLShader),
  { ssr: false, loading: () => null }
)

export default function HomePage() {
  const atsRequestIdRef = useRef(0)
  const outputPanelRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<AppMode>("generate")
  const [latexContent, setLatexContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [atsScore, setAtsScore] = useState<ATSScoreResponse | null>(null)
  const [isScoring, setIsScoring] = useState(false)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [hasLoadedAIInsights, setHasLoadedAIInsights] = useState(false)

  const panelShellClass =
    "w-full min-w-0 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.16),rgba(3,7,18,0.06))] p-4 sm:rounded-[28px] sm:p-5 md:basis-0 md:flex-1 lg:p-6 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm flex flex-col overflow-hidden min-h-[34rem] sm:min-h-[38rem] md:min-h-0"

  const scrollToOutputOnMobile = () => {
    if (typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 767px)").matches) return

    window.requestAnimationFrame(() => {
      outputPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  const prefetchATSInsights = async (
    input: { jobDescription: string; resumeContent: string },
    requestId: number
  ) => {
    setIsLoadingInsights(true)

    try {
      const response = await fetch("/api/ats-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || "Failed to load AI insights")
      }

      const data = await response.json()

      if (atsRequestIdRef.current !== requestId) return

      setAtsScore(data)
      setHasLoadedAIInsights(true)
    } catch (error) {
      if (atsRequestIdRef.current !== requestId) return
      console.warn("ATS insights prefetch error:", error)
    } finally {
      if (atsRequestIdRef.current === requestId) {
        setIsLoadingInsights(false)
      }
    }
  }

  const handleGenerate = async (formData: FormData) => {
    scrollToOutputOnMobile()
    setIsGenerating(true)
    setLatexContent("")
    setError(null)
    setStatusMessage("Preparing request...")

    try {
      const jd = (formData.get("jobDescription") as string | null)?.trim() || ""
      const resume = (formData.get("resumeContent") as string | null)?.trim() || ""

      if (!jd || !resume) {
        throw new Error("Job description and resume content are required.")
      }

      if (resume.length > MAX_FILE_SIZE) {
        throw new Error("Resume content is too large. Please reduce the size.")
      }

      setStatusMessage("Generating optimized resume...")

      const response = await fetch("/api/generate-resume", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || "Failed to generate resume")
      }

      const data = await response.json()
      const latex = data?.latex || ""

      if (!latex) {
        throw new Error("AI returned empty response")
      }

      setLatexContent(latex)
      setStatusMessage("")
    } catch (error) {
      console.error("Generation error:", error)
      const message = error instanceof Error ? error.message : "Failed to generate resume"
      setError(message)
      setLatexContent(`% Error: ${message}\n% Please try again`)
      setStatusMessage("")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleATSScore = async (formData: FormData) => {
    scrollToOutputOnMobile()
    const requestId = atsRequestIdRef.current + 1
    atsRequestIdRef.current = requestId
    const startedAt = Date.now()

    setIsScoring(true)
    setIsLoadingInsights(false)
    setAtsScore(null)
    setError(null)
    setHasLoadedAIInsights(false)

    try {
      const jd = (formData.get("jobDescription") as string | null)?.trim() || ""
      const resume = (formData.get("resumeContent") as string | null)?.trim() || ""

      if (!resume) {
        throw new Error("Resume content is required.")
      }

      const response = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd, resumeContent: resume }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.error || "Failed to score resume")
      }

      const data = await response.json()
      const input = { jobDescription: jd, resumeContent: resume }
      const elapsed = Date.now() - startedAt
      const remainingDelay = Math.max(0, ATS_LOADING_MIN_DURATION_MS - elapsed)

      if (remainingDelay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingDelay))
      }

      setAtsScore(data)
      void prefetchATSInsights(input, requestId)
    } catch (error) {
      console.error("Scoring error:", error)
      const message = error instanceof Error ? error.message : "Failed to score resume"
      setError(message)
    } finally {
      setIsScoring(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#030712] md:h-screen md:overflow-hidden">
      <div className="fixed inset-0 h-full w-full">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#020202_0%,#050505_45%,#020202_100%)]" />
        <WebGLShader />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.38))]" />
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-4 pt-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-16 lg:pt-5 xl:px-24">
        <div className="w-full rounded-full border border-white/12 bg-black/25 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl md:w-fit">
          <div className="flex items-stretch gap-2">
            <Button
              type="button"
              variant="cool"
              size="sm"
              aria-pressed={mode === "generate"}
              onClick={() => setMode("generate")}
              className={cn(
                "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
                mode === "generate"
                  ? "shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                  : "opacity-60 saturate-50 shadow-none hover:opacity-100"
              )}
            >
              <FileCode2 className="w-4 h-4" />
              <span className="text-xs font-medium sm:text-sm">LaTeX Generator</span>
            </Button>
            <Button
              type="button"
              variant="cool"
              size="sm"
              aria-pressed={mode === "ats-score"}
              onClick={() => setMode("ats-score")}
              className={cn(
                "flex-1 rounded-full px-3 text-xs sm:flex-none sm:px-4 sm:text-sm",
                mode === "ats-score"
                  ? "shadow-[0_10px_24px_rgba(34,197,94,0.28)]"
                  : "opacity-60 saturate-50 shadow-none hover:opacity-100"
              )}
            >
              <Target className="w-4 h-4" />
              <span className="text-xs font-medium sm:text-sm">ATS Score</span>
            </Button>
          </div>
        </div>

        <div className="hidden text-right md:block">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Resume Studio</p>
        </div>
      </div>

      {error && (
        <div className="relative z-10 mx-4 mt-3 flex items-start justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:mx-6 lg:mx-16 xl:mx-24">
          <p className="flex-1 text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-300 transition-colors hover:text-red-200"
            aria-label="Close error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="relative z-10 flex min-h-0 flex-1 min-w-0 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 md:flex-row md:overflow-hidden lg:gap-6 lg:px-16 lg:pb-6 xl:px-24">
        <div className={panelShellClass}>
          <ResumeInputPanel
            onGenerate={mode === "generate" ? handleGenerate : handleATSScore}
            isGenerating={mode === "generate" ? isGenerating : isScoring}
            mode={mode}
          />
        </div>

        <div ref={outputPanelRef} className={panelShellClass}>
          {mode === "generate" ? (
            <ResumePreviewPanel
              latexContent={latexContent}
              isGenerating={isGenerating}
              statusMessage={statusMessage}
            />
          ) : (
            <ATSScorePanel
              scoreData={atsScore}
              isLoading={isScoring}
              isLoadingInsights={isLoadingInsights}
              hasLoadedAIInsights={hasLoadedAIInsights}
            />
          )}
        </div>
      </div>
    </div>
  )
}
