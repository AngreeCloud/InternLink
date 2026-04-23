import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth/session"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { EstagioDetailView } from "@/components/estagios/estagio-detail-view"

export default async function StudentEstagioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  if (session.role !== "aluno") {
    redirect("/dashboard")
  }

  return (
    <DashboardLayout>
      <EstagioDetailView
        estagioId={id}
        currentUserId={session.uid}
        currentUserRole="aluno"
        backHref="/dashboard"
        backLabel="Voltar ao painel"
      />
    </DashboardLayout>
  )
}
