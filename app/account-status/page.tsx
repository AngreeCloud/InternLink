"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AccountStatusPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState({
    loading: true,
    email: "",
    createdAt: "",
    status: "pendente",
    role: "",
  })

  const qpEmail = searchParams.get("email")
  const qpCreatedAt = searchParams.get("createdAt")

  const createdDate = useMemo(() => {
    if (state.createdAt) return new Date(state.createdAt)
    if (qpCreatedAt) return new Date(qpCreatedAt)
    return null
  }, [state.createdAt, qpCreatedAt])

  useEffect(() => {
    let unsub = () => {}

    ;(async () => {
      const auth = await getAuthRuntime()
      const db = await getDbRuntime()

      unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((s) => ({ ...s, loading: false }))
          router.replace("/login")
          return
        }

        const email = user.email || qpEmail || ""
        let createdAt = user.metadata.creationTime || qpCreatedAt || ""
        let status = "pendente"
        let role = ""

        const snapshot = await getDoc(doc(db, "users", user.uid))
        if (snapshot.exists()) {
          const data = snapshot.data() as { role?: string; estado?: string; createdAt?: { toDate: () => Date } }
          role = data?.role || ""
          status = data?.estado || status
          if (data?.createdAt && typeof data.createdAt === "object" && "toDate" in data.createdAt) {
            createdAt = data.createdAt.toDate().toISOString()
          }
        }

        setState({ loading: false, email, createdAt, status, role })
      })
    })()

    return () => unsub()
  }, [qpEmail, qpCreatedAt, router])

  const statusLabel = state.status || "pendente"
  const canAccessDashboard = statusLabel === "ativo"
  const dashboardHref = state.role === "professor" ? "/professor" : state.role === "tutor" ? "/tutor" : "/dashboard"
  const approvalMessage =
    state.role === "professor"
      ? "A sua conta está pendente de aprovação manual pelo administrador escolar da sua escola."
      : state.role === "tutor"
        ? "A sua conta está pendente de aprovação manual pela equipa responsável da escola."
        : "A sua conta está pendente de aprovação manual pelo professor responsável."

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle>Estado da Conta</CardTitle>
          <CardDescription>Verifique o estado do seu registo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.loading ? (
            <p>Carregando...</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Badge variant={canAccessDashboard ? "default" : "secondary"}>{statusLabel}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium">{state.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Criada em</span>
                <span className="font-medium">
                  {createdDate ? createdDate.toLocaleString() : "—"}
                </span>
              </div>
              {!canAccessDashboard && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {approvalMessage}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Voltar ao login</Link>
                </Button>
                {canAccessDashboard ? (
                  <Button asChild size="sm">
                    <Link href={dashboardHref}>Ir para dashboard</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
