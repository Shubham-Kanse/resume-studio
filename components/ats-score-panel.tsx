"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"

import { FileSearch, FileText, Gauge, Loader2, Upload, X } from "lucide-react"

import {
  ATS_NAV_GROUPS,
  type ATSPanelSectionId,
  getNavSectionScore,
  renderATSSection,
} from "@/components/ats/ats-panel-sections"
import { MinimalLoadingStack } from "@/components/minimal-loading-stack"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDocumentActions } from "@/hooks/use-document-actions"
import {
  nlpAnalysisCache,
  runtimeSpellMetricsCache,
} from "@/lib/ats-analysis-cache"
import type { ATSNLPAnalysis } from "@/lib/ats-nlp-analysis-types"
import type { RuntimeSpellCheckMetrics } from "@/lib/ats-runtime-spell-check"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import { reportClientError } from "@/lib/error-monitoring"
import { getUserFacingMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { ATSScoreResponse } from "@/types/ats"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface ATSScorePanelProps {
  scoreData: ATSScoreResponse | null
  runtimeSpellMetrics: RuntimeSpellCheckMetrics | null
  nlpAnalysis: ATSNLPAnalysis | null
  resumeContent: string
  jobDescription: string
  resumeFileName: string
  isLoading: boolean
  isLoadingInsights: boolean
  hasLoadedAIInsights: boolean
  canUseAiInsights: boolean
  onUpgradeToPro: () => void
  onRescoreMyCV: () => void
  onJobDescriptionChange: (value: string) => void
  onResumeContentChange: (value: string) => void
  onResumeFileNameChange: (value: string) => void
  onResumeFileMimeTypeChange: (value: string) => void
  onResumeFileDataUrlChange: (value: string) => void
  onResumeArtifactsChange: (value: DocumentArtifacts | null) => void
  onGetATSScore: () => void
  onRuntimeSpellMetricsChange: (value: RuntimeSpellCheckMetrics | null) => void
  onNlpAnalysisChange: (value: ATSNLPAnalysis | null) => void
  requiresUploadConsent?: boolean
  onUploadConsentRequired?: () => void
}

const ATS_LOADING_STEP_DURATION_MS = 880
const ATS_LOADING_FINISH_FADE_DELAY_MS = 260

function ATSLoadingPanel({
  hasJobDescription,
  isFinishing,
  onFinish,
}: {
  hasJobDescription: boolean
  isFinishing: boolean
  onFinish: () => void
}) {
  const [activeStep, setActiveStep] = useState(0)
  const loadingSteps = [
    { title: "Parsing your CV..." },
    { title: "Detecting resume structure and sections..." },
    { title: "Extracting professional experience..." },
    { title: "Analyzing skills, tools, and technologies..." },
    { title: "Evaluating career progression and achievements..." },
    ...(hasJobDescription
      ? [{ title: "Matching keywords with job requirements..." }]
      : []),
    { title: "Assessing ATS compatibility score..." },
    { title: "Generating improvement recommendations..." },
    { title: "Finalizing your analysis..." },
  ]

  useEffect(() => {
    setActiveStep(0)
    let cancelled = false
    let timeoutId: number | undefined

    const advance = (stepIndex: number) => {
      if (cancelled || stepIndex >= loadingSteps.length - 1) return

      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        const nextStep = stepIndex + 1
        setActiveStep(nextStep)
        advance(nextStep)
      }, ATS_LOADING_STEP_DURATION_MS)
    }

    advance(0)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [hasJobDescription, loadingSteps.length])

  useEffect(() => {
    if (!isFinishing) return

    let cancelled = false
    let timeoutId: number | undefined
    const lastStepIndex = loadingSteps.length - 1

    const finishSequence = (stepIndex: number) => {
      if (cancelled) return

      if (stepIndex >= lastStepIndex) {
        timeoutId = window.setTimeout(() => {
          if (!cancelled) onFinish()
        }, ATS_LOADING_FINISH_FADE_DELAY_MS)
        return
      }

      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        setActiveStep((current) => {
          const nextStep = Math.min(
            lastStepIndex,
            Math.max(current, stepIndex) + 1
          )
          finishSequence(nextStep)
          return nextStep
        })
      }, ATS_LOADING_STEP_DURATION_MS)
    }

    finishSequence(activeStep)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [activeStep, isFinishing, loadingSteps.length, onFinish])

  return (
    <MinimalLoadingStack
      title="ATS Analysis"
      steps={loadingSteps.map((step) => step.title)}
      activeStep={activeStep}
    />
  )
}

function ATSScorePanelComponent({
  scoreData,
  runtimeSpellMetrics,
  nlpAnalysis,
  resumeContent,
  jobDescription,
  resumeFileName,
  isLoading,
  isLoadingInsights,
  hasLoadedAIInsights,
  canUseAiInsights,
  onUpgradeToPro,
  onRescoreMyCV,
  onJobDescriptionChange,
  onResumeContentChange,
  onResumeFileNameChange,
  onResumeFileMimeTypeChange,
  onResumeFileDataUrlChange,
  onResumeArtifactsChange,
  onGetATSScore,
  onRuntimeSpellMetricsChange,
  onNlpAnalysisChange,
  requiresUploadConsent = false,
  onUploadConsentRequired,
}: ATSScorePanelProps) {
  const { extractResume } = useDocumentActions()
  const [activeSection, setActiveSection] =
    useState<ATSPanelSectionId>("overview")
  const [isScoreVisible, setIsScoreVisible] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [showLoadingPanel, setShowLoadingPanel] = useState(isLoading)
  const [isLoadingPanelExiting, setIsLoadingPanelExiting] = useState(false)
  const lastSpellRequestKeyRef = useRef<string | null>(null)
  const lastNlpRequestKeyRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasJobDescription = jobDescription.trim().length > 0

  useEffect(() => {
    setActiveSection("overview")
  }, [scoreData])

  useEffect(() => {
    if (!isLoading) return
    setShowLoadingPanel(true)
    setIsLoadingPanelExiting(false)
  }, [isLoading])

  const handleLoadingPanelFinish = useCallback(() => {
    setIsLoadingPanelExiting(true)
    window.setTimeout(() => {
      setShowLoadingPanel(false)
      setIsLoadingPanelExiting(false)
    }, 260)
  }, [])

  useEffect(() => {
    if (resumeFileName.trim()) return
    setUploadedFile(null)
    setExtractionError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [resumeFileName])

  useEffect(() => {
    if (!scoreData || isLoading) {
      setIsScoreVisible(false)
      return
    }

    const timeoutId = window.setTimeout(() => setIsScoreVisible(true), 120)
    return () => window.clearTimeout(timeoutId)
  }, [isLoading, scoreData])

  useEffect(() => {
    if (!scoreData || !resumeContent.trim()) {
      onRuntimeSpellMetricsChange(null)
      lastSpellRequestKeyRef.current = null
      return
    }

    if (runtimeSpellMetrics) return

    const requestKey = JSON.stringify({
      content: resumeContent,
    })
    if (lastSpellRequestKeyRef.current === requestKey) return
    lastSpellRequestKeyRef.current = requestKey

    let cancelled = false

    const run = async () => {
      try {
        const pendingRequest =
          runtimeSpellMetricsCache.get(requestKey) ??
          fetch("/api/ats-spell-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestKey,
          })
            .then(async (response) => {
              if (!response.ok) return null
              return (await response.json()) as RuntimeSpellCheckMetrics
            })
            .catch(() => null)

        runtimeSpellMetricsCache.set(requestKey, pendingRequest)
        const data = await pendingRequest
        if (!cancelled) {
          onRuntimeSpellMetricsChange(data)
        }
      } catch {
        if (!cancelled) {
          onRuntimeSpellMetricsChange(null)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [
    onRuntimeSpellMetricsChange,
    resumeContent,
    runtimeSpellMetrics,
    scoreData,
  ])

  useEffect(() => {
    if (!scoreData || !resumeContent.trim()) {
      onNlpAnalysisChange(null)
      lastNlpRequestKeyRef.current = null
      return
    }

    if (nlpAnalysis) return

    const requestKey = JSON.stringify({
      resumeContent,
    })
    if (lastNlpRequestKeyRef.current === requestKey) return
    lastNlpRequestKeyRef.current = requestKey

    let cancelled = false

    const run = async () => {
      try {
        const pendingRequest =
          nlpAnalysisCache.get(requestKey) ??
          fetch("/api/ats-nlp-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestKey,
          })
            .then(async (response) => {
              if (!response.ok) return null
              const payload = (await response.json()) as ATSNLPAnalysis
              return payload
            })
            .catch(() => null)

        nlpAnalysisCache.set(requestKey, pendingRequest)
        const data = await pendingRequest
        if (data) {
          nlpAnalysisCache.set(requestKey, Promise.resolve(data))
        } else {
          nlpAnalysisCache.delete(requestKey)
        }
        if (!cancelled) {
          onNlpAnalysisChange(data)
        }
      } catch {
        nlpAnalysisCache.delete(requestKey)
        if (!cancelled) {
          onNlpAnalysisChange(null)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [nlpAnalysis, onNlpAnalysisChange, resumeContent, scoreData])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (requiresUploadConsent) {
      onUploadConsentRequired?.()
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setUploadedFile(null)
      onResumeContentChange("")
      onResumeFileNameChange("")
      onResumeFileMimeTypeChange("")
      onResumeFileDataUrlChange("")
      onResumeArtifactsChange(null)
      setExtractionError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 10MB.`
      )
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploadedFile(file)
    onResumeFileNameChange(file.name)
    onResumeFileMimeTypeChange(file.type || "")
    setIsExtracting(true)
    setExtractionError(null)

    try {
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? reader.result : "")
        reader.onerror = () =>
          reject(new Error("Failed to read the uploaded file"))
        reader.readAsDataURL(file)
      })

      const extractionResult = await extractResume(file)
      onResumeFileDataUrlChange(fileDataUrl)
      onResumeArtifactsChange(extractionResult.artifacts || null)
      onResumeContentChange(extractionResult.text)
    } catch (error) {
      reportClientError(error, "ats-resume-file-extraction")
      onResumeContentChange("")
      onResumeFileDataUrlChange("")
      onResumeArtifactsChange(null)
      setExtractionError(
        `Failed to extract text: ${getUserFacingMessage(error, "Unknown error")}.`
      )
    } finally {
      setIsExtracting(false)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    onResumeContentChange("")
    onResumeFileNameChange("")
    onResumeFileMimeTypeChange("")
    onResumeFileDataUrlChange("")
    onResumeArtifactsChange(null)
    setExtractionError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const clearAll = () => {
    onJobDescriptionChange("")
    removeFile()
  }

  if (showLoadingPanel) {
    return (
      <div
        className={cn(
          "h-full transition-opacity duration-300",
          isLoadingPanelExiting ? "opacity-0" : "opacity-100"
        )}
      >
        <ATSLoadingPanel
          hasJobDescription={Boolean(jobDescription.trim())}
          isFinishing={!isLoading}
          onFinish={handleLoadingPanelFinish}
        />
      </div>
    )
  }

  if (!scoreData) {
    const displayFileName = uploadedFile?.name || resumeFileName

    return (
      <div className="flex h-full min-h-0 flex-col justify-center p-4 sm:p-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-start text-left">
          <div className="flex w-full flex-col items-center text-center">
            <FileSearch className="mb-4 h-16 w-16 text-primary" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              No ATS Score Yet
            </h3>
          </div>

          <div className="mt-8 flex w-full flex-col gap-6">
            <div className="w-full space-y-2">
              <Label
                htmlFor="ats-resume-upload"
                className="text-foreground text-sm font-medium flex items-center gap-2"
              >
                <Upload className="w-4 h-4 text-primary" />
                Upload Resume
              </Label>

              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-3 text-center transition-all duration-300 cursor-pointer group",
                  isExtracting
                    ? "border-primary/50 bg-primary/10"
                    : extractionError
                      ? "border-red-500/50"
                      : "border-white/15 bg-black/8 hover:border-primary/40 hover:bg-black/12"
                )}
                onClick={() => {
                  if (isExtracting) return
                  if (requiresUploadConsent) {
                    onUploadConsentRequired?.()
                    return
                  }
                  fileInputRef.current?.click()
                }}
              >
                <input
                  ref={fileInputRef}
                  id="ats-resume-upload"
                  name="resumeContentFile"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isExtracting}
                />

                {isExtracting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-foreground text-sm">
                      Uploading {uploadedFile?.name || "resume file"}...
                    </span>
                  </div>
                ) : displayFileName ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="block min-w-0 truncate text-foreground text-sm font-medium">
                      {displayFileName}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile()
                      }}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors"
                      aria-label="Remove uploaded resume"
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      Attach resume file (PDF, DOC, DOCX, TXT)
                    </p>
                  </div>
                )}
              </div>

              {extractionError ? (
                <p className="text-red-400 text-xs">{extractionError}</p>
              ) : null}

              <p className="text-[11px] italic text-white/38">
                Upload PDF for best results.
              </p>
              {requiresUploadConsent ? (
                <p className="text-[11px] text-amber-300/85">
                  Please accept the Privacy Policy and Terms before uploading a
                  resume in guest mode.
                </p>
              ) : null}
            </div>

            <div className="w-full space-y-2">
              <Label
                htmlFor="ats-job-description"
                className="text-foreground text-sm font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-primary" />
                Paste JD
                <span className="text-muted-foreground text-xs">
                  (Optional)
                </span>
              </Label>
              <Textarea
                id="ats-job-description"
                name="jobDescription"
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => onJobDescriptionChange(e.target.value)}
                className="scrollbar-dark h-40 bg-black/10 border-white/8 text-foreground placeholder:text-muted-foreground resize-none focus:border-primary/40 focus:ring-primary/15 overflow-y-auto"
              />
            </div>

            <div className="w-full">
              <div className="flex w-full flex-col gap-2">
                <Button
                  type="button"
                  onClick={onGetATSScore}
                  disabled={!resumeContent.trim() || isExtracting}
                  variant="cool"
                  size="lg"
                  className="w-full rounded-2xl py-6 text-sm font-semibold tracking-[0.01em] shadow-[0_18px_40px_color-mix(in_oklab,var(--primary)_20%,transparent)] hover:scale-[1.01] disabled:hover:scale-100"
                >
                  <Gauge className="w-5 h-5" />
                  Get ATS Score
                </Button>
                <Button
                  type="button"
                  onClick={clearAll}
                  disabled={isExtracting}
                  variant="outline"
                  className="w-full rounded-2xl py-5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  void isLoadingInsights
  void hasLoadedAIInsights
  void canUseAiInsights
  void onUpgradeToPro

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden transition-all duration-300",
        isScoreVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      )}
    >
      <div className="mb-4 flex-shrink-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Gauge className="h-5 w-5 text-primary" />
              ATS Score Analysis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the uploaded resume through the new analysis workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onRescoreMyCV}
            className="rounded-2xl border border-primary/35 bg-primary/12 px-4 py-3 text-left text-sm font-medium text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-primary/16"
          >
            Re-score My CV
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-[28px] border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="scrollbar-dark h-full overflow-y-auto pr-1">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-foreground">
                Analysis &amp; Feedback
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Navigate ATS scoring modules for this uploaded resume.
              </p>
            </div>

            <div className="space-y-5">
              {ATS_NAV_GROUPS.map((group, groupIndex) => (
                <div key={`${group.heading ?? "group"}-${groupIndex}`}>
                  {group.heading ? (
                    <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/38">
                      {group.heading}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const isActive = activeSection === item.id
                      const shouldShowScore =
                        item.id !== "overview" &&
                        item.id !== "breakdown" &&
                        item.id !== "sample-cv-lines" &&
                        item.id !== "action-verbs" &&
                        !(item.id === "job-match" && !hasJobDescription)
                      const navScore = shouldShowScore
                        ? getNavSectionScore(
                            item.id,
                            scoreData,
                            resumeContent,
                            runtimeSpellMetrics,
                            nlpAnalysis
                          )
                        : null
                      const isSpellCheck = item.id === "spell-check"
                      const navBadge = isSpellCheck
                        ? "!"
                        : navScore !== null
                          ? String(navScore)
                          : null
                      const navScoreClass = isSpellCheck
                        ? "text-amber-500"
                        : navScore !== null && navScore >= 9
                          ? isActive
                            ? "text-primary"
                            : "text-primary"
                          : navScore !== null && navScore >= 6
                            ? isActive
                              ? "text-amber-500"
                              : "text-amber-500"
                            : isActive
                              ? "text-red-500"
                              : "text-red-500"

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveSection(item.id)}
                          aria-pressed={isActive}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors",
                            isActive
                              ? "border-primary/35 bg-primary/12 text-primary shadow-[0_8px_24px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
                              : "border-white/10 bg-transparent text-muted-foreground hover:border-white/18 hover:bg-white/[0.03] hover:text-foreground"
                          )}
                        >
                          <span>{item.label}</span>
                          {navBadge !== null ? (
                            <span
                              className={cn(
                                "shrink-0 text-sm font-medium",
                                navScoreClass
                              )}
                            >
                              {navBadge}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden rounded-[28px] border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5">
          <div className="scrollbar-dark h-full overflow-y-auto pr-1">
            {renderATSSection(activeSection, {
              scoreData,
              resumeContent,
              jobDescription,
              nlpAnalysis,
              spellMetrics: runtimeSpellMetrics,
              onSelectSection: setActiveSection,
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

export const ATSScorePanel = memo(ATSScorePanelComponent)
