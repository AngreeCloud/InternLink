import { ProfessorLayout } from "@/components/layout/professor-layout";
import { ProfessorDashboardOverview } from "@/components/professor/professor-dashboard-overview";

export default function ProfessorPage() {
  return (
    <ProfessorLayout>
      <ProfessorDashboardOverview />
    </ProfessorLayout>
  );
}
