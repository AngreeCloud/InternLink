import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Relatórios",
}

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
