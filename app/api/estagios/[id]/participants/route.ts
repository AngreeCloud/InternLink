import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import type { EstagioRole } from "@/lib/estagios/permissions";

export const runtime = "nodejs";

type ParticipantPayload = {
  uid: string;
  name: string;
  email?: string;
  role: EstagioRole;
  empresa?: string;
};

/**
 * GET /api/estagios/[id]/participants
 *
 * Devolve os nomes/emails dos participantes (aluno, professor, tutor) usando
 * o Admin SDK para contornar limitações das rules quando o tutor pertence a
 * uma escola diferente da do professor/aluno.
 *
 * Requer que o chamador seja membro do estágio.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");
    const db = getFirebaseAdminDb();

    const ids: Array<{ uid: string; role: EstagioRole }> = [];
    if (session.estagio.alunoId) ids.push({ uid: session.estagio.alunoId, role: "aluno" });
    if (session.estagio.professorId) {
      const role: EstagioRole =
        session.course?.courseDirectorId === session.estagio.professorId
          ? "diretor"
          : "professor";
      ids.push({ uid: session.estagio.professorId, role });
    }
    if (session.estagio.tutorId) ids.push({ uid: session.estagio.tutorId, role: "tutor" });

    const uniqueIds = Array.from(new Map(ids.map((x) => [x.uid, x])).values());

    const participants: Record<string, ParticipantPayload> = {};

    await Promise.all(
      uniqueIds.map(async ({ uid, role }) => {
        try {
          const snap = await db.collection("users").doc(uid).get();
          if (!snap.exists) {
            participants[uid] = { uid, name: "Utilizador desconhecido", role };
            return;
          }
          const data = snap.data() as Record<string, unknown>;
          participants[uid] = {
            uid,
            name:
              (data.nome as string) ||
              (data.displayName as string) ||
              (data.email as string) ||
              uid,
            email: typeof data.email === "string" ? (data.email as string) : undefined,
            role,
            empresa: typeof data.empresa === "string" ? (data.empresa as string) : undefined,
          };
        } catch (err) {
          console.error("[v0] participants: load failed", uid, err);
          participants[uid] = { uid, name: "Utilizador desconhecido", role };
        }
      })
    );

    return NextResponse.json({ ok: true, participants });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
