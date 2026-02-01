import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Estado da conta",
}

export default function AccountStatusLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
