"use client"

import { useEffect } from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"
import { getWaitingApprovalMessage } from "@/lib/approval-messages"

export default function WaitingPage() {
  const router = useRouter()
  const [role, setRole] = useState("")

  const approvalMessage = useMemo(() => {
    return getWaitingApprovalMessage(role)
  }, [role])

  useEffect(() => {
    let unsubscribe = () => {}

    ;(async () => {
      const auth = await getAuthRuntime()
      const db = await getDbRuntime()

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        const userSnap = await getDoc(doc(db, "users", user.uid))
        if (!userSnap.exists()) return

        const data = userSnap.data() as { role?: string; estado?: string }
        const userRole = data.role || ""
        const userState = data.estado || ""
        setRole(userRole)

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
      })
    })()

    return () => unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Aguarde aprovação</h1>
        <p className="text-muted-foreground">{approvalMessage}</p>
        <p className="text-muted-foreground">
          Quando a conta for aprovada, poderá entrar na plataforma normalmente.
        </p>
      </div>
    </div>
  )
}
