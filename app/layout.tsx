import type React from "react"

import { ClientEnhancements } from "@/components/client-enhancements"

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Resume Studio",
  description:
    "Generate tailored LaTeX resumes and review ATS performance from a single workspace.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null

  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="dns-prefetch" href="//api.groq.com" />
        <link rel="preconnect" href="https://api.groq.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//latex.ytotech.com" />
        <link
          rel="preconnect"
          href="https://latex.ytotech.com"
          crossOrigin=""
        />
        {supabaseUrl ? (
          <>
            <link rel="dns-prefetch" href={supabaseUrl} />
            <link rel="preconnect" href={supabaseUrl} crossOrigin="" />
          </>
        ) : null}
      </head>
      <body className="font-sans antialiased h-full">
        {children}
        <ClientEnhancements />
      </body>
    </html>
  )
}
