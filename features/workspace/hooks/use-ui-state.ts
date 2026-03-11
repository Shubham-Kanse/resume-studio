"use client"

import { useEffect, useState } from "react"

import type { PremiumFeature } from "@/features/subscription/types"
import {
  BACKGROUND_THEMES,
  type BackgroundTheme,
} from "@/features/workspace/background-themes"

export function useUIState() {
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [planHighlightFeature, setPlanHighlightFeature] =
    useState<PremiumFeature | null>(null)
  const [isBillingActionLoading, setIsBillingActionLoading] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [legalDialog, setLegalDialog] = useState<"privacy" | "terms" | null>(
    null
  )
  const [isSplitWorkspaceOpen, setIsSplitWorkspaceOpen] = useState(false)
  const [backgroundTheme, setBackgroundTheme] =
    useState<BackgroundTheme>("aurora")

  useEffect(() => {
    if (!authMessage) return

    const timer = window.setTimeout(() => setAuthMessage(null), 4500)
    return () => window.clearTimeout(timer)
  }, [authMessage])

  useEffect(() => {
    const storedTheme =
      typeof window !== "undefined"
        ? window.localStorage.getItem("resume-studio:background-theme")
        : null
    if (
      storedTheme &&
      BACKGROUND_THEMES.some((theme) => theme.id === storedTheme)
    ) {
      setBackgroundTheme(storedTheme as BackgroundTheme)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      "resume-studio:background-theme",
      backgroundTheme
    )
  }, [backgroundTheme])

  return {
    authMessage,
    setAuthMessage,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isPlanDialogOpen,
    setIsPlanDialogOpen,
    planHighlightFeature,
    setPlanHighlightFeature,
    isBillingActionLoading,
    setIsBillingActionLoading,
    isExportingData,
    setIsExportingData,
    isDeletingAccount,
    setIsDeletingAccount,
    legalDialog,
    setLegalDialog,
    isSplitWorkspaceOpen,
    setIsSplitWorkspaceOpen,
    backgroundTheme,
    setBackgroundTheme,
  }
}
