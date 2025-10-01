import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { UsersManager } from "@/components/admin/users-manager"

export default function UsersPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Utilizadores</h1>
          <p className="text-muted-foreground">Ver e gerir utilizadores da plataforma</p>
        </div>
        <UsersManager />
      </div>
    </DashboardLayout>
  )
}
