"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"
import { onAuthStateChanged } from "firebase/auth"
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { getAccountStatusApprovalMessage } from "@/lib/approval-messages"
import { getDashboardRouteForRole } from "@/lib/auth/status-routing"
import { SchoolSelector } from "@/components/auth/school-selector"
import type { School } from "@/lib/types/school"

export default function AccountStatusPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState({
    loading: true,
    userId: "",
    userName: "",
    email: "",
    createdAt: "",
    status: "pendente",
    role: "",
    schoolId: "",
    schoolName: "",
    schoolLogoUrl: "",
    source: "" as "users" | "pendingRegistrations" | "",
  })
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState("")
  const [updatingSchool, setUpdatingSchool] = useState(false)
  const [schoolError, setSchoolError] = useState("")
  const [schoolSuccess, setSchoolSuccess] = useState("")

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
        let schoolId = ""
        let source: "users" | "pendingRegistrations" | "" = ""

        const schoolsSnap = await getDocs(collection(db, "schools"))
        const schoolsList: School[] = schoolsSnap.docs.map((schoolDoc) => {
          const data = schoolDoc.data() as {
            name?: string
            profileImageUrl?: string
            emailDomain?: string
            requireInstitutionalEmail?: boolean
            allowGoogleLogin?: boolean
            requiresPhone?: boolean
          }

          return {
            id: schoolDoc.id,
            name: data.name || "—",
            profileImageUrl: data.profileImageUrl || "",
            emailDomain: data.emailDomain || "",
            requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
            allowGoogleLogin: Boolean(data.allowGoogleLogin),
            requiresPhone: Boolean(data.requiresPhone),
          }
        })

        setSchools(schoolsList)

        const snapshot = await getDoc(doc(db, "users", user.uid))
        if (snapshot.exists()) {
          const data = snapshot.data() as {
            role?: string
            estado?: string
            schoolId?: string
            createdAt?: { toDate: () => Date }
          }
          role = data?.role || ""
          status = data?.estado || status
          schoolId = data?.schoolId || ""
          source = "users"
          if (data?.createdAt && typeof data.createdAt === "object" && "toDate" in data.createdAt) {
            createdAt = data.createdAt.toDate().toISOString()
          }
        } else {
          const pendingSnapshot = await getDoc(doc(db, "pendingRegistrations", user.uid))
          if (pendingSnapshot.exists()) {
            const pendingData = pendingSnapshot.data() as {
              role?: string
              estado?: string
              schoolId?: string
              createdAt?: { toDate: () => Date }
            }

            role = pendingData?.role || role
            status = pendingData?.estado || status
            schoolId = pendingData?.schoolId || ""
            source = "pendingRegistrations"

            if (pendingData?.createdAt && typeof pendingData.createdAt === "object" && "toDate" in pendingData.createdAt) {
              createdAt = pendingData.createdAt.toDate().toISOString()
            }
          }
        }

        const schoolName = schoolsList.find((school) => school.id === schoolId)?.name || ""
        const schoolLogoUrl = schoolsList.find((school) => school.id === schoolId)?.profileImageUrl || ""
        setSelectedSchoolId(schoolId)

        setState({
          loading: false,
          userId: user.uid,
          userName: user.displayName || "Professor",
          email,
          createdAt,
          status,
          role,
          schoolId,
          schoolName,
          schoolLogoUrl,
          source,
        })
      })
    })()

    return () => unsub()
  }, [qpEmail, qpCreatedAt, router])

  const statusLabel = state.status || "pendente"
  const canAccessDashboard = statusLabel === "ativo"
  const dashboardHref = getDashboardRouteForRole(state.role)
  const approvalMessage = getAccountStatusApprovalMessage(state.role)
  const canChangeSchool = state.role === "professor" && state.status === "pendente" && state.userId.length > 0

  useEffect(() => {
    if (state.loading || !state.userId) return
    if (state.status !== "ativo") return

    router.replace(getDashboardRouteForRole(state.role))
  }, [router, state.loading, state.role, state.status, state.userId])

  const handleChangeSchoolAssociation = async () => {
    if (!canChangeSchool) return

    if (!selectedSchoolId) {
      setSchoolError("Selecione uma escola.")
      return
    }

    setUpdatingSchool(true)
    setSchoolError("")
    setSchoolSuccess("")

    try {
      const db = await getDbRuntime()

      if (state.source === "users") {
        await updateDoc(doc(db, "users", state.userId), {
          schoolId: selectedSchoolId,
          estado: "pendente",
          courseId: null,
          reviewedAt: null,
          reviewedBy: null,
        })

        if (state.schoolId && state.schoolId !== selectedSchoolId) {
          await deleteDoc(doc(db, "schools", state.schoolId, "pendingTeachers", state.userId))
        }

        await setDoc(
          doc(db, "schools", selectedSchoolId, "pendingTeachers", state.userId),
          {
            name: state.userName,
            email: state.email,
            role: "teacher",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        )
      } else if (state.source === "pendingRegistrations") {
        await updateDoc(doc(db, "pendingRegistrations", state.userId), {
          schoolId: selectedSchoolId,
          escola: schools.find((school) => school.id === selectedSchoolId)?.name || "",
          updatedAt: serverTimestamp(),
        })
      }

      const nextSchoolName = schools.find((school) => school.id === selectedSchoolId)?.name || ""
      const nextSchoolLogoUrl = schools.find((school) => school.id === selectedSchoolId)?.profileImageUrl || ""
      setState((previous) => ({
        ...previous,
        schoolId: selectedSchoolId,
        schoolName: nextSchoolName,
        schoolLogoUrl: nextSchoolLogoUrl,
      }))
      setSchoolSuccess(`Pedido atualizado para ${nextSchoolName || "a escola selecionada"}.`)
    } catch (error) {
      console.error("Erro ao atualizar escola de associação:", error)
      setSchoolError("Não foi possível atualizar a escola. Tente novamente.")
    } finally {
      setUpdatingSchool(false)
    }
  }

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
              {state.schoolName ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Escola</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={state.schoolLogoUrl || ""} alt={state.schoolName} />
                      <AvatarFallback>{state.schoolName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{state.schoolName}</span>
                  </div>
                </div>
              ) : null}
              {!canAccessDashboard && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {approvalMessage}
                </div>
              )}

              {canChangeSchool && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Escola associada ao pedido</p>
                    <p className="text-sm font-medium">{state.schoolName || "Sem escola associada"}</p>
                  </div>

                  {schoolError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{schoolError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {schoolSuccess ? (
                    <Alert>
                      <AlertDescription>{schoolSuccess}</AlertDescription>
                    </Alert>
                  ) : null}

                  <SchoolSelector
                    schools={schools}
                    value={selectedSchoolId}
                    onChange={setSelectedSchoolId}
                    label="Alterar escola de associação"
                    placeholder="Pesquise a escola"
                    disabled={updatingSchool}
                  />

                  <Button
                    size="sm"
                    onClick={handleChangeSchoolAssociation}
                    disabled={updatingSchool || !selectedSchoolId}
                  >
                    {updatingSchool ? "A atualizar..." : "Atualizar pedido"}
                  </Button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Voltar ao login</Link>
                </Button>
                {!canAccessDashboard && state.role === "professor" ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/re-solicitar-acesso">Re-solicitar acesso</Link>
                  </Button>
                ) : null}
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
