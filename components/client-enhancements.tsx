"use client"

import { useEffect, useState } from "react"

import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

import { ClientRuntimeGuard } from "@/components/client-runtime-guard"
import { RuntimePrimer } from "@/components/runtime-primer"

function scheduleEnhancements(callback: () => void) {
  if (typeof window === "undefined") {
    return
  }

  if ("requestIdleCallback" in window) {
    const idleCallbackId = window.requestIdleCallback(() => {
      callback()
    })

    return () => window.cancelIdleCallback(idleCallbackId)
  }

  const timeoutId = globalThis.setTimeout(callback, 250)
  return () => globalThis.clearTimeout(timeoutId)
}

export function ClientEnhancements() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const cancel = scheduleEnhancements(() => {
      setEnabled(true)
    })

    return () => cancel?.()
  }, [])

  if (!enabled) {
    return null
  }

  return (
    <>
      <ClientRuntimeGuard />
      <RuntimePrimer />
      <Analytics />
      <SpeedInsights />
    </>
  )
}
