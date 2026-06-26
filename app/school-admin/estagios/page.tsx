import { AdminEstagiosTable } from "@/components/school-admin/admin-estagios-table";
import { DeleteEstagioRequestsSection } from "@/components/school-admin/delete-estagio-requests";
import { AvaliacaoConfigButton } from "@/components/school-admin/avaliacao-config-button";

export default function SchoolAdminEstagiosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Estágios</h1>
        <p className="text-muted-foreground">Visualizar todos os estágios da escola.</p>
      </div>

      <AvaliacaoConfigButton />

      <AdminEstagiosTable />

      <DeleteEstagioRequestsSection />
    </div>
  );
}
