import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminOverview } from "@/components/admin/admin-overview"

export default function AdminPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerir utilizadores, escolas e empresas da plataforma</p>
        </div>
        <AdminOverview />
      </div>
    </DashboardLayout>
  )
}
