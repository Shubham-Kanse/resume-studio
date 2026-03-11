"use client"

import { useEffect, useState } from "react"

import {
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Trash2,
  X,
} from "lucide-react"

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
  onEmailSignIn: (email: string, password: string) => Promise<void>
  onEmailSignUp: (input: {
    firstName: string
    lastName: string
    email: string
    password: string
  }) => Promise<boolean>
  onExportData: () => Promise<void>
  onDeleteAccount: (confirmation: string) => Promise<void>
}

type EmailAuthMode = "signin" | "signup"

function PasswordRequirement({ label, met }: { label: string; met: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs transition-colors",
        met ? "text-emerald-300" : "text-muted-foreground"
      )}
    >
      {met ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      <span>{label}</span>
    </div>
  )
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
  onEmailSignIn,
  onEmailSignUp,
  onExportData,
  onDeleteAccount,
}: AuthDialogProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("signin")
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (!open) {
      setDeleteConfirmation("")
      setEmailAuthMode("signin")
      setPendingConfirmationEmail(null)
      setFirstName("")
      setLastName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    }
  }, [open])

  if (!open) return null

  const passwordChecks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
  const isStrongPassword = Object.values(passwordChecks).every(Boolean)

  const isEmailAuthDisabled =
    authLoading ||
    !email.trim() ||
    !password ||
    (emailAuthMode === "signup" &&
      (!firstName.trim() ||
        !lastName.trim() ||
        !isStrongPassword ||
        password !== confirmPassword))

  const handleEmailSubmit = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) return

    if (emailAuthMode === "signup") {
      const trimmedFirstName = firstName.trim()
      const trimmedLastName = lastName.trim()
      if (
        !trimmedFirstName ||
        !trimmedLastName ||
        !isStrongPassword ||
        password !== confirmPassword
      ) {
        return
      }
      const didCreateAccount = await onEmailSignUp({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        password,
      })
      if (!didCreateAccount) return
      setPendingConfirmationEmail(trimmedEmail)
      setEmailAuthMode("signin")
      setPassword("")
      setConfirmPassword("")
      return
    }

    await onEmailSignIn(trimmedEmail, password)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[6px]">
      <div className="w-full max-w-md rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.1),rgba(3,7,18,0.03))] p-6 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">
              Account
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              {userEmail ? "You are signed in" : "Sign in or create an account"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {userEmail
                ? "Your generated resumes and ATS scores can now be saved to your account automatically."
                : "Use email and password or Google to save resume history, ATS scans, and billing access to your account."}
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
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
              <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setEmailAuthMode("signin")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    emailAuthMode === "signin"
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:text-white"
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setEmailAuthMode("signup")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    emailAuthMode === "signup"
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:text-white"
                  )}
                >
                  Create account
                </button>
              </div>

              {pendingConfirmationEmail ? (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  Check{" "}
                  <span className="font-medium">
                    {pendingConfirmationEmail}
                  </span>{" "}
                  for your confirmation email. After confirming, come back here
                  and sign in with your email and password.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {emailAuthMode === "signup" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      placeholder="First name"
                      autoComplete="given-name"
                      spellCheck={false}
                    />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      placeholder="Last name"
                      autoComplete="family-name"
                      spellCheck={false}
                    />
                  </div>
                ) : null}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="Email address"
                  autoComplete="email"
                  spellCheck={false}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="Password"
                  autoComplete={
                    emailAuthMode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                />
                {emailAuthMode === "signup" ? (
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />
                ) : null}
                {emailAuthMode === "signup" ? (
                  <div className="rounded-xl border border-white/10 bg-black/18 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <PasswordRequirement
                        label="8+ characters"
                        met={passwordChecks.minLength}
                      />
                      <PasswordRequirement
                        label="Uppercase letter"
                        met={passwordChecks.uppercase}
                      />
                      <PasswordRequirement
                        label="Lowercase letter"
                        met={passwordChecks.lowercase}
                      />
                      <PasswordRequirement
                        label="Digit"
                        met={passwordChecks.digit}
                      />
                      <PasswordRequirement
                        label="Symbol"
                        met={passwordChecks.symbol}
                      />
                      <PasswordRequirement
                        label="Passwords match"
                        met={Boolean(password) && password === confirmPassword}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      After creating your account, you will need to confirm your
                      email before signing in.
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center rounded-2xl border-white/8 bg-black/12 py-6 text-sm hover:bg-white/8"
                  onClick={() => void handleEmailSubmit()}
                  disabled={isEmailAuthDisabled}
                >
                  {authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {emailAuthMode === "signup"
                    ? "Create account with email"
                    : "Sign in with email"}
                </Button>
                {emailAuthMode === "signin" ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Already confirmed your email? Sign in here with the same
                    email and password you used during sign-up.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/35">
              <span className="h-px flex-1 bg-white/10" />
              Or
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center rounded-2xl border-white/8 bg-black/12 py-6 text-sm hover:bg-white/8"
              onClick={onGoogleAuth}
              disabled={authLoading}
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleMark />
              )}
              Continue with Google
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
            to enable Supabase email/password and Google login.
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
