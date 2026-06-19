import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin"
import { SESSION_COOKIE_NAME } from "@/lib/auth/session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const jar = await cookies()
    const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessão inexistente" }, { status: 401 })
    }

    const auth = getFirebaseAdminAuth()
    await auth.verifySessionCookie(sessionCookie, true)
    const db = getFirebaseAdminDb()

    const { orgId, queryText, currentUserId, currentUserRole } = (await request.json()) as {
      orgId?: string | null
      queryText?: string
      currentUserId?: string
      currentUserRole?: string
    }

    if (!orgId || !currentUserId) {
      return NextResponse.json({ members: [] })
    }

    const term = (queryText || "").trim().toLowerCase()

    const [schoolIdSnap, escolaIdSnap] = await Promise.all([
      db.collection("users").where("schoolId", "==", orgId).get(),
      db.collection("users").where("escolaId", "==", orgId).get(),
    ])

    const seen = new Set<string>()
    const results: Array<{
      uid: string
      name: string
      email: string
      photoURL: string
      role: string
      orgId: string | null
    }> = []

    const addDoc = (snap: FirebaseFirestore.QueryDocumentSnapshot) => {
      if (seen.has(snap.id)) return
      seen.add(snap.id)

      const data = snap.data() as {
        nome?: string
        name?: string
        email?: string
        photoURL?: string
        role?: string
        estado?: string
        schoolId?: string
        escolaId?: string
      }

      if (snap.id === currentUserId) return
      if ((data.estado || "").toLowerCase() !== "ativo") return

      const profileOrgId = data.schoolId || data.escolaId || null
      if (profileOrgId !== orgId) return

      const role = toChatRoleAdmin(data.role)
      if (currentUserRole === "tutor") {
        // tutors see all same-school active users
      } else if (currentUserRole === "student") {
        if (role === "encarregado" && snap.id !== currentUserId) return
        if (!["student", "teacher", "admin", "tutor"].includes(role)) return
      }

      const name = data.nome || data.name || "Utilizador"
      if (term && !name.toLowerCase().includes(term) && !(data.email || "").toLowerCase().includes(term)) return

      results.push({
        uid: snap.id,
        name,
        email: data.email || "",
        photoURL: data.photoURL || "",
        role,
        orgId: profileOrgId,
      })
    }

    schoolIdSnap.forEach(addDoc)
    escolaIdSnap.forEach(addDoc)

    results.sort((a, b) => a.name.localeCompare(b.name, "pt-PT"))

    return NextResponse.json({ members: results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function toChatRoleAdmin(role: string | undefined): string {
  switch ((role || "").toLowerCase()) {
    case "aluno":
      return "student"
    case "professor":
      return "teacher"
    case "admin_escolar":
      return "admin"
    case "tutor":
      return "tutor"
    case "encarregado":
      return "encarregado"
    default:
      return "student"
  }
}
