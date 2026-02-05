"use client"

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { getDbRuntime } from "@/lib/firebase-runtime"
import { schoolRequestSchema, type SchoolRequestInput } from "@/lib/validators/school-request"

export async function submitSchoolRequest(input: SchoolRequestInput) {
  const parsed = schoolRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.flatten().fieldErrors }
  }

  const db = await getDbRuntime()
  await addDoc(collection(db, "schoolRequests"), {
    schoolName: parsed.data.schoolName,
    contactEmail: parsed.data.contactEmail,
    contactName: parsed.data.contactName,
    role: parsed.data.role,
    message: parsed.data.message ? parsed.data.message : null,
    createdAt: serverTimestamp(),
    status: "pending",
  })

  return { ok: true }
}
