import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

function toMillis(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "object") {
    const obj = raw as { seconds?: number; toDate?: () => Date };
    if (typeof obj.toDate === "function") return obj.toDate().getTime();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { uid } = await requireSessionUid();
    const role = request.nextUrl.searchParams.get("role") || "professor";
    const estagioId = request.nextUrl.searchParams.get("estagioId");
    const db = getFirebaseAdminDb();

    let estagioIds: string[];

    if (estagioId) {
      estagioIds = [estagioId];
    } else {
      let filterField: string;
      if (role === "tutor") {
        filterField = "tutorId";
      } else if (role === "aluno") {
        filterField = "alunoId";
      } else {
        filterField = "professorId";
      }

      const estagiosSnap = await db
        .collection("estagios")
        .where(filterField, "==", uid)
        .get();
      estagioIds = estagiosSnap.docs.map((d) => d.id);
    }

    if (estagioIds.length === 0) {
      return NextResponse.json({ ok: true, requests: [] });
    }

    const results = await Promise.all(
      estagioIds.map(async (estagioId) => {
        const snap = await db
          .collection("estagios")
          .doc(estagioId)
          .collection("schedule_change_requests")
          .get();
        return snap.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            estagioId,
            studentId: (data.studentId as string) ?? "",
            professorId: (data.professorId as string) ?? "",
            tutorId: (data.tutorId as string) ?? "",
            type: (data.type as string) ?? "",
            targetDate: (data.targetDate as string) ?? "",
            hoursAffected: Number(data.hoursAffected) || 0,
            reason: (data.reason as string) ?? "",
            status: (data.status as string) ?? "",
            professorDecision: data.professorDecision as string | undefined,
            professorDecidedAt: data.professorDecidedAt ?? null,
            tutorDecision: data.tutorDecision as string | undefined,
            tutorDecidedAt: data.tutorDecidedAt ?? null,
            comments: Array.isArray(data.comments) ? data.comments : [],
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
      })
    );

    const requests = results.flat();

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    console.error("[api/schedule-change-requests]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
