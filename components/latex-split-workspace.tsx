"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle, Download, Loader2, Minimize2 } from "lucide-react"
import { PDFViewer } from "@/components/pdf-viewer"
import { Button } from "@/components/ui/button"
import { getUserFacingMessage } from "@/lib/errors"
import { reportClientError } from "@/lib/error-monitoring"
import {
  AUTO_COMPILE_DELAY,
  MAX_LATEX_LENGTH,
  validateLaTeX,
} from "@/lib/latex-editor"
import { documentServiceClient } from "@/lib/services/gateway-client"

interface LatexSplitWorkspaceProps {
  open: boolean
  latexContent: string
  isGenerating: boolean
  statusMessage?: string
  onLatexChange: (value: string) => void
  onClose: () => void
}

export function LatexSplitWorkspace({
  open,
  latexContent,
  isGenerating,
  statusMessage,
  onLatexChange,
  onClose,
}: LatexSplitWorkspaceProps) {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const autoCompileTimerRef = useRef<NodeJS.Timeout | null>(null)

  const latexErrors = useMemo(() => validateLaTeX(latexContent), [latexContent])
  const hasErrors = latexErrors.some((error) => error.type === "error")
  const hasWarnings = latexErrors.some((error) => error.type === "warning")

  const lineNumbers = useMemo(() => {
    if (!latexContent) return []
    const lineCount = (latexContent.match(/\n/g) || []).length + 1
    return Array.from({ length: lineCount }, (_, index) => index + 1)
  }, [latexContent])

  const errorLineNumbers = useMemo(() => {
    return new Set(latexErrors.filter((error) => error.line).map((error) => error.line!))
  }, [latexErrors])

  const handleEditorScroll = useCallback(() => {
    if (editorRef.current && lineNumbersRef.current) {
      const child = lineNumbersRef.current.firstElementChild as HTMLElement | null
      if (child) {
        child.style.transform = `translateY(-${editorRef.current.scrollTop}px)`
      }
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, open])

  const compilePreview = useCallback(async (content: string) => {
    if (!content.trim()) {
      setPdfData(null)
      setPreviewError("No LaTeX content to preview.")
      return
    }

    setIsLoadingPreview(true)
    setPreviewError(null)

    try {
      const response = await documentServiceClient.compileLatex({
        latex: content,
        preview: true,
      })

      const arrayBuffer = await response.arrayBuffer()

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error("Empty PDF returned.")
      }

      setPdfData(arrayBuffer)
    } catch (error) {
      reportClientError(error, "latex-split-preview")
      setPdfData(null)
      setPreviewError(getUserFacingMessage(error, "Failed to generate preview."))
    } finally {
      setIsLoadingPreview(false)
    }
  }, [])

  const handleDownloadPdf = useCallback(async () => {
    if (!latexContent.trim()) return

    setIsDownloadingPdf(true)

    try {
      const response = await documentServiceClient.compileLatex({
        latex: latexContent,
        preview: false,
      })

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")

      anchor.href = url
      anchor.download = "resume.pdf"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      reportClientError(error, "latex-split-download")
      setPreviewError(
        getUserFacingMessage(error, "Failed to download PDF.")
      )
    } finally {
      setIsDownloadingPdf(false)
    }
  }, [latexContent])

  useEffect(() => {
    if (!open) return

    if (!latexContent.trim()) {
      setPdfData(null)
      setPreviewError("No LaTeX content to preview.")
      return
    }

    if (latexContent.length > MAX_LATEX_LENGTH) {
      setPdfData(null)
      setPreviewError("LaTeX content too large for preview.")
      return
    }

    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current)
    }

    autoCompileTimerRef.current = setTimeout(() => {
      void compilePreview(latexContent)
    }, AUTO_COMPILE_DELAY)

    return () => {
      if (autoCompileTimerRef.current) {
        clearTimeout(autoCompileTimerRef.current)
      }
    }
  }, [compilePreview, latexContent, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/28 backdrop-blur-[2px]">
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col px-4 pb-4 pt-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="mb-4 flex items-center justify-between rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.16),rgba(3,7,18,0.06))] px-4 py-3 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
          <div>
            <p className="text-sm font-semibold text-foreground">Side-by-Side Workspace</p>
            <p className="text-xs text-muted-foreground">
              Edit LaTeX and preview the PDF over the main panels
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onClose}
            aria-label="Close side-by-side workspace"
            title="Close side-by-side workspace"
            className="h-9 w-9 rounded-full border-white/8 bg-transparent text-muted-foreground hover:bg-white/8 hover:text-foreground"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 md:items-stretch md:overflow-hidden">
          <div className="w-full min-w-0 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.16),rgba(3,7,18,0.06))] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm flex min-h-0 flex-col overflow-hidden sm:rounded-[28px] sm:p-5 lg:p-6">
            {isGenerating ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-muted-foreground">
                <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                <p className="text-base font-medium text-foreground">
                  {statusMessage || "Generating your resume..."}
                </p>
                <p className="mt-1 text-sm">This may take a few moments</p>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="flex-shrink-0 border-b border-white/8 bg-transparent px-4 py-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-semibold text-muted-foreground">LATEX EDITOR</p>
                    {latexContent && (
                      <div className="flex items-center gap-2">
                        {hasErrors ? (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            {latexErrors.filter((error) => error.type === "error").length} error(s)
                          </span>
                        ) : hasWarnings ? (
                          <span className="flex items-center gap-1 text-xs text-yellow-400">
                            <AlertTriangle className="h-3 w-3" />
                            {latexErrors.filter((error) => error.type === "warning").length} warning(s)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="h-3 w-3" />
                            Looks valid
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {latexErrors.length > 0 ? (
                  <div className="scrollbar-dark max-h-32 flex-shrink-0 overflow-y-auto border-b border-white/8 bg-transparent px-4 py-2">
                    <div className="space-y-1">
                      {latexErrors.map((error, index) => (
                        <div
                          key={`${error.message}-${index}`}
                          onClick={() => {
                            if (error.line && editorRef.current) {
                              const lines = latexContent.split("\n")
                              const lineStart =
                                lines.slice(0, error.line - 1).join("\n").length +
                                (error.line > 1 ? 1 : 0)
                              editorRef.current.focus()
                              editorRef.current.setSelectionRange(
                                lineStart,
                                lineStart + lines[error.line - 1].length
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
                            {error.line ? <span className="font-semibold">Line {error.line}: </span> : null}
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
                    className="flex-shrink-0 overflow-hidden border-r border-white/8 bg-transparent text-right select-none"
                    style={{ width: "3.25rem" }}
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
                    id="latex-split-editor"
                    name="latexSplitEditor"
                    value={latexContent}
                    onChange={(event) => {
                      onLatexChange(event.target.value)
                      setPdfData(null)
                      setPreviewError(null)
                    }}
                    onScroll={handleEditorScroll}
                    placeholder="Paste or edit your LaTeX code here..."
                    spellCheck={false}
                    wrap="off"
                    aria-label="Split workspace LaTeX editor"
                    className="scrollbar-dark h-full min-w-0 flex-1 resize-none border-0 bg-transparent font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                    style={{ lineHeight: "1.25rem", padding: "0.5rem", overflow: "auto" }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="w-full min-w-0 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.16),rgba(3,7,18,0.06))] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm flex min-h-0 flex-col overflow-hidden sm:rounded-[28px] sm:p-5 lg:p-6">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="flex-shrink-0 border-b border-white/8 bg-transparent px-4 py-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold text-muted-foreground">LIVE PDF PREVIEW</p>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">Live sync while you edit</div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => void handleDownloadPdf()}
                      disabled={!latexContent.trim() || isGenerating || isDownloadingPdf}
                      aria-label="Download PDF"
                      title="Download PDF"
                      className="h-8 w-8 rounded-full border-white/8 bg-transparent text-muted-foreground hover:bg-white/8 hover:text-foreground"
                    >
                      {isDownloadingPdf ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                {previewError ? (
                  <div className="flex h-full flex-col items-center justify-center p-4 text-muted-foreground">
                    <AlertTriangle className="mb-2 h-8 w-8 text-red-400" />
                    <p className="max-w-md text-center text-sm text-red-400">{previewError}</p>
                  </div>
                ) : (
                  <PDFViewer pdfData={pdfData} isLoading={isLoadingPreview} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
