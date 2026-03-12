import { getCsrfHeaders } from "@/lib/csrf-client"
import { AppError, isRetryableStatus } from "@/lib/errors"
import { serviceContracts } from "@/lib/services/contracts"
import type {
  BillingSessionResponse,
  DeleteAccountResponse,
  PlanResponse,
} from "@/types/api"

interface JsonRequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null
}

export class ServiceClientError extends AppError {
  data: Record<string, unknown> | null

  constructor(
    message: string,
    status: number,
    data: Record<string, unknown> | null
  ) {
    super(message, {
      status,
      code:
        status === 429
          ? "RATE_LIMITED"
          : status >= 500
            ? "UPSTREAM_ERROR"
            : "BAD_REQUEST",
      userMessage: message,
      retryable: isRetryableStatus(status),
      details: data && typeof data === "object" ? data : null,
    })
    this.name = "ServiceClientError"
    this.data = data
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null
}

async function parseErrorResponse(response: Response, fallback: string) {
  try {
    const errorData = toRecord(await response.json())
    return {
      message:
        (typeof errorData?.details === "string" && errorData.details) ||
        (typeof errorData?.error === "string" && errorData.error) ||
        fallback,
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

export const accountServiceClient = {
  async getPlan(accessToken?: string) {
    const response = await request(serviceContracts.account.plan, {
      method: "GET",
      headers: withAuthHeaders(undefined, accessToken),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "Failed to load subscription plan"
      )
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<PlanResponse>
  },

  async exportAccount(accessToken: string) {
    const response = await request(serviceContracts.account.export, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "Failed to export account data"
      )
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.blob()
  },

  async deleteAccount(accessToken: string, confirmation: string) {
    const response = await request(serviceContracts.account.delete, {
      method: "DELETE",
      headers: withAuthHeaders(
        { "Content-Type": "application/json" },
        accessToken
      ),
      body: JSON.stringify({ confirmation }),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "Failed to delete account"
      )
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<DeleteAccountResponse>
  },
}

export const billingServiceClient = {
  async createCheckoutSession(accessToken: string) {
    const response = await request(serviceContracts.billing.checkout, {
      method: "POST",
      headers: withAuthHeaders(
        { "Content-Type": "application/json" },
        accessToken
      ),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "Failed to start checkout"
      )
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<BillingSessionResponse>
  },

  async createCustomerPortalSession(accessToken: string) {
    const response = await request(serviceContracts.billing.portal, {
      method: "POST",
      headers: withAuthHeaders(
        { "Content-Type": "application/json" },
        accessToken
      ),
    })

    if (!response.ok) {
      const error = await parseErrorResponse(
        response,
        "Failed to open billing portal"
      )
      throw new ServiceClientError(error.message, response.status, error.data)
    }

    return response.json() as Promise<BillingSessionResponse>
  },
}
