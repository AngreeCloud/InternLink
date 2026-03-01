import { ProfessorLayout } from "@/components/layout/professor-layout";
import { PendingStudentsManager } from "@/components/professor/pending-students-manager";

export default function AprovacoesProfessorPage() {
  return (
    <ProfessorLayout>
      <PendingStudentsManager />
    </ProfessorLayout>
  );
}
