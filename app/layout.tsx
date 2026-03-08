import type React from "react"
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
  return (
    <html lang="en" className="dark h-full">
      <body className="font-sans antialiased h-full">
        {children}
      </body>
    </html>
  )
}
