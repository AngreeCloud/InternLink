import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Protocolos",
}

export default function ProtocolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
