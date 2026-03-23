import { SchoolAdminLayout } from "@/components/layout/school-admin-layout";
import { SchoolAdminChatHub } from "@/components/school-admin/school-admin-chat-hub";

export default function SchoolAdminChatPage() {
  return (
    <SchoolAdminLayout>
      <SchoolAdminChatHub />
    </SchoolAdminLayout>
  );
}
