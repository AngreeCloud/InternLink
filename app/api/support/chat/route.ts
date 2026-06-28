import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
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

    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const db = getFirebaseAdminDb();
    const conversationId = randomUUID();
    const ticketId = randomUUID();
    const ts = Date.now();

    await db.collection("supportTickets").doc(ticketId).set({
      title: "Chat de suporte",
      description: "",
      userId,
      userName: userName || null,
      userEmail: userEmail || null,
      status: "open",
      priority: "normal",
      assignedTo: null,
      conversationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Read auto-reply config (return to client, don't write here)
    const landingSnap = await db.collection("landingContent").doc("support").get();
    const autoReply = landingSnap.exists
      ? ((landingSnap.data() as { autoReply?: string })?.autoReply || "")
      : "";

    // Write RTDB conversation (no auto-reply — client sends it after user message)
    const rtdb = getFirebaseAdminDatabase();
    await rtdb.ref().update({
      [`conversations/${conversationId}`]: {
        type: "support",
        participants: { [userId]: true },
        createdAt: ts,
        updatedAt: ts,
        lastMessage: { text: null, senderId: null, createdAt: ts, hasAttachments: false },
      },
      [`userConversations/${userId}/${conversationId}`]: {
        lastMessageText: null,
        lastMessageAt: ts,
        unreadCount: 0,
        isMuted: false,
      },
    });

    return NextResponse.json({ ok: true, conversationId, ticketId, autoReply });
  } catch (error) {
    console.error("[api/support/chat]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
