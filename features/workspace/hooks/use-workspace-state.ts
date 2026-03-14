"use client"

import { useEffect, useState } from "react"

import { APP_MODE, type AppMode } from "@/features/workspace/workspace-mode"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import type { ATSScoreResponse } from "@/types/ats"

export { APP_MODE }
export type { AppMode }

export function useWorkspaceState(initialMode: AppMode = APP_MODE.HOME) {
  const [mode, setMode] = useState<AppMode>(initialMode)
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
