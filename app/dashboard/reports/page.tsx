import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ReportsManager } from "@/components/documents/reports-manager"

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios de Estágio</h1>
          <p className="text-muted-foreground">Gerir e visualizar relatórios de estágio</p>
        </div>
        <ReportsManager />
      </div>
    </DashboardLayout>
  )
}
