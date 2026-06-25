import type { Metadata } from "next";
import { ProfileEditor } from "@/components/profile/profile-editor";

export const metadata: Metadata = {
  title: "Perfil",
};

export default function SchoolAdminPerfilPage() {
  return <ProfileEditor />;
}
