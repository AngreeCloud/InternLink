import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
} from "@/lib/auth/session";

export const runtime = "nodejs";

type SessionRequestBody = {
  idToken?: string;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as SessionRequestBody;

    if (!idToken) {
      return NextResponse.json({ error: "idToken em falta." }, { status: 400 });
    }

    const auth = getFirebaseAdminAuth();
    await auth.verifyIdToken(idToken, true);

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_EXPIRES_IN_MS / 1000),
    });

    return response;
  } catch (error) {
    console.error("Erro ao criar session cookie:", error);
    return NextResponse.json(
      { error: "Nao foi possivel criar sessao." },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionCookie) {
      const auth = getFirebaseAdminAuth();
      try {
        const decoded = await auth.verifySessionCookie(sessionCookie, true);
        await auth.revokeRefreshTokens(decoded.sub);
      } catch {
        // Ignore invalid or expired cookies and still clear it client-side.
      }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("Erro ao destruir session cookie:", error);
    return NextResponse.json(
      { error: "Nao foi possivel terminar sessao." },
      { status: 500 }
    );
  }
}
