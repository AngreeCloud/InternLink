import { ProfessorLayout } from "@/components/layout/professor-layout";
import { ApprovedStudentsManager } from "@/components/professor/approved-students-manager";

export default function ProfessorStudentsPage() {
  return (
    <ProfessorLayout>
      <ApprovedStudentsManager />
    </ProfessorLayout>
  );
}