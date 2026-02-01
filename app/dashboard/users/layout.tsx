import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Utilizadores",
}

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
