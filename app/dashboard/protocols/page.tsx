import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StudentProtocolView } from "@/components/student/student-protocol-view"

export default function ProtocolsPage() {
  return (
    <DashboardLayout>
      <StudentProtocolView />
    </DashboardLayout>
  )
}
