import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aguardar aprovação",
}

export default function WaitingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
