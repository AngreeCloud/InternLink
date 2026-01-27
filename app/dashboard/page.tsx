import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { DocumentsOverview } from "@/components/documents/documents-overview"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Gerir protocolos e relatórios de estágio</p>
        </div>
        <DocumentsOverview />
      </div>
    </DashboardLayout>
  )
}
