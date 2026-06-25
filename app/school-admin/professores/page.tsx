import { PendingTeachersSection } from "@/components/school-admin/pending-teachers";
import { ActiveProfessorsSection } from "@/components/school-admin/active-professors";

export default function SchoolAdminProfessoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Professores</h1>
        <p className="text-muted-foreground">Gerir professores, aprovações e atribuição a cursos.</p>
      </div>

      <PendingTeachersSection showActions={true} />
      
      <ActiveProfessorsSection />
    </div>
  );
}
