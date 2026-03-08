"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs"

interface PDFViewerProps {
  pdfData: ArrayBuffer | null
  isLoading?: boolean
}

export function PDFViewer({ pdfData, isLoading }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const renderRequestRef = useRef(0)

  useEffect(() => {
    if (!pdfData) {
      setPdfDoc(null)
      setTotalPages(0)
      setCurrentPage(1)
      setRenderError(null)
      return
    }

    const loadPDF = async () => {
      try {
        setRenderError(null)

        const bytes = new Uint8Array(pdfData)
        const header = String.fromCharCode(...bytes.slice(0, 4))

        if (header !== "%PDF") {
          setRenderError("Invalid PDF received.")
          return
        }

        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise

        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
      } catch (error) {
        console.error("PDF load error:", error)
        setRenderError(
          error instanceof Error ? error.message : "Failed to load PDF."
        )
      }
    }

    loadPDF()
  }, [pdfData])

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return

    const requestId = ++renderRequestRef.current
    setIsRendering(true)

    try {
      const page = await pdfDoc.getPage(currentPage)
      
      if (requestId !== renderRequestRef.current) return
      
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (!context) return

      context.clearRect(0, 0, canvas.width, canvas.height)

      const baseViewport = page.getViewport({ scale: 1 })
      const containerWidth = Math.max(containerRef.current.clientWidth - 32, 320)
      const fitScale = containerWidth / baseViewport.width
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: fitScale * dpr })

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`

      context.scale(dpr, dpr)

      await page.render({
        canvasContext: context,
        viewport: page.getViewport({ scale: fitScale }),
      }).promise
    } catch (error) {
      console.error("PDF render error:", error)
      setRenderError("Failed to render PDF page.")
    } finally {
      if (requestId === renderRequestRef.current) {
        setIsRendering(false)
      }
    }
  }, [pdfDoc, currentPage])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-sm">Compiling live preview...</p>
      </div>
    )
  }

  if (renderError) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-red-400 text-center">{renderError}</p>
      </div>
    )
  }

  if (!pdfData) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground text-center">
          No PDF preview yet
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center px-3 py-2 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="p-1 hover:bg-white/10 rounded disabled:opacity-50"
              aria-label="Previous PDF page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs text-muted-foreground">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={nextPage}
              disabled={currentPage >= totalPages}
              className="p-1 hover:bg-white/10 rounded disabled:opacity-50"
              aria-label="Next PDF page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-neutral-800 p-4"
      >
        <div className="flex justify-center items-start min-h-full">
          <div className="relative inline-block">
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            <canvas ref={canvasRef} className="shadow-lg bg-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
