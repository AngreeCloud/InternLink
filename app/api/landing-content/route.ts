import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getFirebaseAdminDb();
    const snap = await db.collection("landingContent").get();
    const content: Record<string, unknown> = {};
    snap.docs.forEach((doc) => {
      content[doc.id] = doc.data();
    });
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: {} }, { status: 500 });
  }
}
