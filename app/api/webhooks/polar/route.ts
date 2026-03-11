import { NextRequest } from "next/server"

import { Webhooks } from "@polar-sh/nextjs"

import { syncSubscriptionFromPolarCustomerState } from "@/features/subscription/server/polar-service"
import { reportServerError } from "@/lib/error-monitoring"
import { getPolarWebhookSecret } from "@/lib/polar"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const handler = Webhooks({
    webhookSecret: getPolarWebhookSecret(),
    onCustomerStateChanged: async (payload) => {
      try {
        await syncSubscriptionFromPolarCustomerState(payload.data)
      } catch (error) {
        reportServerError(error, "polar-webhook-customer-state")
        throw error
      }
    },
  })

  return handler(request)
}
