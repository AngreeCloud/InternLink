import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Professor",
};

export default function ProfessorRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
