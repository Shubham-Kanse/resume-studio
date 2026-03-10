import type { ATSScoreResponse } from "@/lib/ats-types"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import { AppError, isRetryableStatus } from "@/lib/errors"
import { serviceContracts } from "@/lib/services/contracts"

interface JsonRequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null
}

export class ServiceClientError extends AppError {
  data: any

  constructor(message: string, status: number, data: any) {
    super(message, {
      status,
      code: status === 429 ? "RATE_LIMITED" : status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST",
      userMessage: message,
      retryable: isRetryableStatus(status),
      details: data && typeof data === "object" ? data : null,
    })
    this.name = "ServiceClientError"
    this.data = data
  }
}

async function parseErrorResponse(response: Response, fallback: string) {
  try {
    const errorData = await response.json()
    return {
      message: errorData?.details || errorData?.error || fallback,
      data: errorData,
    }
  } catch {
    return {
      message: fallback,
      data: null,
    }
  }
}

async function request(input: string, init: JsonRequestOptions) {
  return fetch(input, init)
}

export const resumeServiceClient = {
  async generate(formData: FormData) {
    const response = await request(serviceContracts.resume.generate, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Failed to generate resume")
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<{
      latex: string
      validation?: {
        repaired?: boolean
        pass?: boolean
        issues?: Array<{ message?: string; severity?: "high" | "medium" | "low" }>
        summary?: string
      }
    }>
  },
}

export const atsServiceClient = {
  async score(payload: {
    jobDescription: string
    resumeContent: string
    extractionArtifacts?: DocumentArtifacts | null
  }) {
    const response = await request(serviceContracts.ats.score, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Failed to score resume")
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<ATSScoreResponse>
  },

  async insights(payload: {
    jobDescription: string
    resumeContent: string
    extractionArtifacts?: DocumentArtifacts | null
  }) {
    const response = await request(serviceContracts.ats.insights, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Failed to load AI insights")
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<ATSScoreResponse>
  },
}

export const documentServiceClient = {
  async extractResume(file: File) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await request(serviceContracts.document.extractResume, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Extraction failed")
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return (await response.json()) as { text: string; artifacts?: DocumentArtifacts }
  },

  async compileLatex(payload: { latex: string; preview: boolean }) {
    const response = await request(serviceContracts.document.latexToPdf, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(response, "LaTeX compilation failed.")
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response
  },
}

export const accountServiceClient = {
  async exportAccount(accessToken: string) {
    const response = await request(serviceContracts.account.export, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Failed to export account data")
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.blob()
  },

  async deleteAccount(accessToken: string, confirmation: string) {
    const response = await request(serviceContracts.account.delete, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ confirmation }),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(response, "Failed to delete account")
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<{ success: true }>
  },
}
