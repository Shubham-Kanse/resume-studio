"use client"

import { useEffect, useRef, useState } from "react"

import { Upload, FileText, X, Sparkles, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDocumentActions } from "@/hooks/use-document-actions"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import { reportClientError } from "@/lib/error-monitoring"
import { getUserFacingMessage } from "@/lib/errors"
import { TRACKED_RUN_MODE, type TrackedRunMode } from "@/lib/tracked-runs"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface ResumeInputPanelProps {
  onGenerate: (data: FormData) => void
  isGenerating: boolean
  mode?: TrackedRunMode
  canUseAiGenerator?: boolean
  jobDescription: string
  resumeContent: string
  resumeFileName: string
  resumeFileMimeType: string
  extraInstructions: string
  onJobDescriptionChange: (value: string) => void
  onResumeContentChange: (value: string) => void
  onResumeFileNameChange: (value: string) => void
  onResumeFileMimeTypeChange: (value: string) => void
  onResumeFileDataUrlChange: (value: string) => void
  onResumeArtifactsChange: (value: DocumentArtifacts | null) => void
  onExtraInstructionsChange: (value: string) => void
  onLockedGenerateAttempt?: () => void
  requiresUploadConsent?: boolean
  onUploadConsentRequired?: () => void
  resetToken?: number
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("Failed to read the uploaded file"))
    reader.readAsDataURL(file)
  })
}

export function ResumeInputPanel({
  onGenerate,
  isGenerating,
  mode = TRACKED_RUN_MODE.GENERATE,
  canUseAiGenerator = false,
  jobDescription,
  resumeContent,
  resumeFileName,
  resumeFileMimeType: _resumeFileMimeType,
  extraInstructions,
  onJobDescriptionChange,
  onResumeContentChange,
  onResumeFileNameChange,
  onResumeFileMimeTypeChange,
  onResumeFileDataUrlChange,
  onResumeArtifactsChange,
  onExtraInstructionsChange,
  onLockedGenerateAttempt,
  requiresUploadConsent = false,
  onUploadConsentRequired,
  resetToken = 0,
}: ResumeInputPanelProps) {
  const { extractResume } = useDocumentActions()
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setUploadedFile(null)
    setExtractionError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [resetToken])

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
      const [fileDataUrl, extractionResult] = await Promise.all([
        readFileAsDataUrl(file),
        extractResume(file),
      ])

      onResumeFileDataUrlChange(fileDataUrl)
      onResumeArtifactsChange(extractionResult.artifacts || null)
      onResumeContentChange(extractionResult.text)
    } catch (error) {
      reportClientError(error, "resume-file-extraction")
      console.error("Error extracting text:", error)
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
    onExtraInstructionsChange("")
    removeFile()
  }

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // For generation mode, both JD and resume are required
    // For ATS score mode, only resume is required
    const isValidForGenerate =
      mode === TRACKED_RUN_MODE.GENERATE &&
      jobDescription.trim() &&
      resumeContent.trim()
    const isValidForATS =
      mode === TRACKED_RUN_MODE.ATS_SCORE && resumeContent.trim()

    if (!isValidForGenerate && !isValidForATS) return

    if (mode === TRACKED_RUN_MODE.GENERATE && !canUseAiGenerator) {
      onLockedGenerateAttempt?.()
      return
    }

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("resumeContent", resumeContent)

    if (extraInstructions.trim()) {
      formData.append("extraInstructions", extraInstructions)
    }

    onGenerate(formData)
  }

  const isValid =
    mode === TRACKED_RUN_MODE.GENERATE
      ? !!jobDescription.trim() && !!resumeContent.trim()
      : !!resumeContent.trim()
  const displayFileName = uploadedFile?.name || resumeFileName
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-xl font-bold text-foreground mb-1">
          Input Details
        </h2>
        <p className="text-muted-foreground text-sm">
          {mode === TRACKED_RUN_MODE.ATS_SCORE
            ? "Attach a resume file and optionally add a job description for keyword analysis"
            : "Paste the JD and attach a resume file"}
        </p>
      </div>

      <div className="scrollbar-dark flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
        <div className="space-y-2">
          <Label
            htmlFor="job-description"
            className="text-foreground text-sm font-medium flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-primary" />
            Job Description
            {mode === TRACKED_RUN_MODE.GENERATE && (
              <span className="text-primary">*</span>
            )}
            {mode === TRACKED_RUN_MODE.ATS_SCORE && (
              <span className="text-muted-foreground text-xs">(Optional)</span>
            )}
          </Label>
          <Textarea
            id="job-description"
            name="jobDescription"
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            className="scrollbar-dark h-32 bg-black/10 border-white/8 text-foreground placeholder:text-muted-foreground resize-none focus:border-primary/40 focus:ring-primary/15 overflow-y-auto"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="resume-upload"
            className="text-foreground text-sm font-medium flex items-center gap-2"
          >
            <Upload className="w-4 h-4 text-primary" />
            Resume
            <span className="text-primary">*</span>
          </Label>

          <div
            className={`border-2 border-dashed rounded-xl p-3 text-center transition-all duration-300 cursor-pointer group ${
              isExtracting
                ? "border-primary/50 bg-primary/10"
                : extractionError
                  ? "border-red-500/50"
                  : "border-white/15 bg-black/8 hover:border-primary/40 hover:bg-black/12"
            }`}
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
              id="resume-upload"
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

          {extractionError && (
            <p className="text-red-400 text-xs">{extractionError}</p>
          )}

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

        {mode === TRACKED_RUN_MODE.GENERATE && (
          <div className="space-y-2">
            <Label
              htmlFor="extra-instructions"
              className="text-foreground text-sm font-medium flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              Additional Info
              <span className="text-muted-foreground text-xs font-normal">
                (Optional)
              </span>
            </Label>
            <Textarea
              id="extra-instructions"
              name="extraInstructions"
              placeholder="Anything else you want to pass through to the LLM..."
              value={extraInstructions}
              onChange={(e) => onExtraInstructionsChange(e.target.value)}
              className="scrollbar-dark h-20 bg-black/10 border-white/8 text-foreground placeholder:text-muted-foreground resize-none focus:border-primary/40 focus:ring-primary/15 overflow-y-auto"
            />
          </div>
        )}

        {mode === TRACKED_RUN_MODE.GENERATE && !canUseAiGenerator ? (
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-sm font-medium text-sky-100">
              AI LaTeX Generator is a Pro feature.
            </p>
            <p className="mt-1 text-xs leading-5 text-sky-100/75">
              Free users can still use the LaTeX editor, ATS score, and
              dashboard.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex-shrink-0 mt-4 pt-4 border-t border-white/10 space-y-2">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || isGenerating || isExtracting}
          variant="cool"
          size="lg"
          className="w-full rounded-2xl py-6 text-sm font-semibold tracking-[0.01em] shadow-[0_18px_40px_rgba(34,197,94,0.2)] hover:scale-[1.01] disabled:hover:scale-100"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {mode === TRACKED_RUN_MODE.ATS_SCORE
                ? "Analyzing Resume..."
                : "Generating Resume..."}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {mode === TRACKED_RUN_MODE.ATS_SCORE
                ? "Get ATS Score"
                : "Generate LaTeX Resume"}
            </>
          )}
        </Button>
        <Button
          type="button"
          onClick={clearAll}
          disabled={isGenerating}
          variant="outline"
          className="w-full rounded-2xl py-5 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear All
        </Button>
      </div>
    </div>
  )
}
