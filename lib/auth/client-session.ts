"use client";

import type { User } from "firebase/auth";
import { getAuthRuntime } from "@/lib/firebase-runtime";

const SESSION_CREATE_MAX_ATTEMPTS = 4;
const SESSION_CREATE_RETRY_DELAYS_MS = [300, 700, 1200] as const;

type SessionCreateErrorPayload = {
  error?: string;
  claimsUpdated?: boolean;
  refreshRequired?: boolean;
};

async function readJsonPayload(response: Response): Promise<SessionCreateErrorPayload> {
  try {
    return (await response.json()) as SessionCreateErrorPayload;
  } catch {
    return {};
  }
}

function delayForAttempt(attempt: number): number {
  const lastKnownDelay = SESSION_CREATE_RETRY_DELAYS_MS[SESSION_CREATE_RETRY_DELAYS_MS.length - 1] ?? 1200;
  return SESSION_CREATE_RETRY_DELAYS_MS[attempt] ?? lastKnownDelay;
}

export async function createServerSession(user: User): Promise<void> {
  for (let attempt = 0; attempt < SESSION_CREATE_MAX_ATTEMPTS; attempt += 1) {
    const idToken = await user.getIdToken(true);

    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
      credentials: "include",
    });

    if (response.ok) {
      return;
    }

    const payload = await readJsonPayload(response);
    const claimsUpdated =
      response.status === 428 ||
      Boolean(payload.claimsUpdated) ||
      Boolean(payload.refreshRequired);

    if (claimsUpdated && attempt < SESSION_CREATE_MAX_ATTEMPTS - 1) {
      await wait(delayForAttempt(attempt));
      continue;
    }

    throw new Error(payload.error || "Nao foi possivel iniciar a sessao no servidor.");
  }

  throw new Error("Nao foi possivel iniciar a sessao no servidor. Tente novamente em alguns segundos.");
}

export async function clearServerSession(): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    cache: "no-store",
    credentials: "include",
  });

  await ensureOk(response, "Nao foi possivel terminar a sessao no servidor.");
}

type LogoutOptions = {
  deferClientSignOutMs?: number;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function logoutWithServerSession(options: LogoutOptions = {}): Promise<void> {
  const auth = await getAuthRuntime();
  const deferClientSignOutMs = options.deferClientSignOutMs ?? 0;

  try {
    await clearServerSession();
  } catch {
    // Continue with client sign-out even if cookie cleanup fails server-side.
  }

  if (deferClientSignOutMs > 0) {
    await wait(deferClientSignOutMs);
  }

  await auth.signOut();
}
