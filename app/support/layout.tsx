import type { Metadata } from "next";
import { SupportLayout } from "@/components/layout/support-layout";

export const metadata: Metadata = {
  title: "Support",
};

export default function SupportRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SupportLayout>{children}</SupportLayout>;
}
