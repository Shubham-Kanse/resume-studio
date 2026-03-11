"use client"

import { useCallback } from "react"

import { documentServiceClient } from "@/lib/services/gateway-client"
import type { ExtractResumeResponse } from "@/types/api"

export function useDocumentActions() {
  const extractResume = useCallback(
    async (file: File): Promise<ExtractResumeResponse> => {
      return documentServiceClient.extractResume(file)
    },
    []
  )

  const compilePreviewPdf = useCallback(async (latex: string) => {
    const response = await documentServiceClient.compileLatex({
      latex,
      preview: true,
    })

    return response.arrayBuffer()
  }, [])

  const compilePdfDownload = useCallback(async (latex: string) => {
    const response = await documentServiceClient.compileLatex({
      latex,
      preview: false,
    })

    return response.blob()
  }, [])

  return {
    extractResume,
    compilePreviewPdf,
    compilePdfDownload,
  }
}
