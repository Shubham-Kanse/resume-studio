import type React from "react"

import { ClientEnhancements } from "@/components/client-enhancements"
import {
  THEME_COLORS,
  THEME_COLOR_STORAGE_KEY,
} from "@/features/workspace/theme-colors"

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
  const themeColorInitializer = `(function(){try{var key=${JSON.stringify(
    THEME_COLOR_STORAGE_KEY
  )};var allowed=${JSON.stringify(
    THEME_COLORS.map((theme) => theme.id)
  )};var stored=window.localStorage.getItem(key);var fallback="green";var selected=allowed.indexOf(stored)>=0?stored:fallback;document.documentElement.setAttribute("data-theme-color",selected);}catch(_error){document.documentElement.setAttribute("data-theme-color","green");}})();`

  return (
    <html
      lang="en"
      className="dark h-full"
      data-theme-color="green"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeColorInitializer }} />
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
