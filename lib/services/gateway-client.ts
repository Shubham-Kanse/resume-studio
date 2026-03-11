import {
  accountServiceClient,
  billingServiceClient,
  ServiceClientError,
} from "@/features/subscription/client/service-client"
import { getCsrfHeaders } from "@/lib/csrf-client"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import { serviceContracts } from "@/lib/services/contracts"
import type { ExtractResumeResponse, GenerateResumeResponse } from "@/types/api"
import type { ATSScoreResponse } from "@/types/ats"

interface JsonRequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null
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

function withAuthHeaders(
  headers: HeadersInit | undefined,
  accessToken?: string
) {
  const nextHeaders = getCsrfHeaders(headers)

  if (!accessToken) return nextHeaders

  return {
    ...(nextHeaders || {}),
    Authorization: `Bearer ${accessToken}`,
  }
}

export const resumeServiceClient = {
  async generate(formData: FormData, accessToken?: string) {
    const response = await request(serviceContracts.resume.generate, {
      method: "POST",
      headers: withAuthHeaders(undefined, accessToken),
      body: formData,
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "Failed to generate resume"
      )
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<GenerateResumeResponse>
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

  async insights(
    payload: {
      jobDescription: string
      resumeContent: string
      extractionArtifacts?: DocumentArtifacts | null
    },
    accessToken?: string
  ) {
    const response = await request(serviceContracts.ats.insights, {
      method: "POST",
      headers: withAuthHeaders(
        { "Content-Type": "application/json" },
        accessToken
      ),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "Failed to load AI insights"
      )
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

    return (await response.json()) as ExtractResumeResponse
  },

  async compileLatex(payload: { latex: string; preview: boolean }) {
    const response = await request(serviceContracts.document.latexToPdf, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "LaTeX compilation failed."
      )
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response
  },
}

export { ServiceClientError, accountServiceClient, billingServiceClient }
