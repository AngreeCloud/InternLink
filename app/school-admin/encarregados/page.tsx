import { SchoolAdminLayout } from "@/components/layout/school-admin-layout";
import { EEManager } from "@/components/school-admin/ee-manager";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function SchoolAdminEncarregadosPage() {
  let schoolId = "";

  try {
    const jar = await cookies();
    const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const { getFirebaseAdminAuth } = await import("@/lib/firebase-admin");
      const auth = getFirebaseAdminAuth();
      const decoded = await auth.verifySessionCookie(sessionCookie, true);
      const db = getFirebaseAdminDb();
      const userSnap = await db.collection("users").doc(decoded.uid).get();
      if (userSnap.exists) {
        const data = userSnap.data() as { schoolId?: string };
        schoolId = data.schoolId || "";
      }
    }
  } catch { /* fallback: client-side will handle */ }

  return (
    <SchoolAdminLayout>
      <EEManager schoolId={schoolId} />
    </SchoolAdminLayout>
  );
}
