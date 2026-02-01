import type { Metadata } from "next";
import { SchoolAdminLayout } from "@/components/layout/school-admin-layout";

export const metadata: Metadata = {
  title: "Admin Escolar",
};

export default function SchoolAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SchoolAdminLayout>{children}</SchoolAdminLayout>;
}
