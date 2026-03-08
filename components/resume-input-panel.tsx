"use client"

import { useState, useRef } from "react"
import { Upload, FileText, X, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface ResumeInputPanelProps {
  onGenerate: (data: FormData) => void
  isGenerating: boolean
  mode?: "generate" | "ats-score"
}

async function extractTextFromFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/extract-resume", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Extraction failed")
  }

  const { text } = await response.json()
  return text
}

export function ResumeInputPanel({ onGenerate, isGenerating, mode = "generate" }: ResumeInputPanelProps) {
  const [jobDescription, setJobDescription] = useState("")
  const [resumeContent, setResumeContent] = useState("")
  const [extraInstructions, setExtraInstructions] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setIsExtracting(true)
    setExtractionError(null)

    if (file.size > MAX_FILE_SIZE) {
      setExtractionError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 10MB.`)
      setIsExtracting(false)
      return
    }

    try {
      const extractedText = await extractTextFromFile(file)
      setResumeContent(extractedText)
    } catch (error) {
      console.error("Error extracting text:", error)
      setExtractionError(
        `Failed to extract text: ${error instanceof Error ? error.message : "Unknown error"}.`
      )
    } finally {
      setIsExtracting(false)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setResumeContent("")
    setExtractionError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const clearAll = () => {
    setJobDescription("")
    setExtraInstructions("")
    removeFile()
  }

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // For generation mode, both JD and resume are required
    // For ATS score mode, only resume is required
    const isValidForGenerate = mode === "generate" && jobDescription.trim() && resumeContent.trim()
    const isValidForATS = mode === "ats-score" && resumeContent.trim()
    
    if (!isValidForGenerate && !isValidForATS) return

    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("resumeContent", resumeContent)

    if (extraInstructions.trim()) {
      formData.append("extraInstructions", extraInstructions)
    }

    onGenerate(formData)
  }

  const isValid = mode === "generate" 
    ? (!!jobDescription.trim() && !!resumeContent.trim())
    : !!resumeContent.trim()

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-xl font-bold text-foreground mb-1">Input Details</h2>
        <p className="text-muted-foreground text-sm">
          {mode === "ats-score" 
            ? "Attach a resume file and optionally add a job description for keyword analysis"
            : "Paste the JD and attach a resume file"
          }
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
            {mode === "generate" && <span className="text-primary">*</span>}
            {mode === "ats-score" && <span className="text-muted-foreground text-xs">(Optional)</span>}
          </Label>
          <Textarea
            id="job-description"
            name="jobDescription"
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="scrollbar-dark h-32 bg-black/10 border-white/8 text-foreground placeholder:text-muted-foreground resize-none focus:border-primary/40 focus:ring-primary/15 overflow-y-auto"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="resume-content"
            className="text-foreground text-sm font-medium flex items-center gap-2"
          >
            <Upload className="w-4 h-4 text-primary" />
            Resume
            <span className="text-primary">*</span>
          </Label>

          <div
            className={`border-2 border-dashed rounded-xl p-3 text-center transition-all duration-300 cursor-pointer group ${isExtracting
              ? "border-primary/50 bg-primary/10"
              : extractionError
                ? "border-red-500/50"
                : "border-white/15 bg-black/8 hover:border-primary/40 hover:bg-black/12"
              }`}
            onClick={() => !isExtracting && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              id="resume-content"
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
                  Extracting text from {uploadedFile?.name}...
                </span>
              </div>
            ) : uploadedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-foreground text-sm font-medium">
                  {uploadedFile.name}
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
        </div>

        {mode === "generate" && (
          <div className="space-y-2">
            <Label
              htmlFor="extra-instructions"
              className="text-foreground text-sm font-medium flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              Additional Info
              <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="extra-instructions"
              name="extraInstructions"
              placeholder="Anything else you want to pass through to the LLM..."
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              className="scrollbar-dark h-20 bg-black/10 border-white/8 text-foreground placeholder:text-muted-foreground resize-none focus:border-primary/40 focus:ring-primary/15 overflow-y-auto"
            />
          </div>
        )}
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
              {mode === "ats-score" ? "Analyzing Resume..." : "Generating Resume..."}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {mode === "ats-score" ? "Get ATS Score" : "Generate LaTeX Resume"}
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
