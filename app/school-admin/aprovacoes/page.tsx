import { PendingTeachersSection } from "@/components/school-admin/pending-teachers";
import { ActiveProfessorsSection } from "@/components/school-admin/active-professors";

export default function SchoolAdminApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Aprovações</h1>
        <p className="text-muted-foreground">Gerir professores e sua atribuição a cursos.</p>
      </div>

      <PendingTeachersSection showActions={true} />
      
      <ActiveProfessorsSection />
    </div>
  );
}
