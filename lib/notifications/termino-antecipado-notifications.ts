/**
 * Notification builders for Termino Antecipado events.
 * Pure functions — no Firebase deps, fully testable.
 */

import type { TerminoAntecipadoStatus } from "@/lib/estagios/termino-antecipado";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerminoAntecipadoNotificationPayload = {
  userId: string;
  type: "termino_antecipado";
  docId: string;
  estagioId: string;
  title: string;
  body: string;
  readAt: null;
};

export type TerminoAntecipadoEvent =
  | { kind: "submitted"; alunoNome: string; diaDeDispensa: string; horasRestantes: number; diasParaCumprir: string[] }
  | { kind: "tutor_approved"; tutorNome: string; diaDeDispensa: string; diasParaCumprir: string[] }
  | { kind: "tutor_rejected"; tutorNome: string; motivo: string }
  | { kind: "invalidated"; diaIncumprimento: string }
  | { kind: "submitted_readonly"; alunoNome: string; diaDeDispensa: string };

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function buildTerminoAntecipadoNotification(
  userId: string,
  docId: string,
  estagioId: string,
  event: TerminoAntecipadoEvent
): TerminoAntecipadoNotificationPayload {
  switch (event.kind) {
    case "submitted": {
      const diasStr = event.diasParaCumprir.map(formatDate).join(", ");
      return {
        userId,
        type: "termino_antecipado",
        docId,
        estagioId,
        title: "Pedido submetido com sucesso",
        body: `O teu pedido de término antecipado foi submetido. Dia de dispensa solicitado: ${formatDate(event.diaDeDispensa)}. Dias a cumprir: ${diasStr}. O tutor foi notificado.`,
        readAt: null,
      };
    }

    case "tutor_approved": {
      const diasStr = event.diasParaCumprir ? event.diasParaCumprir.map(formatDate).join(", ") : "";
      return {
        userId,
        type: "termino_antecipado",
        docId,
        estagioId,
        title: "Término antecipado aprovado",
        body: `O teu pedido foi aprovado por ${event.tutorNome}. Encontras-te dispensado no dia ${formatDate(event.diaDeDispensa)}, desde que cumpras integralmente os dias ${diasStr}.`,
        readAt: null,
      };
    }

    case "tutor_rejected":
      return {
        userId,
        type: "termino_antecipado",
        docId,
        estagioId,
        title: "Término antecipado recusado",
        body: `O teu pedido foi recusado por ${event.tutorNome}. Motivo: "${event.motivo}". O estágio mantém-se nos termos inicialmente previstos.`,
        readAt: null,
      };

    case "invalidated":
      return {
        userId,
        type: "termino_antecipado",
        docId,
        estagioId,
        title: "Solicitação invalidada por incumprimento",
        body: `Foi registado incumprimento horário no dia ${formatDate(event.diaIncumprimento)}, facto que determina a perda de eficácia da aprovação do término antecipado. A comparência no dia de dispensa volta a ser obrigatória.`,
        readAt: null,
      };

    case "submitted_readonly":
      return {
        userId,
        type: "termino_antecipado",
        docId,
        estagioId,
        title: "Pedido de término antecipado submetido",
        body: `${event.alunoNome} submeteu um pedido de término antecipado do estágio, com dispensa pretendida para ${formatDate(event.diaDeDispensa)}, sujeito a decisão do tutor responsável. Esta notificação tem natureza exclusivamente informativa.`,
        readAt: null,
      };
  }
}

// ---------------------------------------------------------------------------
// Notification helper — who gets notified
// ---------------------------------------------------------------------------

/**
 * Builds the tutor's notification for a new terminoAntecipado request.
 */
export function buildTutorSubmittedNotification(
  tutorId: string,
  docId: string,
  estagioId: string,
  alunoNome: string,
  diaDeDispensa: string,
  horasRestantes: number,
  diasParaCumprir: string[]
): TerminoAntecipadoNotificationPayload {
  const diasStr = diasParaCumprir.map(formatDate).join(", ");
  return {
    userId: tutorId,
    type: "termino_antecipado",
    docId,
    estagioId,
    title: "Solicitação de término antecipado",
    body: `${alunoNome} solicitou dispensa no dia ${formatDate(diaDeDispensa)}, condicionada ao cumprimento integral dos dias remanescentes. Horas em falta: ${horasRestantes}h. Dias a cumprir: ${diasStr}.`,
    readAt: null,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
