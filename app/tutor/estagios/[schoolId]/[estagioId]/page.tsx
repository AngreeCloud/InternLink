import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth/session"
import { TutorLayout } from "@/components/layout/tutor-layout"
import { EstagioDetailView } from "@/components/estagios/estagio-detail-view"

export default async function TutorEstagioDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string; estagioId: string }>
}) {
  const { schoolId, estagioId } = await params
  const session = await getCurrentSession()

  if (!session) {
    redirect("/login")
  }

  if (session.role !== "tutor") {
    redirect("/dashboard")
  }

  return (
    <TutorLayout>
      <EstagioDetailView
        estagioId={estagioId}
        currentUserId={session.uid}
        currentUserRole="tutor"
        backHref={`/tutor/estagios/${schoolId}`}
        backLabel="Voltar aos estágios da escola"
      />
    </TutorLayout>
  )
}
