import { track } from "@vercel/analytics"

type AnalyticsValue = boolean | number | string | null | undefined

export function trackEvent(
  name: string,
  properties?: Record<string, AnalyticsValue>
) {
  if (typeof window === "undefined") {
    return
  }

  try {
    track(name, properties)
  } catch {
    // Analytics should never break product flows.
  }
}
