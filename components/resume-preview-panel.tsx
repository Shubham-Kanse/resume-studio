"use client"

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import dynamic from "next/dynamic"

import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Maximize2,
  Share2,
} from "lucide-react"

import { MinimalLoadingStack } from "@/components/minimal-loading-stack"
import { Button } from "@/components/ui/button"
import { useDocumentActions } from "@/hooks/use-document-actions"
import { reportClientError } from "@/lib/error-monitoring"
import { getUserFacingMessage } from "@/lib/errors"
import {
  AUTO_COMPILE_DELAY,
  MAX_LATEX_LENGTH,
  validateLaTeX,
} from "@/lib/latex-editor"
import { cn } from "@/lib/utils"

const PDFViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PDFViewer),
  {
    loading: () => null,
  }
)

interface ResumePreviewPanelProps {
  latexContent: string
  editableLatex?: string
  isGenerating: boolean
  onEditableLatexChange?: (value: string) => void
  onOpenSplitWorkspace?: () => void
  statusMessage?: string
}

const LATEX_GENERATION_STEPS = [
  "Preparing generation request...",
  "Checking resume input...",
  "Checking job description...",
  "Extracting role signals...",
  "Mapping relevant experience...",
  "Selecting stronger bullet points...",
  "Rewriting content for fit...",
  "Building LaTeX structure...",
  "Formatting final sections...",
  "Running validation checks...",
  "Applying final refinements...",
  "Finalizing output...",
]

const LATEX_GENERATION_STEP_DURATIONS = [
  520, 540, 560, 620, 660, 700, 760, 820, 860, 900, 960,
]

function getLatexGenerationStepFromStatus(statusMessage?: string) {
  if (!statusMessage) return null

  const normalized = statusMessage.toLowerCase()
  if (normalized.includes("preparing")) return 0
  if (normalized.includes("compiling")) return LATEX_GENERATION_STEPS.length - 1
  if (normalized.includes("repaired")) return 10
  if (normalized.includes("generated")) return 9
  return null
}

function ResumePreviewPanelComponent({
  latexContent,
  editableLatex: controlledEditableLatex,
  isGenerating,
  onEditableLatexChange,
  onOpenSplitWorkspace,
  statusMessage,
}: ResumePreviewPanelProps) {
  const { compilePdfDownload, compilePreviewPdf } = useDocumentActions()
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "info">(
    "edit"
  )
  const [internalEditableLatex, setInternalEditableLatex] =
    useState<string>(latexContent)
  const [convertingToPDF, setConvertingToPDF] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [generationStep, setGenerationStep] = useState(0)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const autoCompileTimerRef = useRef<NodeJS.Timeout | null>(null)

  const editableLatex =
    controlledEditableLatex !== undefined
      ? controlledEditableLatex
      : internalEditableLatex
  const deferredEditableLatex = useDeferredValue(editableLatex)

  const setEditableLatex = useCallback(
    (value: string) => {
      if (onEditableLatexChange) {
        onEditableLatexChange(value)
        return
      }

      setInternalEditableLatex(value)
    },
    [onEditableLatexChange]
  )

  const latexErrors = useMemo(
    () => validateLaTeX(deferredEditableLatex),
    [deferredEditableLatex]
  )
  const hasErrors = latexErrors.some((error) => error.type === "error")
  const hasWarnings = latexErrors.some((error) => error.type === "warning")

  const lineNumbers = useMemo(() => {
    if (!deferredEditableLatex) return []
    const lineCount = (deferredEditableLatex.match(/\n/g) || []).length + 1
    return Array.from({ length: lineCount }, (_, index) => index + 1)
  }, [deferredEditableLatex])

  const errorLineNumbers = useMemo(() => {
    return new Set(
      latexErrors.filter((error) => error.line).map((error) => error.line!)
    )
  }, [latexErrors])

  const handleEditorScroll = useCallback(() => {
    if (editorRef.current && lineNumbersRef.current) {
      const child = lineNumbersRef.current
        .firstElementChild as HTMLElement | null
      if (child) {
        child.style.transform = `translateY(-${editorRef.current.scrollTop}px)`
      }
    }
  }, [])

  useEffect(() => {
    if (controlledEditableLatex === undefined) {
      setInternalEditableLatex(latexContent)
    }

    setPdfData(null)
    setPreviewError(null)
    setPdfError(null)
  }, [controlledEditableLatex, latexContent])

  useEffect(() => {
    if (!isGenerating) {
      setGenerationStep(0)
      return
    }

    const statusStep = getLatexGenerationStepFromStatus(statusMessage)
    if (statusStep !== null) {
      setGenerationStep((current) => Math.max(current, statusStep))
    }
  }, [isGenerating, statusMessage])

  useEffect(() => {
    if (!isGenerating) return

    let cancelled = false
    let timeoutId: number | undefined

    const advance = (stepIndex: number) => {
      if (cancelled || stepIndex >= LATEX_GENERATION_STEPS.length - 2) return

      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        setGenerationStep((current) => {
          const nextStep = Math.max(current, stepIndex + 1)
          advance(nextStep)
          return nextStep
        })
      }, LATEX_GENERATION_STEP_DURATIONS[stepIndex] ?? 860)
    }

    advance(generationStep)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [generationStep, isGenerating])

  const compilePreview = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        setPdfData(null)
        setPreviewError("No LaTeX content to preview.")
        return
      }

      setIsLoadingPreview(true)
      setPreviewError(null)
      setPdfError(null)

      try {
        const arrayBuffer = await compilePreviewPdf(content)

        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error("Empty PDF returned.")
        }

        setPdfData(arrayBuffer)
      } catch (error) {
        reportClientError(error, "resume-preview-compile")
        setPdfData(null)
        setPreviewError(
          getUserFacingMessage(error, "Failed to generate preview.")
        )
      } finally {
        setIsLoadingPreview(false)
      }
    },
    [compilePreviewPdf]
  )

  useEffect(() => {
    if (activeTab !== "preview") return

    if (!editableLatex.trim()) {
      setPdfData(null)
      setPreviewError("No LaTeX content to preview.")
      return
    }

    if (editableLatex.length > MAX_LATEX_LENGTH) {
      setPdfData(null)
      setPreviewError("LaTeX content too large for preview.")
      return
    }

    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current)
    }

    autoCompileTimerRef.current = setTimeout(() => {
      void compilePreview(editableLatex)
    }, AUTO_COMPILE_DELAY)

    return () => {
      if (autoCompileTimerRef.current) {
        clearTimeout(autoCompileTimerRef.current)
      }
    }
  }, [activeTab, compilePreview, editableLatex])

  const currentContent = editableLatex || latexContent

  const activateTab = useCallback(
    (tab: "edit" | "preview" | "info") => {
      setActiveTab(tab)

      if (tab === "preview") {
        const content = editableLatex || latexContent
        if (content.trim()) {
          window.setTimeout(() => {
            void compilePreview(content)
          }, 100)
        }
      }
    },
    [compilePreview, editableLatex, latexContent]
  )

  const handleEditorChange = (value: string) => {
    setEditableLatex(value)
    setPdfData(null)
    setPreviewError(null)
    setPdfError(null)
  }

  const renderEditorContent = () => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-white/8 bg-black/12 px-4 py-2">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            LATEX FORMAT CHECK
          </p>
          {editableLatex ? (
            <div className="flex items-center gap-2">
              {hasErrors ? (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  {
                    latexErrors.filter((error) => error.type === "error").length
                  }{" "}
                  error(s)
                </span>
              ) : hasWarnings ? (
                <span className="flex items-center gap-1 text-xs text-yellow-400">
                  <AlertTriangle className="h-3 w-3" />
                  {
                    latexErrors.filter((error) => error.type === "warning")
                      .length
                  }{" "}
                  warning(s)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  Looks valid
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {latexErrors.length > 0 ? (
        <div className="scrollbar-dark max-h-32 flex-shrink-0 overflow-y-auto border-b border-white/8 bg-black/10 px-4 py-2">
          <div className="space-y-1">
            {latexErrors.map((error, index) => (
              <div
                key={`${error.message}-${index}`}
                onClick={() => {
                  if (error.line && editorRef.current) {
                    const lines = deferredEditableLatex.split("\n")
                    const lineStart =
                      lines.slice(0, error.line - 1).join("\n").length +
                      (error.line > 1 ? 1 : 0)
                    editorRef.current.focus()
                    editorRef.current.setSelectionRange(
                      lineStart,
                      lineStart + (lines[error.line - 1]?.length || 0)
                    )
                    editorRef.current.scrollTop = (error.line - 1) * 20 - 100
                  }
                }}
                className={`flex cursor-pointer items-start gap-2 rounded p-1 text-xs transition-colors hover:bg-white/8 ${
                  error.type === "error" ? "text-red-400" : "text-yellow-400"
                }`}
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>
                  {error.line ? (
                    <span className="font-semibold">Line {error.line}: </span>
                  ) : null}
                  {error.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={lineNumbersRef}
          className="flex-shrink-0 overflow-hidden border-r border-white/8 bg-black/10 text-right select-none"
          style={{ width: "3rem" }}
        >
          <div style={{ paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
            {lineNumbers.map((lineNumber) => (
              <div
                key={lineNumber}
                className={`pr-2 text-[11px] ${
                  errorLineNumbers.has(lineNumber)
                    ? "font-bold text-red-400"
                    : "text-muted-foreground/50"
                }`}
                style={{ lineHeight: "1.25rem", height: "1.25rem" }}
              >
                {lineNumber}
              </div>
            ))}
          </div>
        </div>

        <textarea
          ref={editorRef}
          id="latex-editor"
          name="latexEditor"
          value={editableLatex}
          onChange={(event) => handleEditorChange(event.target.value)}
          onScroll={handleEditorScroll}
          placeholder="Paste or edit your LaTeX code here..."
          spellCheck={false}
          wrap="off"
          aria-label="LaTeX editor"
          className="scrollbar-dark h-full min-w-0 flex-1 resize-none border-0 bg-transparent font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          style={{ lineHeight: "1.25rem", padding: "0.5rem", overflow: "auto" }}
        />
      </div>
    </div>
  )

  const renderPreviewContent = () => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b border-white/8 bg-black/12 px-4 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            LIVE PDF PREVIEW
          </p>
          <div className="text-xs text-muted-foreground">
            Auto-updates after you stop typing
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {previewError ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-muted-foreground">
            <AlertTriangle className="mb-2 h-8 w-8 text-red-400" />
            <p className="max-w-md text-center text-sm text-red-400">
              {previewError}
            </p>
          </div>
        ) : (
          <PDFViewer pdfData={pdfData} isLoading={isLoadingPreview} />
        )}
      </div>
    </div>
  )

  const renderInfoContent = () => (
    <div className="scrollbar-dark h-full overflow-y-auto p-4">
      <div className="space-y-3">
        <div className="rounded-lg border border-white/8 bg-black/10 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Quick Reference
          </h3>
          <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
            <div>{`\\textbf{bold text}`} → Bold</div>
            <div>{`\\textit{italic text}`} → Italic</div>
            <div>{`\\section{Experience}`} → Section</div>
            <div>{`\\begin{itemize} ... \\end{itemize}`} → Bullet list</div>
          </div>
        </div>
      </div>
    </div>
  )

  const handleCopy = async () => {
    if (!currentContent) return
    await navigator.clipboard.writeText(currentContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadLaTeX = () => {
    if (!currentContent) return

    const blob = new Blob([currentContent], { type: "text/x-latex" })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "resume.tex"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const convertToPDF = async () => {
    if (!currentContent) return

    setConvertingToPDF(true)
    setPdfError(null)

    try {
      const blob = await compilePdfDownload(currentContent)
      const url = URL.createObjectURL(blob)

      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "resume.pdf"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      reportClientError(error, "resume-preview-download")
      setPdfError(
        getUserFacingMessage(
          error,
          "Failed to convert to PDF. Please check your LaTeX syntax."
        )
      )
    } finally {
      setConvertingToPDF(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-shrink-0 items-center justify-between">
        <div>
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-foreground">
            <FileText className="h-5 w-5 text-primary" />
            Resume Output
          </h2>
          <p className="text-sm text-muted-foreground">
            View, edit, preview, and export your LaTeX resume
          </p>
        </div>
        {onOpenSplitWorkspace ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onOpenSplitWorkspace}
            disabled={isGenerating}
            aria-label="Open side-by-side workspace"
            title="Open side-by-side workspace"
            className="h-9 w-9 rounded-full border-white/8 bg-black/12 text-muted-foreground hover:bg-white/8 hover:text-foreground"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-shrink-0 gap-2 overflow-x-auto">
        {[
          { key: "edit", label: "Edit LaTeX", icon: Share2 },
          { key: "preview", label: "Preview PDF", icon: Eye },
          { key: "info", label: "Info", icon: FileText },
        ].map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={activeTab === key ? "cool" : "outline"}
            aria-pressed={activeTab === key}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              activateTab(key as "edit" | "preview" | "info")
            }}
            className={cn(
              "rounded-full px-4 whitespace-nowrap",
              activeTab === key
                ? "shadow-[0_10px_24px_color-mix(in_oklab,var(--primary)_24%,transparent)]"
                : "border-white/8 bg-black/12 text-muted-foreground hover:bg-white/8 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-white/8 bg-black/10">
        {isGenerating ? (
          <MinimalLoadingStack
            title="LaTeX Generation"
            steps={LATEX_GENERATION_STEPS}
            activeStep={generationStep}
          />
        ) : activeTab === "edit" ? (
          renderEditorContent()
        ) : activeTab === "preview" ? (
          renderPreviewContent()
        ) : (
          renderInfoContent()
        )}
      </div>

      {pdfError ? (
        <div className="mt-2 flex-shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-400">{pdfError}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleCopy}
          disabled={!currentContent || isGenerating}
          variant="outline"
          className="flex-1 rounded-2xl py-5"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </Button>

        <Button
          type="button"
          onClick={handleDownloadLaTeX}
          disabled={!currentContent || isGenerating}
          variant="outline"
          className="flex-1 rounded-2xl py-5"
        >
          <Download className="h-4 w-4" />
          Download .tex
        </Button>

        <Button
          type="button"
          onClick={convertToPDF}
          disabled={!currentContent || isGenerating || convertingToPDF}
          variant="cool"
          className="flex-1 rounded-2xl py-5 font-semibold shadow-[0_18px_40px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
        >
          {convertingToPDF ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Download PDF
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export const ResumePreviewPanel = memo(ResumePreviewPanelComponent)
