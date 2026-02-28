import { TutorLayout } from "@/components/layout/tutor-layout";
import { TutorDashboardOverview } from "@/components/tutor/tutor-dashboard-overview";

export default function TutorPage() {
  return (
    <TutorLayout>
      <TutorDashboardOverview />
    </TutorLayout>
  );
}
