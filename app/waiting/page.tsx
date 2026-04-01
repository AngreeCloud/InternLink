"use client"

import { useEffect } from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"
import { getWaitingApprovalMessage } from "@/lib/approval-messages"
import { SchoolSelector } from "@/components/auth/school-selector"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { School } from "@/lib/types/school"

export default function WaitingPage() {
  const router = useRouter()
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState("")
  const [currentSchoolId, setCurrentSchoolId] = useState("")
  const [currentSchoolName, setCurrentSchoolName] = useState("")
  const [profile, setProfile] = useState({ userId: "", name: "", email: "" })
  const [source, setSource] = useState<"users" | "pendingRegistrations" | "">("")
  const [loadingSchoolData, setLoadingSchoolData] = useState(true)
  const [updatingSchool, setUpdatingSchool] = useState(false)
  const [schoolError, setSchoolError] = useState("")
  const [schoolSuccess, setSchoolSuccess] = useState("")

  const approvalMessage = useMemo(() => {
    return getWaitingApprovalMessage(role)
  }, [role])

  const canChangeSchool = role === "professor" && status === "pendente" && profile.userId.length > 0

  useEffect(() => {
    let unsubscribe = () => {}

    ;(async () => {
      const auth = await getAuthRuntime()
      const db = await getDbRuntime()

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        const schoolsSnap = await getDocs(collection(db, "schools"))
        const schoolsList: School[] = schoolsSnap.docs.map((schoolDoc) => {
          const data = schoolDoc.data() as {
            name?: string
            emailDomain?: string
            requireInstitutionalEmail?: boolean
            allowGoogleLogin?: boolean
            requiresPhone?: boolean
          }

          return {
            id: schoolDoc.id,
            name: data.name || "—",
            emailDomain: data.emailDomain || "",
            requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
            allowGoogleLogin: Boolean(data.allowGoogleLogin),
            requiresPhone: Boolean(data.requiresPhone),
          }
        })

        setSchools(schoolsList)

        const userSnap = await getDoc(doc(db, "users", user.uid))
        if (userSnap.exists()) {
          const data = userSnap.data() as { role?: string; estado?: string; schoolId?: string; nome?: string; email?: string }
          const userRole = data.role || ""
          const userState = data.estado || ""
          const schoolId = data.schoolId || ""

          setRole(userRole)
          setStatus(userState)
          setSource("users")
          setSelectedSchoolId(schoolId)
          setCurrentSchoolId(schoolId)
          setProfile({
            userId: user.uid,
            name: data.nome || user.displayName || "Professor",
            email: data.email || user.email || "",
          })

          const schoolName = schoolsList.find((school) => school.id === schoolId)?.name || ""
          setCurrentSchoolName(schoolName)

          if (userRole === "aluno" && userState === "ativo") {
            router.replace("/dashboard")
            return
          }

          if (userRole === "professor" && userState === "ativo") {
            router.replace("/professor")
            return
          }

          if (userRole === "tutor" && userState === "ativo") {
            router.replace("/tutor")
          }

          setLoadingSchoolData(false)
          return
        }

        const pendingSnap = await getDoc(doc(db, "pendingRegistrations", user.uid))
        if (!pendingSnap.exists()) {
          setLoadingSchoolData(false)
          return
        }

        const pendingData = pendingSnap.data() as { role?: string; estado?: string; schoolId?: string; nome?: string; email?: string }
        const userRole = pendingData.role || ""
        const userState = pendingData.estado || ""
        const schoolId = pendingData.schoolId || ""

        setRole(userRole)
        setStatus(userState)
        setSource("pendingRegistrations")
        setSelectedSchoolId(schoolId)
        setCurrentSchoolId(schoolId)
        setProfile({
          userId: user.uid,
          name: pendingData.nome || user.displayName || "Professor",
          email: pendingData.email || user.email || "",
        })

        const schoolName = schoolsList.find((school) => school.id === schoolId)?.name || ""
        setCurrentSchoolName(schoolName)

        if (userRole === "tutor" && userState === "ativo") {
          router.replace("/tutor")
          return
        }

        setLoadingSchoolData(false)
      })
    })()

    return () => unsubscribe()
  }, [router])

  const handleChangeSchool = async () => {
    if (!canChangeSchool) return

    if (!selectedSchoolId) {
      setSchoolError("Selecione uma escola.")
      return
    }

    const previousSchoolId = currentSchoolId

    setUpdatingSchool(true)
    setSchoolError("")
    setSchoolSuccess("")

    try {
      const db = await getDbRuntime()

      if (source === "users") {
        await updateDoc(doc(db, "users", profile.userId), {
          schoolId: selectedSchoolId,
          estado: "pendente",
          courseId: null,
          reviewedAt: null,
          reviewedBy: null,
        })

        if (previousSchoolId && previousSchoolId !== selectedSchoolId) {
          await deleteDoc(doc(db, "schools", previousSchoolId, "pendingTeachers", profile.userId))
        }

        await setDoc(
          doc(db, "schools", selectedSchoolId, "pendingTeachers", profile.userId),
          {
            name: profile.name,
            email: profile.email,
            role: "teacher",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        )
      } else {
        await updateDoc(doc(db, "pendingRegistrations", profile.userId), {
          schoolId: selectedSchoolId,
          escola: schools.find((school) => school.id === selectedSchoolId)?.name || "",
          updatedAt: serverTimestamp(),
        })
      }

      const nextSchoolName = schools.find((school) => school.id === selectedSchoolId)?.name || ""
      setCurrentSchoolId(selectedSchoolId)
      setCurrentSchoolName(nextSchoolName)
      setSchoolSuccess(`Pedido atualizado para ${nextSchoolName || "a escola selecionada"}.`)
    } catch (error) {
      console.error("Erro ao alterar escola na lista de espera:", error)
      setSchoolError("Não foi possível atualizar a escola. Tente novamente.")
    } finally {
      setUpdatingSchool(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Aguarde aprovação</h1>
        <p className="text-muted-foreground">{approvalMessage}</p>
        <p className="text-muted-foreground">
          Quando a conta for aprovada, poderá entrar na plataforma normalmente.
        </p>

        {canChangeSchool && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4 text-left">
            <p className="text-sm text-muted-foreground">Escola associada no pedido atual</p>
            <p className="text-sm font-medium text-foreground">{currentSchoolName || "Sem escola associada"}</p>

            {schoolError ? (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{schoolError}</AlertDescription>
              </Alert>
            ) : null}

            {schoolSuccess ? (
              <Alert className="mt-3">
                <AlertDescription>{schoolSuccess}</AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-3 space-y-3">
              <SchoolSelector
                schools={schools}
                value={selectedSchoolId}
                onChange={(schoolId) => setSelectedSchoolId(schoolId)}
                disabled={loadingSchoolData || updatingSchool}
                placeholder={loadingSchoolData ? "A carregar escolas..." : "Selecione uma escola..."}
                label="Alterar escola de associação"
              />

              <Button
                className="w-full"
                onClick={handleChangeSchool}
                disabled={loadingSchoolData || updatingSchool || !selectedSchoolId}
              >
                {updatingSchool ? "A atualizar..." : "Atualizar pedido"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
