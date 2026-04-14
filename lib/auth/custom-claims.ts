import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { isAppUserEstado, isAppUserRole } from "@/lib/auth/session";

type UserClaims = {
  role?: unknown;
  estado?: unknown;
  [key: string]: unknown;
};

type EnsureUserClaimsResult = {
  role: string;
  estado: string;
  updated: boolean;
  claims: UserClaims;
};

function normalizeClaimValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function ensureUserClaims(
  auth: Auth,
  db: Firestore,
  uid: string
): Promise<EnsureUserClaimsResult> {
  const userDoc = await db.collection("users").doc(uid).get();
  const pendingDoc = userDoc.exists ? null : await db.collection("pendingRegistrations").doc(uid).get();

  if (!userDoc.exists && !pendingDoc?.exists) {
    throw new Error(`Utilizador ${uid} não encontrado para sincronizar custom claims.`);
  }

  const sourceDoc = userDoc.exists ? userDoc : pendingDoc;
  const userData = sourceDoc?.data() as UserClaims;
  const role = normalizeClaimValue(userData.role);
  const estado = normalizeClaimValue(userData.estado);

  if (!role || !isAppUserRole(role)) {
    throw new Error("Custom claims inválidas: role em falta ou inválida.");
  }

  if (!estado || !isAppUserEstado(estado)) {
    throw new Error("Custom claims inválidas: estado em falta ou inválido.");
  }

  const currentUser = await auth.getUser(uid);
  const currentClaims = (currentUser.customClaims ?? {}) as UserClaims;
  const currentRole = normalizeClaimValue(currentClaims.role);
  const currentEstado = normalizeClaimValue(currentClaims.estado);

  if (currentRole === role && currentEstado === estado) {
    return {
      role,
      estado,
      updated: false,
      claims: currentClaims,
    };
  }

  const nextClaims = {
    ...currentClaims,
    role,
    estado,
  };

  await auth.setCustomUserClaims(uid, nextClaims);

  return {
    role,
    estado,
    updated: true,
    claims: nextClaims,
  };
}
