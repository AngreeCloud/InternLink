import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";

// Quick local-dev toggle for skipping email/phone verification gates.
export const bypassVerification = true;

export function isVerificationBypassEnabled() {
  return bypassVerification && process.env.NODE_ENV === "development";
}

type PendingRegistrationData = {
  role?: string;
  estado?: string;
  schoolId?: string;
  nome?: string;
  email?: string;
  [key: string]: unknown;
};

export type FinalizedPendingRegistration = {
  role: string;
  estado: string;
  schoolId: string;
};

export async function finalizePendingRegistration(
  db: Firestore,
  userId: string,
  options?: { markEmailVerified?: boolean },
): Promise<FinalizedPendingRegistration | null> {
  const pendingSnap = await getDoc(doc(db, "pendingRegistrations", userId));

  if (!pendingSnap.exists()) {
    return null;
  }

  const pendingData = pendingSnap.data() as PendingRegistrationData;
  const role = pendingData.role ?? "";
  const estado = pendingData.estado ?? "";
  const schoolId = pendingData.schoolId ?? "";

  await setDoc(doc(db, "users", userId), {
    ...pendingData,
    emailVerified: options?.markEmailVerified ?? true,
    updatedAt: serverTimestamp(),
  });

  if (role === "professor" && schoolId) {
    await setDoc(
      doc(db, "schools", schoolId, "pendingTeachers", userId),
      {
        name: pendingData.nome,
        email: pendingData.email,
        role: "teacher",
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  await deleteDoc(doc(db, "pendingRegistrations", userId));

  return { role, estado, schoolId };
}