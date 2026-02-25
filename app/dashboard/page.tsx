import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StudentDashboardOverview } from "@/components/student/student-dashboard-overview"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <StudentDashboardOverview />
    </DashboardLayout>
  )
}
