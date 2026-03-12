"use client"

import { useEffect, useRef } from "react"

const PRIMER_TIMEOUT_MS = 1500
const REPRIME_INTERVAL_MS = 60_000
const PRIMER_ENDPOINTS = ["/api/health", "/api/account/plan"]

const MODULE_PRELOADERS = [
  () => import("@/components/auth-dialog"),
  () => import("@/features/subscription/components/plan-dialog"),
  () => import("@/components/ats-score-panel"),
  () => import("@/components/dashboard-panel"),
  () => import("@/components/job-applications-panel"),
  () => import("@/components/legal-dialog"),
]

function shouldReduceNetworkActivity() {
  if (typeof navigator === "undefined") {
    return false
  }

  const connection = (
    navigator as Navigator & {
      connection?: {
        saveData?: boolean
      }
    }
  ).connection

  return Boolean(connection?.saveData)
}

function primeUrl(url: string) {
  void fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    keepalive: true,
    headers: {
      "x-resume-studio-primer": "1",
    },
  }).catch(() => undefined)
}

function primeRuntime() {
  for (const endpoint of PRIMER_ENDPOINTS) {
    primeUrl(endpoint)
  }

  void Promise.allSettled(MODULE_PRELOADERS.map((preload) => preload()))
}

function schedulePrimer(callback: () => void) {
  if (typeof window === "undefined") {
    return
  }

  if ("requestIdleCallback" in window) {
    const idleCallbackId = window.requestIdleCallback(() => {
      callback()
    })

    return () => window.cancelIdleCallback(idleCallbackId)
  }

  const timeoutId = globalThis.setTimeout(callback, PRIMER_TIMEOUT_MS)
  return () => globalThis.clearTimeout(timeoutId)
}

export function RuntimePrimer() {
  const lastPrimedAtRef = useRef(0)

  useEffect(() => {
    if (shouldReduceNetworkActivity()) {
      return
    }

    const runPrimer = () => {
      lastPrimedAtRef.current = Date.now()
      primeRuntime()
    }

    const cancel = schedulePrimer(runPrimer)

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return
      }

      if (Date.now() - lastPrimedAtRef.current < REPRIME_INTERVAL_MS) {
        return
      }

      runPrimer()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancel?.()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}
