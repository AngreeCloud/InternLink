import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Relatório",
}

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
