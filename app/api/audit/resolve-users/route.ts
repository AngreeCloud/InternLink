import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resolveUserNames } from "@/lib/audit/resolve-users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const jar = await cookies();
    const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessão inexistente" }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    await auth.verifySessionCookie(sessionCookie, true);

    const { searchParams } = new URL(request.url);
    const uidsParam = searchParams.get("uids");
    if (!uidsParam) {
      return NextResponse.json({});
    }

    const uids = uidsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (uids.length === 0) {
      return NextResponse.json({});
    }

    const nameMap = await resolveUserNames(uids);
    const result: Record<string, string> = {};
    nameMap.forEach((name, uid) => { result[uid] = name; });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Erro ao resolver utilizadores" }, { status: 500 });
  }
}
