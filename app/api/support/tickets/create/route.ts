import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title: string;
      description?: string;
      userId?: string;
      userName?: string;
      userEmail?: string;
    };

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: "Título obrigatório." }, { status: 400 });
    }

    // Try to get userId from session if not passed directly
    let userId = body.userId;
    if (!userId) {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      if (sessionCookie) {
        try {
          const auth = getFirebaseAdminAuth();
          const decoded = await auth.verifySessionCookie(sessionCookie, true);
          userId = decoded.uid;
        } catch {
          // anonymous — still allow ticket creation
        }
      }
    }

    const db = getFirebaseAdminDb();
    await db.collection("supportTickets").doc().set({
      title: body.title.trim(),
      description: body.description?.trim() || "",
      userId: userId || null,
      userName: body.userName || null,
      userEmail: body.userEmail || null,
      status: "open",
      priority: "normal",
      assignedTo: null,
      conversationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/support/tickets/create]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
