"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { getUserFacingMessage } from "@/lib/errors"
import { reportClientError } from "@/lib/error-monitoring"

interface PDFViewerProps {
  pdfData: ArrayBuffer | null
  isLoading?: boolean
}

interface PromiseWithResolvers<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

function ensurePromiseWithResolvers() {
  const promiseCtor = Promise as unknown as PromiseConstructor & {
    withResolvers?: <T>() => PromiseWithResolvers<T>
  }

  if (typeof promiseCtor.withResolvers === "function") {
    return
  }

  promiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void

    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    return { promise, resolve, reject }
  }
}

interface PDFPageCanvasProps {
  containerWidth: number
  renderScale: number
  pageNumber: number
  pdfDocument: any
  onRenderError: (message: string) => void
}

function getPreferredPdfRenderScale() {
  if (typeof navigator === "undefined") return 1.25

  const memory = "deviceMemory" in navigator ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0 : 0
  const cores = navigator.hardwareConcurrency || 4

  if ((memory > 0 && memory <= 4) || cores <= 4) return 1
  if ((memory > 0 && memory <= 8) || cores <= 8) return 1.2
  return 1.4
}

function PDFPageCanvas({
  containerWidth,
  renderScale,
  pageNumber,
  pdfDocument,
  onRenderError,
}: PDFPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPageRendering, setIsPageRendering] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !containerWidth) return

    let cancelled = false
    let currentPage: any = null
    let renderTask: { promise: Promise<void>; cancel?: () => void } | null = null

    const renderPage = async () => {
      try {
        setIsPageRendering(true)
        const page = await pdfDocument.getPage(pageNumber)
        if (cancelled) {
          page.cleanup?.()
          return
        }

        currentPage = page
        const baseViewport = page.getViewport({ scale: 1 })
        const scale = Math.max(containerWidth / baseViewport.width, 0.1)
        const viewport = page.getViewport({ scale })
        const outputScale = Math.min(window.devicePixelRatio || 1, renderScale)
        const context = canvas.getContext("2d", { alpha: false })

        if (!context) {
          throw new Error(`Canvas context unavailable for page ${pageNumber}.`)
        }

        canvas.width = Math.ceil(viewport.width * outputScale)
        canvas.height = Math.ceil(viewport.height * outputScale)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)

        const nextRenderTask = page.render({
          canvasContext: context,
          viewport,
          transform:
            outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          background: "rgb(255,255,255)",
        })
        renderTask = nextRenderTask

        await nextRenderTask.promise
        if (cancelled) return

        setIsPageRendering(false)
      } catch (error) {
        if (cancelled) return
        setIsPageRendering(false)
        reportClientError(error, `pdf-render-page-${pageNumber}`)
        console.error(`PDF render error on page ${pageNumber}:`, error)
        onRenderError(getUserFacingMessage(error, `Failed to render page ${pageNumber}.`))
      }
    }

    void renderPage()

    return () => {
      cancelled = true
      renderTask?.cancel?.()
      currentPage?.cleanup?.()
    }
  }, [containerWidth, onRenderError, pageNumber, pdfDocument, renderScale])

  return (
    <div className="relative rounded-[6px] bg-white shadow-[0_18px_56px_rgba(0,0,0,0.28)]">
      {isPageRendering ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-white/70">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : null}
      <canvas ref={canvasRef} className="block max-w-full rounded-[6px]" />
    </div>
  )
}

export function PDFViewer({ pdfData, isLoading }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfjsLibRef = useRef<any>(null)
  const loadingTaskRef = useRef<{ destroy: () => void } | null>(null)
  const pdfDocumentRef = useRef<any>(null)

  const [containerWidth, setContainerWidth] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [isDocumentLoading, setIsDocumentLoading] = useState(false)
  const [renderScale, setRenderScale] = useState(1.25)

  useEffect(() => {
    let cancelled = false

    const initializePdfJs = async () => {
      ensurePromiseWithResolvers()
      const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as any
      if (cancelled) return

      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString()
      pdfjsLibRef.current = pdfjsLib
      setRenderScale(getPreferredPdfRenderScale())
      setViewerReady(true)
    }

    void initializePdfJs().catch((error: unknown) => {
      if (cancelled) return
      reportClientError(error, "pdf-viewer-init")
      console.error("PDF viewer init error:", error)
      setRenderError(getUserFacingMessage(error, "Failed to initialize PDF preview."))
    })

    return () => {
      cancelled = true
      loadingTaskRef.current?.destroy()
      void pdfDocumentRef.current?.destroy?.()
      pdfjsLibRef.current = null
      pdfDocumentRef.current = null
    }
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateWidth = () => {
      setContainerWidth(Math.max(element.clientWidth - 24, 200))
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [pdfData, pdfDocument])

  useEffect(() => {
    const pdfjsLib = pdfjsLibRef.current

    loadingTaskRef.current?.destroy()
    loadingTaskRef.current = null
    void pdfDocumentRef.current?.destroy?.()
    pdfDocumentRef.current = null
    setPdfDocument(null)

    if (!viewerReady || !pdfjsLib) return

    if (!pdfData) {
      setPageCount(0)
      setRenderError(null)
      setIsDocumentLoading(false)
      return
    }

    const bytes = new Uint8Array(pdfData)
    const header = String.fromCharCode(...bytes.slice(0, 4))

    if (header !== "%PDF") {
      setPageCount(0)
      setRenderError("Invalid PDF received.")
      setIsDocumentLoading(false)
      return
    }

    let cancelled = false
    setIsDocumentLoading(true)
    setRenderError(null)

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfData.slice(0)),
      disableWorker: false,
      useWorkerFetch: false,
      isEvalSupported: false,
      isOffscreenCanvasSupported: false,
    })

    loadingTaskRef.current = loadingTask

    void loadingTask.promise
      .then((nextPdfDocument: any) => {
        if (cancelled) {
          void nextPdfDocument.destroy?.()
          return
        }

        pdfDocumentRef.current = nextPdfDocument
        setPdfDocument(nextPdfDocument)
        setPageCount(nextPdfDocument.numPages)
        setIsDocumentLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        reportClientError(error, "pdf-load")
        console.error("PDF load error:", error)
        setPdfDocument(null)
        setPageCount(0)
        setIsDocumentLoading(false)
        setRenderError(getUserFacingMessage(error, "Failed to load PDF preview."))
      })

    return () => {
      cancelled = true
      loadingTask.destroy()
    }
  }, [pdfData, viewerReady])

  const handleRenderError = useCallback((message: string) => {
    setRenderError(message)
  }, [])

  if (isLoading || isDocumentLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Compiling live preview...</p>
      </div>
    )
  }

  if (renderError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-sm text-red-400">{renderError}</p>
      </div>
    )
  }

  if (!pdfData || !pdfDocument || pageCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-sm text-muted-foreground">No PDF preview yet</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div
        ref={containerRef}
        className="scrollbar-dark min-h-0 flex-1 overflow-auto p-3"
      >
        <div className="flex min-h-full flex-col items-center gap-4 pb-3">
          {Array.from({ length: pageCount }, (_, index) => (
            <PDFPageCanvas
              key={`${index + 1}-${containerWidth}`}
              containerWidth={containerWidth}
              renderScale={renderScale}
              pageNumber={index + 1}
              pdfDocument={pdfDocument}
              onRenderError={handleRenderError}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
