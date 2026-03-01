import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { RecaptchaBadgeController } from "@/components/layout/recaptcha-badge-controller"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "InternLink",
    template: "InternLink - %s",
  },
  description: "Plataforma para gestão de estágios curriculares entre alunos, escolas e empresas",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <RecaptchaBadgeController />
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
