import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tutor",
};

export default function TutorRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
