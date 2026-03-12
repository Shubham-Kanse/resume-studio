"use client"

import { X } from "lucide-react"

type LegalDialogVariant = "privacy" | "terms"

interface LegalDialogProps {
  open: boolean
  variant: LegalDialogVariant
  onClose: () => void
}

const privacySections = [
  {
    title: "Effective Date",
    body: "This policy applies to the current version of Resume Studio and may be updated as the product, billing flows, or data processors change over time.",
  },
  {
    title: "Information We Process",
    body: "Resume Studio may process the information you provide in order to generate resumes, score resumes against job descriptions, and maintain your saved workspace history. This can include your Google account email, uploaded resume files, job descriptions, generated LaTeX output, ATS analysis results, and job tracker entries you choose to store.",
  },
  {
    title: "How Your Data Is Used",
    body: "The app uses your data only to provide the requested features, such as resume generation, ATS scoring, saved history, and job application tracking. If you do not sign in, core generation features can still work without attaching saved account history to your profile.",
  },
  {
    title: "Storage And Processors",
    body: "Account authentication and saved application data may be stored using Supabase. Billing is processed through Polar. Resume generation and ATS-related requests may be processed by third-party model providers used by the app. Uploaded and generated content is handled only to fulfill the features you invoke inside the product.",
  },
  {
    title: "Retention And Deletion",
    body: "You can remove saved history and job tracker entries from within the app. You can also request account deletion from the account settings flow. Local browser fallback data stays on the device and browser where it was created. Cloud-saved records remain available until you delete them or the service removes them according to future policy updates.",
  },
  {
    title: "Security",
    body: "Reasonable technical measures are used to protect stored data, but no online service can guarantee absolute security. You should avoid uploading material you are not permitted to share or highly sensitive information unless you are comfortable with that risk.",
  },
  {
    title: "Contact And Requests",
    body: "If you need support, billing help, or privacy-related assistance, use the contact method provided with the Resume Studio service or the support channel listed where the product is offered.",
  },
]

const termsSections = [
  {
    title: "Effective Date",
    body: "These terms apply to the current Resume Studio service and may be revised as the product, billing terms, or supported features change.",
  },
  {
    title: "Use Of The Service",
    body: "You may use Resume Studio only for lawful purposes and only with content you have the right to upload, analyze, store, or transform. You are responsible for the accuracy and legality of the information you submit.",
  },
  {
    title: "Accounts",
    body: "Some features are available without signing in, while saved history and job tracking may require an account. You are responsible for the activity associated with your account and for keeping access to it secure.",
  },
  {
    title: "Billing, Renewal, And Cancellation",
    body: "Paid features are managed through the billing provider shown at checkout. If you purchase a subscription, you authorize recurring charges according to the plan presented during checkout until you cancel. You can manage or cancel billing through the in-app billing portal, and changes generally take effect at the end of the current billing period unless the checkout terms state otherwise.",
  },
  {
    title: "Refunds",
    body: "Fees are generally non-refundable unless a refund is required by law or explicitly offered at the time of purchase. Promotional pricing, taxes, and billing terms shown during checkout control if they differ from general product messaging.",
  },
  {
    title: "AI-Generated Output",
    body: "Resume suggestions, LaTeX output, ATS feedback, and other generated results are provided for informational assistance only. They may be incomplete, inaccurate, or unsuitable for a specific application and should be reviewed before use.",
  },
  {
    title: "Uploaded Materials",
    body: "You retain responsibility for your resumes, job descriptions, and other uploaded files. By using the service, you authorize Resume Studio to process that material solely for delivering the app features you request.",
  },
  {
    title: "Availability And Changes",
    body: "The service may change, improve, pause, or remove features at any time. Access may be limited temporarily for maintenance, security, or reliability reasons.",
  },
  {
    title: "Disclaimer",
    body: "Resume Studio is provided on an as-is and as-available basis, without guarantees of uninterrupted operation, perfect accuracy, or suitability for any specific hiring outcome.",
  },
  {
    title: "Contact",
    body: "For support or billing questions, use the contact method provided with the Resume Studio service or the support channel listed where the product is offered.",
  },
]

export function LegalDialog({ open, variant, onClose }: LegalDialogProps) {
  if (!open) return null

  const isPrivacy = variant === "privacy"
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service"
  const description = isPrivacy
    ? "How Resume Studio processes, stores, and protects data used inside the app."
    : "The terms that govern access to Resume Studio and its resume, ATS, dashboard, and tracker features."
  const sections = isPrivacy ? privacySections : termsSections

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[6px]">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,24,0.1),rgba(3,7,18,0.03))] p-6 shadow-[0_18px_56px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">
              Legal
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-dark mt-6 max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/8 bg-black/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <h3 className="text-sm font-medium text-foreground">
                {section.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
