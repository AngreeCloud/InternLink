import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth/session"
import { ProfessorLayout } from "@/components/layout/professor-layout"
import { EstagioDetailView } from "@/components/estagios/estagio-detail-view"

export default async function ProfessorEstagioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  if (session.role !== "professor") {
    redirect("/dashboard")
  }

  return (
    <ProfessorLayout>
      <div className="space-y-4">
        <EstagioDetailView
          estagioId={id}
          currentUserId={session.uid}
          currentUserRole="professor"
          backHref="/professor/estagios"
          backLabel="Voltar aos estágios"
        />
      </div>
    </ProfessorLayout>
  )
}
