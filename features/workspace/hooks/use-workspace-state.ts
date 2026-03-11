"use client"

import { useEffect, useState } from "react"

import type { DocumentArtifacts } from "@/lib/document-artifacts"
import { TRACKED_RUN_MODE, type TrackedRunMode } from "@/lib/tracked-runs"
import type { ATSScoreResponse } from "@/types/ats"

const APP_MODE = {
  DASHBOARD: "dashboard",
  JOB_TRACKER: "job-tracker",
} as const

export { APP_MODE }
export type AppMode = (typeof APP_MODE)[keyof typeof APP_MODE] | TrackedRunMode

export function useWorkspaceState() {
  const [mode, setMode] = useState<AppMode>(TRACKED_RUN_MODE.GENERATE)
  const [jobDescription, setJobDescription] = useState("")
  const [resumeContent, setResumeContent] = useState("")
  const [resumeFileName, setResumeFileName] = useState("")
  const [resumeFileMimeType, setResumeFileMimeType] = useState("")
  const [resumeFileDataUrl, setResumeFileDataUrl] = useState("")
  const [resumeArtifacts, setResumeArtifacts] =
    useState<DocumentArtifacts | null>(null)
  const [extraInstructions, setExtraInstructions] = useState("")
  const [latexContent, setLatexContent] = useState("")
  const [editableLatexContent, setEditableLatexContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [atsScore, setAtsScore] = useState<ATSScoreResponse | null>(null)
  const [isScoring, setIsScoring] = useState(false)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [hasLoadedAIInsights, setHasLoadedAIInsights] = useState(false)

  useEffect(() => {
    setEditableLatexContent(latexContent)
  }, [latexContent])

  return {
    APP_MODE,
    mode,
    setMode,
    jobDescription,
    setJobDescription,
    resumeContent,
    setResumeContent,
    resumeFileName,
    setResumeFileName,
    resumeFileMimeType,
    setResumeFileMimeType,
    resumeFileDataUrl,
    setResumeFileDataUrl,
    resumeArtifacts,
    setResumeArtifacts,
    extraInstructions,
    setExtraInstructions,
    latexContent,
    setLatexContent,
    editableLatexContent,
    setEditableLatexContent,
    isGenerating,
    setIsGenerating,
    statusMessage,
    setStatusMessage,
    error,
    setError,
    atsScore,
    setAtsScore,
    isScoring,
    setIsScoring,
    isLoadingInsights,
    setIsLoadingInsights,
    hasLoadedAIInsights,
    setHasLoadedAIInsights,
  }
}
