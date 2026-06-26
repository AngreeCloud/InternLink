import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { checkCanArchive } from "@/lib/estagios/archive-validations";
import { writeAuditLog } from "@/lib/audit/write";

export async function tryAutoArchiveEstagio(
  estagioId: string,
  schoolId: string,
  triggeredBy?: string
): Promise<{ archived: boolean; reasons: string[] }> {
  const db = getFirebaseAdminDb();

  try {
    const estagioSnap = await db.collection("estagios").doc(estagioId).get();
    if (!estagioSnap.exists) {
      return { archived: false, reasons: ["Estágio não encontrado"] };
    }

    const estagioData = estagioSnap.data() as Record<string, unknown>;
    const estado = (estagioData.estado as string) || "ativo";
    const dataFimEstimada = estagioData.dataFimEstimada as string | undefined;

    if (estado === "arquivado" || estado === "eliminado") {
      return { archived: false, reasons: [`Estágio com estado '${estado}'`] };
    }

    // Check report
    const reportDoc = await findRelatorioDoc(db, estagioId);
    const reportSubmitted = reportDoc !== null;
    let reportAllSigned = false;
    if (reportDoc) {
      const sigsSnap = await reportDoc.ref.collection("assinaturas").get();
      reportAllSigned = sigsSnap.size >= 2;
    }

    // Check sumários
    const sumariosState = await db
      .collection("estagios")
      .doc(estagioId)
      .collection("sumarios")
      .doc("_state")
      .get();
    const sumariosData = sumariosState.exists
      ? (sumariosState.data() as { allPreenchidos?: boolean; allAssinados?: boolean })
      : {};
    const allSumariosOk =
      sumariosData.allPreenchidos === true && sumariosData.allAssinados === true;

    // Check avaliação
    const [tutorSnap, profSnap] = await Promise.all([
      db.collection("estagios").doc(estagioId).collection("avaliacao").doc("tutor").get(),
      db.collection("estagios").doc(estagioId).collection("avaliacao").doc("professor").get(),
    ]);
    const tutorSigned = tutorSnap.exists
      ? (tutorSnap.data() as { estado?: string }).estado === "assinado"
      : false;
    const profSigned = profSnap.exists
      ? (profSnap.data() as { estado?: string }).estado === "assinado"
      : false;

    const check = checkCanArchive({
      estado,
      dataFimEstimada: dataFimEstimada || null,
      reportSubmitted,
      reportAllSigned,
      allSumariosPreenchidos: allSumariosOk,
      allSumariosAssinados: allSumariosOk,
      avaliacaoTutorAssinada: tutorSigned,
      avaliacaoProfessorAssinada: profSigned,
    });

    if (!check.canArchive) {
      return { archived: false, reasons: check.reasons };
    }

    await db.collection("estagios").doc(estagioId).update({
      estado: "arquivado",
      estadoEstagio: "arquivado",
      arquivadoEm: FieldValue.serverTimestamp(),
      arquivadoPor: triggeredBy || "auto",
      updatedAt: FieldValue.serverTimestamp(),
    });

    writeAuditLog({
      schoolId,
      entityType: "estagio",
      entityId: estagioId,
      entityLabel: (estagioData.titulo as string) || estagioId,
      action: "archive",
      changedBy: triggeredBy || "auto",
      summary: `Estágio arquivado automaticamente: ${(estagioData.titulo as string) || estagioId}`,
      metadata: { auto: true },
    });

    return { archived: true, reasons: [] };
  } catch (err) {
    console.error("[auto-archive] error:", err);
    return { archived: false, reasons: ["Erro interno ao verificar arquivamento"] };
  }
}

async function findRelatorioDoc(
  db: ReturnType<typeof getFirebaseAdminDb>,
  estagioId: string
) {
  const docsCol = db.collection("estagios").doc(estagioId).collection("documentos");
  const snap = await docsCol.where("templateCode", "==", "RELATORIO_FINAL").limit(1).get();
  if (!snap.empty) return snap.docs[0];
  return null;
}
