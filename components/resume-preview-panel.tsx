"use client"

import {
  Download,
  Copy,
  Check,
  Eye,
  Loader2,
  FileText,
  Share2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PDFViewer } from "@/components/pdf-viewer"
import { cn } from "@/lib/utils"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"

const AUTO_COMPILE_DELAY = 900
const MAX_LATEX_LENGTH = 100000

interface LaTeXError {
  type: "error" | "warning"
  message: string
  line?: number
}

function validateLaTeX(content: string): LaTeXError[] {
  const errors: LaTeXError[] = []
  if (!content.trim()) return errors

  const lines = content.split("\n")
  const hasDocumentClass = content.includes("\\documentclass")
  const hasBeginDocument = content.includes("\\begin{document}")
  const hasEndDocument = content.includes("\\end{document}")

  if (!hasDocumentClass) {
    errors.push({ type: "error", message: "Missing \\documentclass. Add: \\documentclass{article}", line: 1 })
  }
  if (hasBeginDocument && !hasEndDocument) {
    errors.push({ type: "error", message: "Missing \\end{document}. Add it at the end.", line: lines.findIndex(l => l.includes("\\begin{document}")) + 1 })
  }
  if (!hasBeginDocument && hasEndDocument) {
    errors.push({ type: "error", message: "Missing \\begin{document}. Add it before content.", line: lines.findIndex(l => l.includes("\\end{document}")) + 1 })
  }

  const envStack: Array<{name: string, line: number}> = []
  let braceCount = 0, bracketCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], lineNum = i + 1
    for (let j = 0; j < line.length; j++) {
      const char = line[j], prev = j > 0 ? line[j-1] : ''
      if (char === '{' && prev !== '\\') braceCount++
      if (char === '}' && prev !== '\\') braceCount--
      if (char === '[' && prev !== '\\') bracketCount++
      if (char === ']' && prev !== '\\') bracketCount--
      if (braceCount < 0) { errors.push({ type: "error", message: "Unmatched }. Remove or add {", line: lineNum }); braceCount = 0 }
      if (bracketCount < 0) { errors.push({ type: "error", message: "Unmatched ]. Remove or add [", line: lineNum }); bracketCount = 0 }
    }
    const beginMatch = line.match(/\\begin\{([^}]+)\}/)
    if (beginMatch) envStack.push({ name: beginMatch[1], line: lineNum })
    const endMatch = line.match(/\\end\{([^}]+)\}/)
    if (endMatch) {
      const envName = endMatch[1]
      if (envStack.length === 0) {
        errors.push({ type: "error", message: `Unmatched \\end{${envName}}. Add \\begin{${envName}} before.`, line: lineNum })
      } else {
        const last = envStack.pop()!
        if (last.name !== envName) errors.push({ type: "error", message: `\\begin{${last.name}} at line ${last.line} closed with \\end{${envName}}. Use \\end{${last.name}}.`, line: lineNum })
      }
    }
    if (line.includes('_') && !line.includes('\\_') && !line.match(/\$.*_.*\$/)) errors.push({ type: "warning", message: "Underscore outside math. Use \\_ or $ $", line: lineNum })
    if (line.includes('&') && !line.includes('\\&') && !line.match(/\\begin\{(tabular|array|align)/)) errors.push({ type: "warning", message: "Ampersand outside table. Use \\&", line: lineNum })
    if (line.includes('%') && !line.includes('\\%')) errors.push({ type: "warning", message: "Percent sign should be \\%", line: lineNum })
  }
  envStack.forEach(env => errors.push({ type: "error", message: `Unclosed \\begin{${env.name}} at line ${env.line}. Add \\end{${env.name}}`, line: env.line }))
  if (braceCount > 0) errors.push({ type: "error", message: `${braceCount} unclosed {. Add closing }` })
  if (bracketCount > 0) errors.push({ type: "error", message: `${bracketCount} unclosed [. Add closing ]` })
  return errors
}

interface ResumePreviewPanelProps {
  latexContent: string
  isGenerating: boolean
  statusMessage?: string
}

export function ResumePreviewPanel({
  latexContent,
  isGenerating,
  statusMessage,
}: ResumePreviewPanelProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "info">("edit")
  const [editableLatex, setEditableLatex] = useState<string>(latexContent)
  const [convertingToPDF, setConvertingToPDF] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const autoCompileTimerRef = useRef<NodeJS.Timeout | null>(null)

  const latexErrors = useMemo(() => validateLaTeX(editableLatex), [editableLatex])
  const hasErrors = latexErrors.some((e) => e.type === "error")
  const hasWarnings = latexErrors.some((e) => e.type === "warning")

  const lineNumbers = useMemo(() => {
    if (!editableLatex) return []
    const lineCount = (editableLatex.match(/\n/g) || []).length + 1
    return Array.from({ length: lineCount }, (_, i) => i + 1)
  }, [editableLatex])

  const errorLineNumbers = useMemo(() => {
    return new Set(latexErrors.filter(e => e.line).map(e => e.line!))
  }, [latexErrors])

  const handleEditorScroll = useCallback(() => {
    if (editorRef.current && lineNumbersRef.current) {
      const child = lineNumbersRef.current.firstElementChild as HTMLElement
      if (child) {
        child.style.transform = `translateY(-${editorRef.current.scrollTop}px)`
      }
    }
  }, [])

  useEffect(() => {
    if (latexContent) {
      setEditableLatex(latexContent)
      setPdfData(null)
      setPreviewError(null)
      setPdfError(null)
    }
  }, [latexContent])

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
        const response = await fetch("/api/latex-to-pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latex: content,
            preview: true,
          }),
        })

        if (!response.ok) {
          let message = "LaTeX compilation failed."

          try {
            const errorData = await response.json()
            message = errorData?.details || errorData?.error || message
          } catch {
            // ignore
          }

          throw new Error(message)
        }

        const arrayBuffer = await response.arrayBuffer()

        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error("Empty PDF returned.")
        }

        setPdfData(arrayBuffer)
      } catch (error) {
        setPdfData(null)
        setPreviewError(
          error instanceof Error ? error.message : "Failed to generate preview."
        )
      } finally {
        setIsLoadingPreview(false)
      }
    },
    []
  )

  useEffect(() => {
    if (activeTab !== "preview") return
    if (!editableLatex.trim()) {
      setPdfData(null)
      setPreviewError("No LaTeX content to preview.")
      return
    }

    if (editableLatex.length > MAX_LATEX_LENGTH) {
      setPreviewError("LaTeX content too large for preview.")
      return
    }

    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current)
    }

    autoCompileTimerRef.current = setTimeout(() => {
      compilePreview(editableLatex)
    }, AUTO_COMPILE_DELAY)

    return () => {
      if (autoCompileTimerRef.current) {
        clearTimeout(autoCompileTimerRef.current)
      }
    }
  }, [editableLatex, activeTab, compilePreview])

  const currentContent = editableLatex || latexContent

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

    const a = document.createElement("a")
    a.href = url
    a.download = "resume.tex"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const convertToPDF = async () => {
    if (!currentContent) return

    setConvertingToPDF(true)
    setPdfError(null)

    try {
      const response = await fetch("/api/latex-to-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latex: currentContent,
          preview: false,
        }),
      })

      if (!response.ok) {
        let message = "Failed to convert LaTeX to PDF."

        try {
          const errorData = await response.json()
          message = errorData?.details || errorData?.error || message
        } catch {
          // ignore
        }

        throw new Error(message)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = "resume.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? error.message
          : "Failed to convert to PDF. Please check your LaTeX syntax."
      )
    } finally {
      setConvertingToPDF(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Resume Output
          </h2>
          <p className="text-muted-foreground text-sm">
            View, edit, preview, and export your LaTeX resume
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 flex gap-2 mb-3 overflow-x-auto">
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
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()

              setActiveTab(key as "edit" | "preview" | "info")

              if (key === "preview") {
                const content = editableLatex || latexContent
                if (content.trim()) {
                  setTimeout(() => {
                    compilePreview(content)
                  }, 100)
                }
              }
            }}
            className={cn(
              "rounded-full px-4 whitespace-nowrap",
              activeTab === key
                ? "shadow-[0_10px_24px_rgba(34,197,94,0.24)]"
                : "border-white/8 bg-black/12 text-muted-foreground hover:bg-white/8 hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Button>
        ))}
      </div>

      <div className="flex-1 min-h-0 rounded-xl border border-white/8 bg-black/10 overflow-hidden">
        {isGenerating ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="text-base font-medium text-foreground">
              {statusMessage || "Generating your resume..."}
            </p>
            <p className="text-sm mt-1">This may take a few moments</p>
          </div>
        ) : activeTab === "edit" ? (
          <div className="h-full flex flex-col min-h-0 overflow-hidden">
            <div className="flex-shrink-0 border-b border-white/8 bg-black/12 px-4 py-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground font-semibold">
                  LATEX FORMAT CHECK
                </p>
                {editableLatex && (
                  <div className="flex items-center gap-2">
                    {hasErrors ? (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        {latexErrors.filter((e) => e.type === "error").length} error(s)
                      </span>
                    ) : hasWarnings ? (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <AlertTriangle className="w-3 h-3" />
                        {latexErrors.filter((e) => e.type === "warning").length} warning(s)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        Looks valid
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {latexErrors.length > 0 && (
              <div className="scrollbar-dark max-h-32 flex-shrink-0 overflow-y-auto border-b border-white/8 bg-black/10 px-4 py-2">
                <div className="space-y-1">
                  {latexErrors.map((err, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (err.line && editorRef.current) {
                          const lines = editableLatex.split('\n')
                          const lineStart = lines.slice(0, err.line - 1).join('\n').length + (err.line > 1 ? 1 : 0)
                          editorRef.current.focus()
                          editorRef.current.setSelectionRange(lineStart, lineStart + lines[err.line - 1].length)
                          editorRef.current.scrollTop = (err.line - 1) * 20 - 100
                        }
                      }}
                      className={`flex items-start gap-2 text-xs cursor-pointer hover:bg-white/8 p-1 rounded transition-colors ${err.type === "error" ? "text-red-400" : "text-yellow-400"
                        }`}
                    >
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>
                        {err.line && (
                          <span className="font-semibold">
                            Line {err.line}:{" "}
                          </span>
                        )}
                        {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 flex overflow-hidden">
              <div
                ref={lineNumbersRef}
                className="flex-shrink-0 overflow-hidden border-r border-white/8 bg-black/10 text-right select-none"
                style={{ width: "3rem" }}
              >
                <div style={{ paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                  {lineNumbers.map((n) => (
                    <div 
                      key={n} 
                      className={`text-xs pr-2 ${errorLineNumbers.has(n) ? 'text-red-400 font-bold' : 'text-muted-foreground/50'}`}
                      style={{ lineHeight: "1.25rem", height: "1.25rem" }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>

              <textarea
                ref={editorRef}
                id="latex-editor"
                name="latexEditor"
                value={editableLatex}
                onChange={(e) => {
                  setEditableLatex(e.target.value)
                  setPdfData(null)
                  setPreviewError(null)
                  setPdfError(null)
                }}
                onScroll={handleEditorScroll}
                placeholder="Paste or edit your LaTeX code here..."
                spellCheck={false}
                wrap="off"
                aria-label="LaTeX editor"
                className="scrollbar-dark flex-1 min-w-0 h-full resize-none border-0 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{ lineHeight: "1.25rem", padding: "0.5rem", overflow: "auto" }}
              />
            </div>
          </div>
        ) : activeTab === "preview" ? (
          <div className="h-full flex flex-col min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-white/8 bg-black/12 px-4 py-2">
              <p className="text-xs text-muted-foreground font-semibold">
                LIVE PDF PREVIEW
              </p>
              <div className="text-xs text-muted-foreground">
                Auto-updates after you stop typing
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {previewError ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
                  <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-sm text-red-400 text-center max-w-md">
                    {previewError}
                  </p>
                </div>
              ) : (
                <PDFViewer pdfData={pdfData} isLoading={isLoadingPreview} />
              )}
            </div>
          </div>
        ) : (
          <div className="scrollbar-dark h-full p-4 overflow-y-auto">
            <div className="space-y-3">
              <div className="rounded-lg border border-white/8 bg-black/10 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Quick Reference
                </h3>
                <div className="space-y-1.5 text-xs text-muted-foreground font-mono">
                  <div>{`\\textbf{bold text}`} → Bold</div>
                  <div>{`\\textit{italic text}`} → Italic</div>
                  <div>{`\\section{Experience}`} → Section</div>
                  <div>{`\\begin{itemize} ... \\end{itemize}`} → Bullet list</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {pdfError && (
        <div className="flex-shrink-0 mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{pdfError}</p>
        </div>
      )}

      <div className="flex-shrink-0 mt-4 flex gap-2 flex-wrap">
        <Button
          type="button"
          onClick={handleCopy}
          disabled={!currentContent || isGenerating}
          variant="outline"
          className="flex-1 rounded-2xl py-5"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
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
          <Download className="w-4 h-4" />
          Download .tex
        </Button>

        <Button
          type="button"
          onClick={convertToPDF}
          disabled={!currentContent || isGenerating || convertingToPDF}
          variant="cool"
          className="flex-1 rounded-2xl py-5 font-semibold shadow-[0_18px_40px_rgba(34,197,94,0.2)]"
        >
          {convertingToPDF ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Download PDF
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
