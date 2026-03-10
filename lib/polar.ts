import { Polar } from "@polar-sh/sdk"
import { AppError } from "@/lib/errors"

export const BILLING_PROVIDER = {
  POLAR: "polar",
} as const

export type BillingProvider = (typeof BILLING_PROVIDER)[keyof typeof BILLING_PROVIDER]

export const POLAR_SERVER = {
  SANDBOX: "sandbox",
  PRODUCTION: "production",
} as const

export type PolarServer = (typeof POLAR_SERVER)[keyof typeof POLAR_SERVER]

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new AppError(`${name} is not configured.`, {
      code: "CONFIGURATION_ERROR",
      status: 500,
      userMessage: "Billing is not configured yet.",
      context: "polar-config",
    })
  }

  return value
}

export function getPolarServer(): PolarServer {
  return process.env.POLAR_SERVER === POLAR_SERVER.SANDBOX ? POLAR_SERVER.SANDBOX : POLAR_SERVER.PRODUCTION
}

export function getPolarAccessToken() {
  return requireEnv("POLAR_ACCESS_TOKEN")
}

export function getPolarWebhookSecret() {
  return requireEnv("POLAR_WEBHOOK_SECRET")
}

export function getPolarProProductId() {
  return requireEnv("POLAR_PRO_PRODUCT_ID")
}

export function createPolarClient() {
  return new Polar({
    accessToken: getPolarAccessToken(),
    server: getPolarServer(),
  })
}
