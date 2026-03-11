import Link from "next/link"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service | Resume Studio",
  description: "Terms of Service for Resume Studio.",
}

export const dynamic = "force-static"
export const revalidate = 86_400

const sectionClassName =
  "rounded-2xl border border-white/8 bg-black/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"

export default function TermsOfServicePage() {
  return (
    <main className="min-h-dvh bg-[#030712] px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/35">
              Legal
            </p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Terms of Service
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              These terms govern access to and use of Resume Studio and its
              resume, ATS, dashboard, and job-tracking features.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
          >
            Back to app
          </Link>
        </div>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Use Of The Service</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You may use Resume Studio only for lawful purposes and only with
            content you have the right to upload, analyze, store, or transform.
            You are responsible for the accuracy and legality of the information
            you submit.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Accounts</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Some features are available without signing in, while saved history
            and job tracking may require an account. You are responsible for the
            activity associated with your account and for keeping access to it
            secure.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">AI-Generated Output</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Resume suggestions, LaTeX output, ATS feedback, and other generated
            results are provided for informational assistance only. They may be
            incomplete, inaccurate, or unsuitable for a specific application and
            should be reviewed before use.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Uploaded Materials</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You retain responsibility for your resumes, job descriptions, and
            other uploaded files. By using the service, you authorize Resume
            Studio to process that material solely for delivering the app
            features you request.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Availability And Changes</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The service may change, improve, pause, or remove features at any
            time. Access may be limited temporarily for maintenance, security,
            or reliability reasons.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Disclaimer</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Resume Studio is provided on an as-is and as-available basis,
            without guarantees of uninterrupted operation, perfect accuracy, or
            suitability for any specific hiring outcome.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Updates To These Terms</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            These terms may be updated over time. Continued use of the service
            after changes take effect means you accept the revised terms.
          </p>
        </section>
      </div>
    </main>
  )
}
