import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProtocolsManager } from "@/components/documents/protocols-manager"

export default function ProtocolsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Protocolos de Estágio</h1>
          <p className="text-muted-foreground">Gerir e visualizar protocolos de estágio</p>
        </div>
        <ProtocolsManager />
      </div>
    </DashboardLayout>
  )
}
