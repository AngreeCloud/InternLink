import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      schoolName: string;
      contactEmail: string;
      contactName: string;
      role: string;
      message?: string | null;
      plan?: string;
    };

    if (!body.schoolName || !body.contactEmail || !body.contactName || !body.role) {
      return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    await db.collection("schoolLeads").doc().set({
      schoolName: body.schoolName.trim(),
      contactEmail: body.contactEmail.trim(),
      contactName: body.contactName.trim(),
      role: body.role.trim(),
      message: body.message || null,
      plan: body.plan || "starter",
      status: "pending",
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/school-leads]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
