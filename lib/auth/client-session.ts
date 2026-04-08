"use client";

import type { User } from "firebase/auth";
import { getAuthRuntime } from "@/lib/firebase-runtime";

async function ensureOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;

  let message = fallbackMessage;
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) {
      message = data.error;
    }
  } catch {
    // Keep fallback message.
  }

  throw new Error(message);
}

export async function createServerSession(user: User): Promise<void> {
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

  await ensureOk(response, "Nao foi possivel iniciar a sessao no servidor.");
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
