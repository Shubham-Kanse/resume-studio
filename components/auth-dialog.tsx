"use client"

import { useEffect, useState } from "react"

import { Download, Loader2, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AuthDialogProps {
  open: boolean
  authAvailable: boolean
  authLoading: boolean
  authMessage: string | null
  userEmail: string | null
  isExportingData: boolean
  isDeletingAccount: boolean
  onClose: () => void
  onGoogleAuth: () => Promise<void>
  onExportData: () => Promise<void>
  onDeleteAccount: (confirmation: string) => Promise<void>
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M21.8 12.23c0-.76-.07-1.49-.19-2.2H12v4.16h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.6Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.08-.92 6.77-2.5l-3.3-2.56c-.92.62-2.1 1-3.47 1-2.67 0-4.94-1.8-5.75-4.21H2.84v2.64A9.99 9.99 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.25 13.73A6 6 0 0 1 5.93 12c0-.6.11-1.18.32-1.73V7.63H2.84a10 10 0 0 0 0 8.74l3.41-2.64Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.06c1.5 0 2.84.52 3.9 1.54l2.92-2.92C17.07 3.04 14.75 2 12 2a9.99 9.99 0 0 0-9.16 5.63l3.41 2.64C7.06 7.86 9.33 6.06 12 6.06Z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function AuthDialog({
  open,
  authAvailable,
  authLoading,
  authMessage,
  userEmail,
  isExportingData,
  isDeletingAccount,
  onClose,
  onGoogleAuth,
  onExportData,
  onDeleteAccount,
}: AuthDialogProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  useEffect(() => {
    if (!open) {
      setDeleteConfirmation("")
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[6px]">
      <div className="w-full max-w-md rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.1),rgba(3,7,18,0.03))] p-6 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">
              Account
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              {userEmail ? "You are signed in" : "Continue with Google"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {userEmail
                ? "Your generated resumes and ATS scores can now be saved to your account automatically."
                : "Use Google sign-in if you want to track resumes and scores. The app still works without creating an account."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close sign-in dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {userEmail ? (
          <>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-foreground">
              Signed in as <span className="font-medium">{userEmail}</span>
            </div>

            <div className="mt-4 grid gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center rounded-2xl border-white/8 bg-black/12 py-6 text-sm hover:bg-white/8"
                onClick={() => void onExportData()}
                disabled={isExportingData || isDeletingAccount}
              >
                {isExportingData ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export my data
              </Button>

              <div className="rounded-2xl border border-red-500/18 bg-red-500/8 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-red-200">
                  <Trash2 className="h-4 w-4" />
                  Delete account
                </div>
                <p className="mt-2 text-sm leading-6 text-red-100/75">
                  This permanently removes your account and deletes cloud-saved
                  history and job tracker data.
                </p>
                <div className="mt-3">
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(event) =>
                      setDeleteConfirmation(event.target.value.toUpperCase())
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    placeholder="Type DELETE to confirm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "mt-3 w-full justify-center rounded-2xl border-red-400/20 bg-red-500/10 py-6 text-sm text-red-100 hover:bg-red-500/16",
                    deleteConfirmation !== "DELETE" && "opacity-70"
                  )}
                  onClick={() => void onDeleteAccount(deleteConfirmation)}
                  disabled={
                    isDeletingAccount ||
                    isExportingData ||
                    deleteConfirmation !== "DELETE"
                  }
                >
                  {isDeletingAccount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Permanently delete account
                </Button>
              </div>
            </div>
          </>
        ) : authAvailable ? (
          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full justify-center rounded-2xl border-white/8 bg-black/12 py-6 text-sm hover:bg-white/8"
            onClick={onGoogleAuth}
            disabled={authLoading}
          >
            {authLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleMark />
            )}
            Sign in with Google
          </Button>
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
            to enable Google login.
          </div>
        )}

        {authMessage ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85">
            {authMessage}
          </div>
        ) : null}
      </div>
    </div>
  )
}
