import "server-only";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";

export async function resolveUserNames(uids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (uids.length === 0) return map;

  const db = getFirebaseAdminDb();
  const refs = uids.map((uid) => db.collection("users").doc(uid));

  const snaps = await db.getAll(...refs);
  snaps.forEach((s) => {
    if (s.exists) {
      const d = s.data();
      const name = (d?.nome as string) || (d?.displayName as string) || (d?.email as string) || s.id;
      map.set(s.id, name);
    }
  });

  return map;
}
