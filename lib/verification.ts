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
  const userSnap = await getDoc(doc(db, "users", userId));

  if (userSnap.exists()) {
    const userData = userSnap.data() as PendingRegistrationData;
    const role = userData.role ?? "";
    const estado = userData.estado ?? "";
    const schoolId = userData.schoolId ?? "";

    await setDoc(
      doc(db, "users", userId),
      {
        ...userData,
        ...(role === "tutor" && options?.markEmailVerified ? { estado: "ativo" } : {}),
        emailVerified: options?.markEmailVerified ?? true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (role === "professor" && schoolId) {
      await setDoc(
        doc(db, "schools", schoolId, "pendingTeachers", userId),
        {
          name: userData.nome,
          email: userData.email,
          role: "teacher",
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    return { role, estado, schoolId };
  }

  const pendingSnap = await getDoc(doc(db, "pendingRegistrations", userId));

  if (!pendingSnap.exists()) {
    return null;
  }

  const pendingData = pendingSnap.data() as PendingRegistrationData;
  const role = pendingData.role ?? "";
  const estado = pendingData.estado ?? "";
  const schoolId = pendingData.schoolId ?? "";
  const normalizedCourseId = pendingData.courseId ?? null;

  await setDoc(doc(db, "users", userId), {
    ...pendingData,
    courseId: normalizedCourseId,
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