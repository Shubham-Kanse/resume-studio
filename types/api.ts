import type { PlanSnapshot } from "@/features/subscription/types"
import type { DocumentArtifacts } from "@/lib/document-artifacts"
import type { AppErrorCode } from "@/lib/errors"
import type { ATSScoreResponse } from "@/types/ats"

export interface ApiErrorResponse {
  success?: false
  error: string
  code?: AppErrorCode
  details?: string
  issues?: Array<{
    path: string
    message: string
  }>
  retryable?: boolean
}

export interface ApiOkResponse {
  ok: true
}

export interface BillingSessionResponse {
  url: string
}

export interface DeleteAccountResponse {
  success: true
}

export interface ExtractResumeResponse {
  text: string
  artifacts?: DocumentArtifacts
}

export interface ResumeValidationIssue {
  type?:
    | "latex_error"
    | "format_violation"
    | "unsupported_claim"
    | "keyword_alignment"
    | "other"
  message?: string
  severity?: "high" | "medium" | "low"
}

export interface GenerateResumeResponse {
  latex: string
  validation?: {
    repaired?: boolean
    pass?: boolean
    issues?: ResumeValidationIssue[]
    summary?: string
  }
}

export interface PlanResponse extends PlanSnapshot {}

export interface AtsScoreApiResponse extends ATSScoreResponse {}
