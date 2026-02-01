import { PendingTeachersSection } from "@/components/school-admin/pending-teachers";

export default function SchoolAdminApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Aprovações</h1>
        <p className="text-muted-foreground">Gerir professores pendentes de aprovação.</p>
      </div>

      <PendingTeachersSection />
    </div>
  );
}
