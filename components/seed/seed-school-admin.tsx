"use client";

import { useEffect } from "react";
import { createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";

const SCHOOL_ID = "esrp";
const SCHOOL_DATA = {
  name: "Escola Secundária de Rocha Peixoto",
  shortName: "ESRP",
  address: "",
  contact: "",
  educationLevel: "Secundária/Profissional",
  emailDomain: "@esrpeixoto.edu.pt",
  requireInstitutionalEmail: false,
};

const ADMIN_EMAIL = "angrycloud.op@gmail.com";
const ADMIN_NAME = "Angry Cloud";

export function SeedSchoolAdmin() {
  useEffect(() => {
    const enabled = process.env.NEXT_PUBLIC_ENABLE_SEED_ADMIN === "true";
    if (!enabled) return;

    const alreadySeeded = typeof window !== "undefined" && localStorage.getItem("internlink-seed-admin") === "done";
    if (alreadySeeded) return;

    let cancelled = false;

    const run = async () => {
      try {
        const auth = await getAuthRuntime();
        const db = await getDbRuntime();

        const schoolRef = doc(db, "schools", SCHOOL_ID);
        const schoolSnap = await getDoc(schoolRef);
        if (!schoolSnap.exists()) {
          await setDoc(schoolRef, {
            ...SCHOOL_DATA,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, "ChangeMe123!");
          await updateProfile(userCredential.user, { displayName: ADMIN_NAME });
          await setDoc(doc(db, "users", userCredential.user.uid), {
            role: "admin_escolar",
            nome: ADMIN_NAME,
            email: ADMIN_EMAIL,
            schoolId: SCHOOL_ID,
            estado: "ativo",
            createdAt: serverTimestamp(),
          });
          await signOut(auth);
        } catch (error: any) {
          if (error?.code !== "auth/email-already-in-use") {
            console.error("Seed admin escolar falhou:", error);
          }
        }

        if (!cancelled && typeof window !== "undefined") {
          localStorage.setItem("internlink-seed-admin", "done");
        }
      } catch (error) {
        console.error("Seed inicial falhou:", error);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
