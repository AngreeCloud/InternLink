/**
 * Notification builder for schedule_change_request events.
 * Pure functions — no Firebase deps, fully testable.
 */

import type { ScheduleChangeRequestType } from "@/lib/estagios/schedule-change-requests";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationPayload = {
  userId: string;
  type: "schedule_change_request";
  requestId: string;
  requestType: ScheduleChangeRequestType;
  targetDate: string;
  estagioId: string;
  title: string;
  body: string;
  readAt: null;
};

export type NotificationEvent =
  | { kind: "request_created"; studentName: string }
  | { kind: "professor_approved"; actorName: string }
  | { kind: "professor_rejected"; actorName: string }
  | { kind: "tutor_approved"; actorName: string }
  | { kind: "tutor_rejected"; actorName: string }
  | { kind: "justification_result"; result: "justificada" | "não justificada" };

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

function typeLabel(t: ScheduleChangeRequestType): string {
  switch (t) {
    case "future_absence": return "falta futura";
    case "past_absence_justification": return "justificação de falta";
    case "early_termination": return "término antecipado";
  }
}

function typeTitle(t: ScheduleChangeRequestType): string {
  switch (t) {
    case "future_absence": return "Novo aviso de falta futura";
    case "past_absence_justification": return "Nova justificação de falta";
    case "early_termination": return "Novo pedido de término antecipado";
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function buildNotification(
  userId: string,
  requestId: string,
  requestType: ScheduleChangeRequestType,
  targetDate: string,
  estagioId: string,
  event: NotificationEvent,
): NotificationPayload {
  switch (event.kind) {
    case "request_created":
      return {
        userId,
        type: "schedule_change_request",
        requestId,
        requestType,
        targetDate,
        estagioId,
        title: typeTitle(requestType),
        body: `${event.studentName} submeteu ${typeLabel(requestType)} para ${targetDate}.`,
        readAt: null,
      };

    case "professor_approved":
      return {
        userId,
        type: "schedule_change_request",
        requestId,
        requestType,
        targetDate,
        estagioId,
        title: "Pedido aprovado pelo professor",
        body: `${event.actorName} aprovou ${typeLabel(requestType)} para ${targetDate}. Aguarda a sua decisão.`,
        readAt: null,
      };

    case "professor_rejected":
      return {
        userId,
        type: "schedule_change_request",
        requestId,
        requestType,
        targetDate,
        estagioId,
        title: "Pedido recusado pelo professor",
        body: `${event.actorName} recusou ${typeLabel(requestType)} para ${targetDate}.`,
        readAt: null,
      };

    case "tutor_approved":
      return {
        userId,
        type: "schedule_change_request",
        requestId,
        requestType,
        targetDate,
        estagioId,
        title: "Tutor aprovou o pedido",
        body: `${event.actorName} aprovou ${typeLabel(requestType)} para ${targetDate}. O pedido foi concluído.`,
        readAt: null,
      };

    case "tutor_rejected":
      return {
        userId,
        type: "schedule_change_request",
        requestId,
        requestType,
        targetDate,
        estagioId,
        title: "Tutor recusou o pedido",
        body: `${event.actorName} recusou ${typeLabel(requestType)} para ${targetDate}.`,
        readAt: null,
      };

    case "justification_result":
      return {
        userId,
        type: "schedule_change_request",
        requestId,
        requestType,
        targetDate,
        estagioId,
        title: "Decisão sobre justificação de falta",
        body: `O professor decidiu que a falta de ${targetDate} é ${event.result}.`,
        readAt: null,
      };
  }
}

// ---------------------------------------------------------------------------
// Who should be notified for what
// ---------------------------------------------------------------------------

export function shouldNotifyProfessorOnCreate(type: ScheduleChangeRequestType): boolean {
  return true; // sempre — professor precisa saber de todos os pedidos
}

export function shouldNotifyTutorOnCreate(type: ScheduleChangeRequestType): boolean {
  return type === "past_absence_justification";
}

export function shouldNotifyTutorOnProfessorDecision(type: ScheduleChangeRequestType, nextStatus: string): boolean {
  // Notifica tutor quando o pedido fica pendente da decisão do tutor
  return nextStatus === "pending_tutor";
}

export function shouldNotifyProfessorOnTutorDecision(type: ScheduleChangeRequestType, nextStatus: string): boolean {
  // Notifica professor do resultado da decisão do tutor
  return nextStatus === "approved" || nextStatus === "rejected";
}

export function shouldNotifyStudent(type: ScheduleChangeRequestType, nextStatus: string): boolean {
  // Notifica aluno quando o pedido é resolvido
  return nextStatus === "approved" || nextStatus === "rejected";
}
