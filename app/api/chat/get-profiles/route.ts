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

    const { userIds } = (await request.json()) as { userIds?: string[] }
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ profiles: [] })
    }

    const profiles = await Promise.all(
      userIds.map(async (uid) => {
        try {
          const snap = await db.collection("users").doc(uid).get()
          if (!snap.exists) return null
          const data = snap.data() as {
            nome?: string
            name?: string
            email?: string
            photoURL?: string
            role?: string
            schoolId?: string
            escolaId?: string
          }

          const chatRole =
            data.role === "professor"
              ? "teacher"
              : data.role === "tutor"
                ? "tutor"
                : data.role === "admin_escolar"
                  ? "admin"
                  : data.role === "encarregado"
                    ? "encarregado"
                    : "student"

          return {
            uid,
            name: data.nome || data.name || "Utilizador",
            email: data.email || "",
            photoURL: data.photoURL || "",
            role: chatRole,
            orgId: data.schoolId || data.escolaId || null,
          }
        } catch {
          return null
        }
      })
    )

    return NextResponse.json({ profiles: profiles.filter(Boolean) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
