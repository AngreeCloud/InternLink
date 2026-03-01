import { ApprovalHistorySection } from "@/components/school-admin/approval-history";

export default function SchoolAdminHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Histórico</h1>
        <p className="text-muted-foreground">Consulte aprovações e recusas de pedidos de professores.</p>
      </div>

      <ApprovalHistorySection />
    </div>
  );
}
