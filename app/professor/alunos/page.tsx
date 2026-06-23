import { ProfessorLayout } from "@/components/layout/professor-layout";
import { PendingStudentsManager } from "@/components/professor/pending-students-manager";
import { ApprovedStudentsManager } from "@/components/professor/approved-students-manager";

export default function ProfessorStudentsPage() {
  return (
    <ProfessorLayout>
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-1">Alunos</h1>
        <p className="text-muted-foreground mb-6">
          Aprovação de novos alunos e gestão de alunos ativos da escola.
        </p>
        <div className="space-y-8">
          <PendingStudentsManager embedded />
          <ApprovedStudentsManager />
        </div>
      </div>
    </ProfessorLayout>
  );
}
