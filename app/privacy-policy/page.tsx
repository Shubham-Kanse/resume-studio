import Link from "next/link"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Resume Studio",
  description: "Privacy Policy for Resume Studio.",
}

export const dynamic = "force-static"
export const revalidate = 86_400

const sectionClassName =
  "rounded-2xl border border-white/8 bg-black/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh bg-[#030712] px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/35">
              Legal
            </p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              This page explains what information Resume Studio processes, how
              it is used, and how it is protected inside the app experience.
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
          <h2 className="text-lg font-medium">Information We Process</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Resume Studio may process the information you provide in order to
            generate resumes, score resumes against job descriptions, and
            maintain your saved workspace history. This can include your Google
            account email, uploaded resume files, job descriptions, generated
            LaTeX output, ATS analysis results, and job tracker entries you
            choose to store.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">How Your Data Is Used</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The app uses your data only to provide the requested features, such
            as resume generation, ATS scoring, saved history, and job
            application tracking. If you do not sign in, core generation
            features can still work without attaching saved account history to
            your profile.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Storage And Processors</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Account authentication and saved application data may be stored
            using Supabase. Resume generation and ATS-related requests may be
            processed by third-party model providers used by the app. Uploaded
            and generated content is handled only to fulfill the features you
            invoke inside the product.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Retention And Deletion</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You can remove saved history and job tracker entries from within the
            app. Local browser fallback data stays on the device and browser
            where it was created. Cloud-saved records remain available until you
            delete them or the service removes them according to future policy
            updates.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Security</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Reasonable technical measures are used to protect stored data, but
            no online service can guarantee absolute security. You should avoid
            uploading material you are not permitted to share or highly
            sensitive information unless you are comfortable with that risk.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className="text-lg font-medium">Updates</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This policy may be updated as the app changes. Continued use of
            Resume Studio after an update means the revised policy applies going
            forward.
          </p>
        </section>
      </div>
    </main>
  )
}
