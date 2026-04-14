import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
} from "@/lib/auth/session";
import { ensureUserClaims } from "@/lib/auth/custom-claims";

export const runtime = "nodejs";
const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

function logAuthSessionDebug(event: string, details?: Record<string, unknown>) {
  if (!AUTH_DEBUG) return;
  console.info("[auth-session]", event, details ?? {});
}

type SessionRequestBody = {
  idToken?: string;
};

type DecodedTokenLike = {
  uid: string;
  role?: unknown;
  estado?: unknown;
};

type TokenClaims = {
  role: string;
  estado: string;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function hasExpectedClaims(decoded: DecodedTokenLike, role: string, estado: string): boolean {
  return decoded.role === role && decoded.estado === estado;
}

function readTokenClaims(decoded: DecodedTokenLike): TokenClaims | null {
  const role = typeof decoded.role === "string" ? decoded.role : null;
  const estado = typeof decoded.estado === "string" ? decoded.estado : null;

  if (!role || !estado) {
    return null;
  }

  return { role, estado };
}

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as SessionRequestBody;

    if (!idToken) {
      return NextResponse.json({ error: "idToken em falta." }, { status: 400 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = (await auth.verifyIdToken(idToken)) as DecodedTokenLike;
    logAuthSessionDebug("id_token_verified", {
      uid: decoded.uid,
      role: typeof decoded.role === "string" ? decoded.role : null,
      estado: typeof decoded.estado === "string" ? decoded.estado : null,
    });

    const db = getFirebaseAdminDb();

    const claimsSync = await ensureUserClaims(auth, db, decoded.uid);
    logAuthSessionDebug("claims_sync_result", {
      uid: decoded.uid,
      updated: claimsSync.updated,
      role: claimsSync.role,
      estado: claimsSync.estado,
    });

    if (claimsSync.updated) {
      logAuthSessionDebug("refresh_required_after_claim_update", {
        uid: decoded.uid,
      });
      return NextResponse.json(
        {
          ok: false,
          claimsUpdated: true,
          refreshRequired: true,
          role: claimsSync.role,
          estado: claimsSync.estado,
        },
        { status: 428 }
      );
    }

    if (!hasExpectedClaims(decoded, claimsSync.role, claimsSync.estado)) {
      logAuthSessionDebug("refresh_required_stale_token_claims", {
        uid: decoded.uid,
        tokenRole: typeof decoded.role === "string" ? decoded.role : null,
        tokenEstado: typeof decoded.estado === "string" ? decoded.estado : null,
        expectedRole: claimsSync.role,
        expectedEstado: claimsSync.estado,
      });
      return NextResponse.json(
        {
          ok: false,
          claimsUpdated: true,
          refreshRequired: true,
          role: claimsSync.role,
          estado: claimsSync.estado,
        },
        { status: 428 }
      );
    }

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });
    logAuthSessionDebug("session_cookie_created", {
      uid: decoded.uid,
      expiresInMs: SESSION_EXPIRES_IN_MS,
      secure: isProduction(),
      source: "synced_claims",
    });

    const response = NextResponse.json({
      ok: true,
      role: claimsSync.role,
      estado: claimsSync.estado,
    });
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
    logAuthSessionDebug("session_creation_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
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
        const decoded = await auth.verifySessionCookie(sessionCookie, false);
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
