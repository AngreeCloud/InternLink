import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    if (sessionCookie) {
      try {
        const auth = getFirebaseAdminAuth();
        const decoded = await auth.verifySessionCookie(sessionCookie, true);
        userId = decoded.uid;
        userEmail = decoded.email || null;
        userName = decoded.name || null;
      } catch { /* proceed without user */ }
    }

    const db = getFirebaseAdminDb();
    const conversationId = randomUUID();
    const ticketId = randomUUID();

    // Create support ticket
    await db.collection("supportTickets").doc(ticketId).set({
      title: "Chat de suporte",
      description: "",
      userId: userId || null,
      userName: userName || null,
      userEmail: userEmail || null,
      status: "open",
      priority: "normal",
      assignedTo: null,
      conversationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, conversationId, ticketId });
  } catch (error) {
    console.error("[api/support/chat]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
