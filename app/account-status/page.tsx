"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"
import { onAuthStateChanged } from "firebase/auth"
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore"
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
    courseId: "",
    courseName: "",
    schoolName: "",
    schoolLogoUrl: "",
    source: "" as "users" | "",
  })
  const [schools, setSchools] = useState<School[]>([])
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [updatingRequest, setUpdatingRequest] = useState(false)
  const [requestError, setRequestError] = useState("")
  const [requestSuccess, setRequestSuccess] = useState("")

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
        let courseId = ""
        let courseName = ""
        let source: "users" | "" = ""

        const schoolsSnap = await getDocs(collection(db, "schools"))
        const schoolsList: School[] = schoolsSnap.docs.map((schoolDoc) => {
          const data = schoolDoc.data() as {
            name?: string
            profileImageUrl?: string
            bannerUrl?: string
            bannerFocusX?: number
            bannerFocusY?: number
            address?: string
            contact?: string
            emailDomain?: string
            requireInstitutionalEmail?: boolean
            allowGoogleLogin?: boolean
            requiresPhone?: boolean
          }

          return {
            id: schoolDoc.id,
            name: data.name || "—",
            profileImageUrl: data.profileImageUrl || "",
            bannerUrl: data.bannerUrl || "",
            bannerFocusX: typeof data.bannerFocusX === "number" ? data.bannerFocusX : 50,
            bannerFocusY: typeof data.bannerFocusY === "number" ? data.bannerFocusY : 50,
            address: data.address || "",
            contact: data.contact || "",
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
            courseId?: string
            curso?: string
            createdAt?: { toDate: () => Date }
          }
          role = data?.role || ""
          status = data?.estado || status
          schoolId = data?.schoolId || ""
          courseId = data?.courseId || ""
          courseName = data?.curso || ""
          source = "users"
          if (data?.createdAt && typeof data.createdAt === "object" && "toDate" in data.createdAt) {
            createdAt = data.createdAt.toDate().toISOString()
          }
        }

        const schoolName = schoolsList.find((school) => school.id === schoolId)?.name || ""
        const schoolLogoUrl = schoolsList.find((school) => school.id === schoolId)?.profileImageUrl || ""
        setSelectedSchoolId(schoolId)
        setSelectedCourseId(courseId)

        setState({
          loading: false,
          userId: user.uid,
          userName: user.displayName || "Professor",
          email,
          createdAt,
          status,
          role,
          schoolId,
          courseId,
          courseName,
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
  const approvalMessage = getAccountStatusApprovalMessage(state.role, state.status)
  const canReRequestAccess =
    state.userId.length > 0
    && state.role !== "tutor"
    && ["pendente", "inativo", "removido"].includes(statusLabel)

  const selectedSchoolName = schools.find((school) => school.id === selectedSchoolId)?.name || ""
  const selectedCourseName = courses.find((course) => course.id === selectedCourseId)?.name || ""
  const focusSchool = useMemo(
    () =>
      schools.find((school) => school.id === selectedSchoolId)
      || schools.find((school) => school.id === state.schoolId)
      || null,
    [schools, selectedSchoolId, state.schoolId]
  )

  useEffect(() => {
    if (state.loading || !state.userId) return
    if (state.status !== "ativo") return

    router.replace(getDashboardRouteForRole(state.role))
  }, [router, state.loading, state.role, state.status, state.userId])

  useEffect(() => {
    if (!selectedSchoolId) {
      setCourses([])
      setSelectedCourseId("")
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const db = await getDbRuntime()
        const coursesSnap = await getDocs(
          query(collection(db, "courses"), where("schoolId", "==", selectedSchoolId))
        )

        if (cancelled) return

        const list = coursesSnap.docs
          .map((courseDoc) => {
            const data = courseDoc.data() as { name?: string }
            return {
              id: courseDoc.id,
              name: data.name || "—",
            }
          })
          .sort((left, right) => left.name.localeCompare(right.name, "pt-PT"))

        setCourses(list)
        setSelectedCourseId((previous) => {
          if (previous && list.some((course) => course.id === previous)) {
            return previous
          }

          if (
            state.schoolId === selectedSchoolId
            && state.courseId
            && list.some((course) => course.id === state.courseId)
          ) {
            return state.courseId
          }

          return ""
        })
      } catch (error) {
        console.error("Erro ao carregar turmas para re-solicitação:", error)
        if (!cancelled) {
          setCourses([])
          setSelectedCourseId("")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedSchoolId, state.courseId, state.schoolId])

  const handleReRequestAccess = async () => {
    if (!canReRequestAccess) return

    if (!selectedSchoolId) {
      setRequestError("Selecione uma escola.")
      return
    }

    if (!selectedCourseId) {
      setRequestError("Selecione a turma.")
      return
    }

    setUpdatingRequest(true)
    setRequestError("")
    setRequestSuccess("")

    try {
      const db = await getDbRuntime()
      const schoolName = selectedSchoolName
      const courseName = selectedCourseName

      if (state.source === "users") {
        await updateDoc(doc(db, "users", state.userId), {
          schoolId: selectedSchoolId,
          escola: schoolName,
          courseId: selectedCourseId,
          curso: courseName,
          estado: "pendente",
          reviewedAt: null,
          reviewedBy: null,
          updatedAt: serverTimestamp(),
        })

        if (state.role === "professor") {
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
        }
      }

      const nextSchoolLogoUrl = schools.find((school) => school.id === selectedSchoolId)?.profileImageUrl || ""
      setState((previous) => ({
        ...previous,
        status: "pendente",
        schoolId: selectedSchoolId,
        schoolName,
        schoolLogoUrl: nextSchoolLogoUrl,
        courseId: selectedCourseId,
        courseName,
      }))
      setRequestSuccess(`Pedido atualizado para ${schoolName || "a escola selecionada"}, turma ${courseName || "selecionada"}.`)
    } catch (error) {
      console.error("Erro ao re-solicitar acesso:", error)
      setRequestError("Não foi possível atualizar o pedido. Tente novamente.")
    } finally {
      setUpdatingRequest(false)
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
              {state.schoolName && !canReRequestAccess ? (
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

              {focusSchool && canReRequestAccess ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {focusSchool.bannerUrl ? (
                    <div className="relative h-24 w-full">
                      <img
                        src={focusSchool.bannerUrl}
                        alt={`Banner de ${focusSchool.name}`}
                        className="h-full w-full object-cover"
                        style={{ objectPosition: `${focusSchool.bannerFocusX || 50}% ${focusSchool.bannerFocusY || 50}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-24 w-full bg-gradient-to-r from-muted to-muted/40" />
                  )}

                  <div className="space-y-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={focusSchool.profileImageUrl || ""} alt={focusSchool.name} />
                        <AvatarFallback>{focusSchool.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-muted-foreground">Escola selecionada</p>
                        <p className="font-semibold text-foreground">{focusSchool.name}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Morada:</span>{" "}
                        {focusSchool.address || "Sem morada registada"}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Contacto:</span>{" "}
                        {focusSchool.contact || "Sem contacto registado"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!canAccessDashboard && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {approvalMessage}
                </div>
              )}

              {canReRequestAccess && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Re-solicitar acesso</p>
                  </div>

                  {requestError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{requestError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {requestSuccess ? (
                    <Alert>
                      <AlertDescription>{requestSuccess}</AlertDescription>
                    </Alert>
                  ) : null}

                  <SchoolSelector
                    schools={schools}
                    value={selectedSchoolId}
                    onChange={setSelectedSchoolId}
                    label="Escola"
                    placeholder="Pesquise a escola"
                    disabled={updatingRequest}
                    selectedPreviewMode="while-searching"
                  />

                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Turma</label>
                    <select
                      className="h-9 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                      value={selectedCourseId}
                      onChange={(event) => setSelectedCourseId(event.target.value)}
                      disabled={updatingRequest || courses.length === 0}
                    >
                      <option value="">Selecionar turma</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleReRequestAccess}
                    disabled={updatingRequest || !selectedSchoolId || !selectedCourseId}
                  >
                    {updatingRequest ? "A atualizar..." : "Re-solicitar acesso"}
                  </Button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Voltar ao login</Link>
                </Button>
                {state.status === "inativo" ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/verify-email">Verificar email</Link>
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
