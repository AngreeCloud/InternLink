import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StudentReportsManager } from "@/components/student/student-reports-manager"

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <StudentReportsManager />
    </DashboardLayout>
  )
}
