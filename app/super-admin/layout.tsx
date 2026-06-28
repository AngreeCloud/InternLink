import type { Metadata } from "next";
import { SuperAdminLayout } from "@/components/layout/super-admin-layout";

export const metadata: Metadata = {
  title: "Super Admin",
};

export default function SuperAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}
