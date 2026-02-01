import { PendingTeachersSection } from "@/components/school-admin/pending-teachers";
import { FoldersManager } from "@/components/school-admin/folders-manager";

export default function SchoolAdminFoldersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pastas e Aprovações</h1>
        <p className="text-muted-foreground">Aprovação de utilizadores e criação de pastas/cursos.</p>
      </div>

      <PendingTeachersSection />
      <FoldersManager />
    </div>
  );
}
